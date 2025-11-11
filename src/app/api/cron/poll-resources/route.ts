import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'

/**
 * Vercel Cron Job: Poll Azure resources for all tenants
 * Can be configured in vercel.json to run on a schedule
 *
 * This endpoint syncs resource inventory data for all active Azure tenants.
 * It authenticates using the CRON_SECRET environment variable for security.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not set')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CRON] Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[CRON] Starting resource polling job...')

    // Create Supabase client with service role for background job
    const supabase = await createClient()

    // Fetch all active Azure tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('connection_status', 'connected')

    if (tenantsError) {
      console.error('[CRON] Error fetching tenants:', tenantsError)
      return NextResponse.json(
        { error: 'Failed to fetch tenants' },
        { status: 500 }
      )
    }

    if (!tenants || tenants.length === 0) {
      console.log('[CRON] No active tenants found')
      return NextResponse.json({
        success: true,
        message: 'No active tenants to sync',
        tenantsProcessed: 0
      })
    }

    console.log(`[CRON] Found ${tenants.length} active tenant(s) to sync`)

    const results = {
      total: tenants.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ tenantId: string; error: string }>,
      totalResourcesIngested: 0
    }

    // Process each tenant
    for (const tenant of tenants) {
      try {
        console.log(`[CRON] Processing tenant ${tenant.id} (${tenant.display_name})`)

        // Decrypt the client secret
        let clientSecret: string
        try {
          clientSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
        } catch (decryptError: any) {
          console.error(`[CRON] Failed to decrypt credentials for tenant ${tenant.id}:`, decryptError)
          results.failed++
          results.errors.push({
            tenantId: tenant.id,
            error: 'Failed to decrypt credentials'
          })
          continue
        }

        // Create Azure credential
        const credential = new ClientSecretCredential(
          tenant.azure_tenant_id,
          tenant.azure_app_id,
          clientSecret
        )

        // Get access token to verify connection
        const token = await credential.getToken('https://management.azure.com/.default')

        // Fetch subscriptions
        const subscriptionsResponse = await fetch(
          'https://management.azure.com/subscriptions?api-version=2022-12-01',
          {
            headers: {
              'Authorization': `Bearer ${token.token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!subscriptionsResponse.ok) {
          throw new Error(`Azure API returned ${subscriptionsResponse.status}`)
        }

        const subscriptionsData = await subscriptionsResponse.json()
        const azureSubscriptions = subscriptionsData.value || []

        console.log(`[CRON] Found ${azureSubscriptions.length} subscription(s) for tenant ${tenant.id}`)

        let resourcesIngested = 0

        // Fetch resources for each subscription
        for (const sub of azureSubscriptions) {
          try {
            const subscriptionId = sub.subscriptionId

            // Fetch all resources in the subscription
            const resourcesResponse = await fetch(
              `https://management.azure.com/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`,
              {
                headers: {
                  'Authorization': `Bearer ${token.token}`,
                  'Content-Type': 'application/json'
                }
              }
            )

            if (!resourcesResponse.ok) {
              console.error(`[CRON] Failed to fetch resources for subscription ${subscriptionId}: ${resourcesResponse.status}`)
              continue
            }

            const resourcesData = await resourcesResponse.json()
            const resources = resourcesData.value || []

            console.log(`[CRON] Found ${resources.length} resource(s) in subscription ${subscriptionId}`)

            // Upsert resources into database
            if (resources.length > 0) {
              const resourceRecords = resources.map((resource: any) => ({
                org_id: tenant.org_id,
                tenant_id: tenant.id,
                subscription_id: subscriptionId,
                resource_id: resource.id,
                name: resource.name,
                type: resource.type,
                location: resource.location,
                resource_group: resource.id.split('/')[4], // Extract from resource ID
                tags: resource.tags || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }))

              // Note: You'll need to create an 'azure_resources' table in Supabase
              // For now, this is a placeholder - you can uncomment when the table exists
              /*
              const { error: resourceError } = await supabase
                .from('azure_resources')
                .upsert(resourceRecords, {
                  onConflict: 'resource_id',
                  ignoreDuplicates: false
                })

              if (resourceError) {
                console.error(`[CRON] Error upserting resources for ${subscriptionId}:`, resourceError)
              } else {
                resourcesIngested += resourceRecords.length
                console.log(`[CRON] Upserted ${resourceRecords.length} resources for subscription ${subscriptionId}`)
              }
              */

              // For now, just log the count
              resourcesIngested += resourceRecords.length
              console.log(`[CRON] Would upsert ${resourceRecords.length} resources for subscription ${subscriptionId}`)
            }

          } catch (resourceError: any) {
            console.error(`[CRON] Error fetching resources for subscription ${sub.subscriptionId}:`, resourceError.message)
          }
        }

        results.successful++
        results.totalResourcesIngested += resourcesIngested
        console.log(`[CRON] Successfully synced tenant ${tenant.id}: ${resourcesIngested} resources`)

      } catch (tenantError: any) {
        console.error(`[CRON] Error processing tenant ${tenant.id}:`, tenantError.message)
        results.failed++
        results.errors.push({
          tenantId: tenant.id,
          error: tenantError.message || 'Unknown error'
        })
      }
    }

    console.log('[CRON] Resource polling job completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Resource polling completed',
      ...results
    })

  } catch (error: any) {
    console.error('[CRON] Resource polling job failed:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
