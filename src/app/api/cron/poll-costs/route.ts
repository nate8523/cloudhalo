import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { CostManagementClient } from '@azure/arm-costmanagement'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'

/**
 * Vercel Cron Job - Poll Azure costs
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/poll-costs",
 *     "schedule": "0 */4 * * *"
 *   }]
 * }
 *
 * Or call manually: POST /api/cron/poll-costs
 * Header: Authorization: Bearer YOUR_CRON_SECRET
 */

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

  console.log('[CRON] Starting Azure cost polling...')
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

    let totalCostsIngested = 0
    const results = []

    // Poll each tenant (sequential to avoid rate limits)
    for (const tenant of tenants) {
      try {
        const costsIngested = await pollTenantCosts(tenant, supabase)
        totalCostsIngested += costsIngested

        // Update last_sync_at
        await supabase
          .from('azure_tenants')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', tenant.id)

        results.push({
          tenant: tenant.name,
          status: 'success',
          costsIngested
        })

        console.log(`[CRON] ✓ ${tenant.name}: ${costsIngested} records`)

      } catch (error: any) {
        console.error(`[CRON] ✗ ${tenant.name}:`, error.message)

        // Mark tenant as failed if auth error
        if (error.message?.includes('AADSTS')) {
          await supabase
            .from('azure_tenants')
            .update({ connection_status: 'failed' })
            .eq('id', tenant.id)
        }

        results.push({
          tenant: tenant.name,
          status: 'failed',
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime
    console.log(`[CRON] Completed in ${duration}ms. Total records: ${totalCostsIngested}`)

    return NextResponse.json({
      success: true,
      totalCostsIngested,
      duration,
      results
    })

  } catch (error: any) {
    console.error('[CRON] Fatal error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Allow GET for manual testing
export async function GET(request: Request) {
  return POST(request)
}

/**
 * Poll costs for a single tenant
 */
async function pollTenantCosts(tenant: any, supabase: any): Promise<number> {
  // Decrypt credentials
  const clientSecret = await decryptAzureClientSecret(tenant.azure_client_secret)

  // Get subscriptions
  const { data: subscriptions } = await supabase
    .from('azure_subscriptions')
    .select('*')
    .eq('tenant_id', tenant.id)

  if (!subscriptions || subscriptions.length === 0) {
    return 0
  }

  let totalCosts = 0

  // Create Azure client
  const credential = new ClientSecretCredential(
    tenant.azure_tenant_id,
    tenant.azure_app_id,
    clientSecret
  )
  const costClient = new CostManagementClient(credential)

  // Poll each subscription
  for (const subscription of subscriptions) {
    try {
      const costs = await fetchSubscriptionCosts(
        costClient,
        subscription.subscription_id,
        tenant.org_id,
        tenant.id
      )

      if (costs.length > 0) {
        // Upsert to database
        const { error } = await supabase
          .from('cost_snapshots')
          .upsert(costs, {
            onConflict: 'tenant_id,subscription_id,resource_id,date',
            ignoreDuplicates: false
          })

        if (!error) {
          totalCosts += costs.length
        }
      }
    } catch (error: any) {
      console.error(`[CRON] Subscription ${subscription.subscription_id}:`, error.message)
    }
  }

  return totalCosts
}

/**
 * Fetch costs for a subscription from Azure
 */
async function fetchSubscriptionCosts(
  client: CostManagementClient,
  subscriptionId: string,
  orgId: string,
  tenantId: string
): Promise<any[]> {
  const scope = `/subscriptions/${subscriptionId}`

  const queryResult = await client.query.usage(scope, {
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
      org_id: orgId,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
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

  return costs
}
