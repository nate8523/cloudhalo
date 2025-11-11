/**
 * Vercel Cron Job - Poll Azure Resources
 *
 * This cron job runs every 12 hours to discover and sync Azure resources
 * from all connected tenants.
 *
 * Add this to vercel.json:
 *
 * crons: [{ path: "/api/cron/poll-resources", schedule: "0 */12 * * *" }]
 *
 * Or call manually: POST /api/cron/poll-resources
 * Header: Authorization: Bearer YOUR_CRON_SECRET
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'
import { discoverResourcesPaginated } from '@/lib/azure/resource-graph'

// Verify request is from Vercel Cron or authorized caller
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-me'

  // Allow Vercel Cron jobs (they set this header)
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  return false
}

export async function POST(request: Request) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[CRON] Starting Azure resource polling...')
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Fetch all connected tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('connection_status', 'connected')

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`)
    }

    if (!tenants || tenants.length === 0) {
      console.log('[CRON] No connected tenants found')
      return NextResponse.json({
        success: true,
        message: 'No tenants to poll',
        duration: Date.now() - startTime
      })
    }

    console.log(`[CRON] Found ${tenants.length} tenant(s) to poll`)

    let totalResourcesIngested = 0
    const results = []

    // Poll each tenant (sequential to avoid overwhelming the database)
    for (const tenant of tenants) {
      try {
        const resourcesIngested = await pollTenantResources(tenant, supabase)
        totalResourcesIngested += resourcesIngested

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          resourcesIngested,
          success: true
        })

        console.log(`[CRON] Successfully polled tenant ${tenant.name}: ${resourcesIngested} resources`)
      } catch (error: any) {
        console.error(`[CRON] Error polling tenant ${tenant.id}:`, error)
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: false,
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime
    console.log(`[CRON] Completed in ${duration}ms. Total resources: ${totalResourcesIngested}`)

    return NextResponse.json({
      success: true,
      message: 'Resource polling completed',
      totalResourcesIngested,
      tenantsPolled: tenants.length,
      results,
      duration
    })
  } catch (error: any) {
    console.error('[CRON] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

/**
 * Poll resources for a single tenant
 */
async function pollTenantResources(tenant: any, supabase: any): Promise<number> {
  console.log(`[CRON] Polling tenant: ${tenant.name} (${tenant.id})`)

  // Decrypt credentials
  let clientSecret: string
  try {
    clientSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
  } catch (decryptError: any) {
    throw new Error(`Failed to decrypt credentials: ${decryptError.message}`)
  }

  // Create Azure credential
  const credential = new ClientSecretCredential(
    tenant.azure_tenant_id,
    tenant.azure_app_id,
    clientSecret
  )

  // Get enabled subscriptions for this tenant
  const { data: subscriptions, error: subsError } = await supabase
    .from('azure_subscriptions')
    .select('subscription_id')
    .eq('tenant_id', tenant.id)
    .eq('state', 'Enabled')

  if (subsError) {
    throw new Error(`Failed to fetch subscriptions: ${subsError.message}`)
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`[CRON] No enabled subscriptions for tenant ${tenant.id}`)
    return 0
  }

  const subscriptionIds = subscriptions.map((s: any) => s.subscription_id)
  console.log(`[CRON] Discovering resources for ${subscriptionIds.length} subscription(s)`)

  // Discover resources using Resource Graph API
  const resources = await discoverResourcesPaginated(credential, subscriptionIds)
  console.log(`[CRON] Discovered ${resources.length} resources`)

  // Get org_id for this tenant
  const { data: tenantData } = await supabase
    .from('azure_tenants')
    .select('org_id')
    .eq('id', tenant.id)
    .single()

  if (!tenantData?.org_id) {
    throw new Error('Organization not found for tenant')
  }

  // Prepare resources for database insertion
  const resourceRecords = resources.map(resource => ({
    org_id: tenantData.org_id,
    tenant_id: tenant.id,
    subscription_id: resource.subscriptionId,
    resource_id: resource.id,
    resource_name: resource.name,
    resource_type: resource.type,
    resource_group: resource.resourceGroup,
    location: resource.location || null,
    sku: resource.sku?.name || null,
    kind: resource.kind || null,
    tags: resource.tags || {},
    provisioning_state: resource.provisioningState || null,
    power_state: resource.powerState || null,
    properties: resource.properties || {},
    last_synced_at: new Date().toISOString()
  }))

  // Upsert resources in batches (Supabase has limits)
  const batchSize = 500
  let syncedCount = 0

  for (let i = 0; i < resourceRecords.length; i += batchSize) {
    const batch = resourceRecords.slice(i, i + batchSize)

    const { error: upsertError } = await supabase
      .from('azure_resources')
      .upsert(batch, {
        onConflict: 'resource_id',
        ignoreDuplicates: false
      })

    if (upsertError) {
      throw new Error(`Failed to upsert resources batch: ${upsertError.message}`)
    }

    syncedCount += batch.length
    console.log(`[CRON] Synced ${syncedCount}/${resourceRecords.length} resources`)
  }

  // Clean up old resources that weren't in the latest sync
  // This helps identify deleted resources
  const syncTimestamp = new Date().toISOString()
  const { error: cleanupError } = await supabase
    .from('azure_resources')
    .delete()
    .eq('tenant_id', tenant.id)
    .lt('last_synced_at', syncTimestamp)

  if (cleanupError) {
    console.error(`[CRON] Error cleaning up old resources:`, cleanupError)
  }

  return resources.length
}

// Also export GET for manual testing (with same auth)
export async function GET(request: Request) {
  return POST(request)
}
