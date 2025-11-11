import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { decryptAzureClientSecret } from '../lib/encryption'
import { AzureCostClient } from '../lib/azure-cost-client'
import { AzureTenant, AzureSubscription, CostSnapshot } from '../types'

/**
 * Poll Azure Cost Management API for all connected tenants
 * This job runs every 4 hours (aligned with Azure API refresh rate)
 */
export async function pollAzureCosts(): Promise<void> {
  logger.info('Starting Azure cost polling job')

  try {
    // Fetch all connected tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('connection_status', 'connected')

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`)
    }

    if (!tenants || tenants.length === 0) {
      logger.info('No connected tenants found. Skipping cost polling.')
      return
    }

    logger.info(`Found ${tenants.length} connected tenant(s) to poll`)

    // Process each tenant
    let totalCostsIngested = 0
    for (const tenant of tenants as AzureTenant[]) {
      try {
        const costsIngested = await pollTenantCosts(tenant)
        totalCostsIngested += costsIngested

        // Update last_sync_at timestamp
        await supabase
          .from('azure_tenants')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', tenant.id)

      } catch (error) {
        logger.error(`Failed to poll costs for tenant ${tenant.name} (${tenant.id})`, error)

        // Mark tenant as failed if credentials are invalid
        if (error instanceof Error && error.message.includes('AADSTS')) {
          await supabase
            .from('azure_tenants')
            .update({ connection_status: 'failed' })
            .eq('id', tenant.id)

          logger.warn(`Marked tenant ${tenant.name} as failed due to auth error`)
        }
      }
    }

    logger.info(`Cost polling job completed. Ingested ${totalCostsIngested} cost records.`)

  } catch (error) {
    logger.error('Cost polling job failed', error)
    throw error
  }
}

/**
 * Poll costs for a single tenant and all its subscriptions
 */
async function pollTenantCosts(tenant: AzureTenant): Promise<number> {
  logger.info(`Polling costs for tenant: ${tenant.name} (${tenant.id})`)

  // Decrypt Azure credentials
  const clientSecret = decryptAzureClientSecret(tenant.azure_client_secret)

  // Create Azure Cost Management client
  const costClient = new AzureCostClient({
    tenantId: tenant.azure_tenant_id,
    clientId: tenant.azure_app_id,
    clientSecret
  })

  // Fetch subscriptions for this tenant
  const { data: subscriptions, error: subsError } = await supabase
    .from('azure_subscriptions')
    .select('*')
    .eq('tenant_id', tenant.id)

  if (subsError) {
    throw new Error(`Failed to fetch subscriptions for tenant ${tenant.id}: ${subsError.message}`)
  }

  if (!subscriptions || subscriptions.length === 0) {
    logger.warn(`No subscriptions found for tenant ${tenant.name}. Skipping.`)
    return 0
  }

  logger.info(`Found ${subscriptions.length} subscription(s) for tenant ${tenant.name}`)

  let totalCosts = 0

  // Poll costs for each subscription
  for (const subscription of subscriptions as AzureSubscription[]) {
    try {
      logger.debug(`Fetching costs for subscription ${subscription.name} (${subscription.subscription_id})`)

      const costs = await costClient.fetchSubscriptionCosts(subscription.subscription_id)

      if (costs.length === 0) {
        logger.debug(`No costs found for subscription ${subscription.subscription_id}`)
        continue
      }

      // Transform to CostSnapshot format
      const costSnapshots: CostSnapshot[] = costs.map(cost => ({
        org_id: tenant.org_id,
        tenant_id: tenant.id,
        subscription_id: cost.subscriptionId,
        resource_id: cost.resourceId,
        resource_name: cost.resourceName,
        resource_type: cost.resourceType,
        resource_group: cost.resourceGroup,
        service_category: cost.serviceCategory,
        location: cost.location,
        cost_usd: cost.cost,
        date: cost.date
      }))

      // Upsert cost snapshots to database (prevent duplicates via UNIQUE constraint)
      const { error: upsertError } = await supabase
        .from('cost_snapshots')
        .upsert(costSnapshots, {
          onConflict: 'tenant_id,subscription_id,resource_id,date',
          ignoreDuplicates: false // Update existing records
        })

      if (upsertError) {
        logger.error(`Failed to upsert costs for subscription ${subscription.subscription_id}`, upsertError)
        continue
      }

      totalCosts += costSnapshots.length
      logger.info(`Ingested ${costSnapshots.length} cost records for subscription ${subscription.name}`)

    } catch (error) {
      logger.error(`Failed to fetch costs for subscription ${subscription.subscription_id}`, error)
      // Continue with next subscription
    }
  }

  logger.info(`Completed polling tenant ${tenant.name}. Ingested ${totalCosts} cost records.`)
  return totalCosts
}
