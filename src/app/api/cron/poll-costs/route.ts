import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'
import type { Database } from '@/types/database'
import { rateLimiters, applyRateLimit, constantTimeCompare, verifyCronIPWhitelist, verifyCronHmacSignature } from '@/lib/rate-limit'

/**
 * Vercel Cron Job: Poll Azure costs for all tenants
 * Runs daily at 2 AM UTC (configured in vercel.json)
 *
 * This endpoint syncs cost data for all active Azure tenants across all organizations.
 * It authenticates using the CRON_SECRET environment variable for security.
 */
export async function GET(request: NextRequest) {
  try {
    // Defense-in-depth security layers for cron endpoints:

    // 1. Verify IP whitelist first (optional but recommended)
    const ipCheckResult = await verifyCronIPWhitelist(request)
    if (ipCheckResult) return ipCheckResult

    // 2. Apply IP-based rate limiting (10 attempts per hour per IP)
    const rateLimitResult = await applyRateLimit(request, rateLimiters.cron, 'ip')
    if (rateLimitResult) {
      console.error('[CRON] Rate limit exceeded for IP:', request.headers.get('x-forwarded-for'))
      return rateLimitResult
    }

    // 3. Verify HMAC signature (prevents replay attacks)
    const hmacCheckResult = await verifyCronHmacSignature(request)
    if (hmacCheckResult) return hmacCheckResult

    // 4. Verify Bearer token (defense in depth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not set')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    // Use constant-time comparison to prevent timing attacks
    const expectedAuth = `Bearer ${cronSecret}`
    if (!constantTimeCompare(authHeader || '', expectedAuth)) {
      // Log suspicious activity for monitoring
      console.error('[CRON] Unauthorized cron request:', {
        ip: request.headers.get('x-forwarded-for'),
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
      })

      // Add delay before responding to slow down brute force attempts
      await new Promise(resolve => setTimeout(resolve, 1000))

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[CRON] Starting cost polling job...')

    // Create Supabase client with service role for background job
    const supabase = await createClient() as any

    // Fetch all active Azure tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('azure_tenants')
      .select('id, org_id, display_name, azure_tenant_id, azure_app_id, azure_client_secret, connection_status, last_sync_at')
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

    // Type assertion - we know tenants exists and has length > 0 at this point
    const activeTenants = tenants as Array<{
      id: string
      org_id: string
      display_name: string | null
      azure_tenant_id: string
      azure_app_id: string
      azure_client_secret: string
      connection_status: string
      last_sync_at: string | null
    }>

    console.log(`[CRON] Found ${activeTenants.length} active tenant(s) to sync`)

    const results = {
      total: activeTenants.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ tenantId: string; error: string }>,
      totalCostsIngested: 0
    }

    // Process each tenant
    for (const tenant of activeTenants) {
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

        // Process subscriptions
        const subscriptions = azureSubscriptions.map((sub: any) => ({
          subscription_id: sub.subscriptionId || '',
          name: sub.displayName || sub.subscriptionId || 'Unnamed Subscription',
          display_name: sub.displayName,
          state: sub.state
        }))

        // Fetch costs for each subscription
        let costsIngested = 0

        if (subscriptions.length > 0) {
          const { CostManagementClient } = await import('@azure/arm-costmanagement')
          const costClient = new CostManagementClient(credential)

          for (const sub of subscriptions) {
            try {
              const scope = `/subscriptions/${sub.subscription_id}`

              const queryResult = await costClient.query.usage(scope, {
                type: 'Usage',
                timeframe: 'MonthToDate',
                dataset: {
                  granularity: 'Daily',
                  aggregation: {
                    totalCost: {
                      name: 'Cost',
                      function: 'Sum'
                    }
                  },
                  grouping: [
                    { type: 'Dimension', name: 'ResourceId' },
                    { type: 'Dimension', name: 'ResourceType' },
                    { type: 'Dimension', name: 'ResourceGroupName' },
                    { type: 'Dimension', name: 'ServiceName' },
                    { type: 'Dimension', name: 'ResourceLocation' }
                  ]
                }
              })

              const costs = []
              const columns = queryResult.columns || []
              const costIndex = columns.findIndex((c: any) => c.name === 'Cost')
              const dateIndex = columns.findIndex((c: any) => c.name === 'UsageDate')
              const resourceIdIndex = columns.findIndex((c: any) => c.name === 'ResourceId')
              const resourceTypeIndex = columns.findIndex((c: any) => c.name === 'ResourceType')
              const resourceGroupIndex = columns.findIndex((c: any) => c.name === 'ResourceGroupName')
              const serviceIndex = columns.findIndex((c: any) => c.name === 'ServiceName')
              const locationIndex = columns.findIndex((c: any) => c.name === 'ResourceLocation')

              for (const row of queryResult.rows || []) {
                const cost = parseFloat(row[costIndex]) || 0
                if (cost === 0) continue

                const resourceId = row[resourceIdIndex] || null
                const resourceName = resourceId ? resourceId.split('/').pop() : null
                const dateStr = row[dateIndex]?.toString() || ''
                const date = dateStr.length === 8
                  ? `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
                  : new Date().toISOString().split('T')[0]

                costs.push({
                  org_id: tenant.org_id,
                  tenant_id: tenant.id,
                  subscription_id: sub.subscription_id,
                  resource_id: resourceId,
                  resource_name: resourceName,
                  resource_type: row[resourceTypeIndex] || null,
                  resource_group: row[resourceGroupIndex] || null,
                  service_category: row[serviceIndex] || null,
                  location: row[locationIndex] || null,
                  cost_usd: cost,
                  date
                })
              }

              if (costs.length > 0) {
                const { error: costError } = await supabase
                  .from('cost_snapshots')
                  .upsert(costs as any, {
                    onConflict: 'tenant_id,subscription_id,resource_id,date',
                    ignoreDuplicates: false
                  })

                if (!costError) {
                  costsIngested += costs.length
                  console.log(`[CRON] Ingested ${costs.length} cost records for subscription ${sub.subscription_id}`)
                } else {
                  console.error(`[CRON] Error ingesting costs for ${sub.subscription_id}:`, costError)
                }
              }

            } catch (costError: any) {
              console.error(`[CRON] Error fetching costs for subscription ${sub.subscription_id}:`, costError.message)
            }
          }
        }

        // Update tenant last sync time
        await supabase
          .from('azure_tenants')
          .update({
            last_sync_at: new Date().toISOString()
          })
          .eq('id', tenant.id)

        results.successful++
        results.totalCostsIngested += costsIngested
        console.log(`[CRON] Successfully synced tenant ${tenant.id}: ${costsIngested} cost records`)

      } catch (tenantError: any) {
        console.error(`[CRON] Error processing tenant ${tenant.id}:`, tenantError.message)
        results.failed++
        results.errors.push({
          tenantId: tenant.id,
          error: tenantError.message || 'Unknown error'
        })

        // Update tenant with error status
        await supabase
          .from('azure_tenants')
          .update({
            connection_status: 'failed',
            connection_error: tenantError.message || 'Sync failed'
          })
          .eq('id', tenant.id)
      }
    }

    console.log('[CRON] Cost polling job completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Cost polling completed',
      ...results
    })

  } catch (error: any) {
    console.error('[CRON] Cost polling job failed:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
