/**
 * Resource Sync API Endpoint
 *
 * POST /api/resources/sync
 * Discovers and syncs Azure resources for all connected tenants or a specific tenant
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'
import { discoverResourcesPaginated } from '@/lib/azure/resource-graph'

interface SyncRequestBody {
  tenantId?: string // Optional: sync specific tenant, if omitted syncs all
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null }

    if (!userData?.org_id) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({})) as SyncRequestBody

    // Fetch tenants to sync
    let tenantsQuery = supabase
      .from('azure_tenants')
      .select('*')
      .eq('org_id', userData.org_id)
      .eq('connection_status', 'connected')

    if (body.tenantId) {
      tenantsQuery = tenantsQuery.eq('id', body.tenantId)
    }

    const { data: tenants, error: tenantsError } = await tenantsQuery

    if (tenantsError || !tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: 'No connected tenants found' },
        { status: 404 }
      )
    }

    console.log(`[Resource Sync] Starting sync for ${tenants.length} tenant(s)`)

    let totalResourcesSynced = 0
    const results = []

    // Process each tenant
    for (const tenant of tenants) {
      try {
        console.log(`[Resource Sync] Processing tenant: ${tenant.name} (${tenant.id})`)

        // Decrypt credentials
        let clientSecret: string
        try {
          clientSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
        } catch (decryptError: any) {
          console.error(`[Resource Sync] Failed to decrypt credentials for tenant ${tenant.id}:`, decryptError)
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: false,
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

        // Get subscriptions for this tenant
        const { data: subscriptions } = await supabase
          .from('azure_subscriptions')
          .select('subscription_id')
          .eq('tenant_id', tenant.id)
          .eq('state', 'Enabled')

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`[Resource Sync] No enabled subscriptions for tenant ${tenant.id}`)
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: true,
            resourcesDiscovered: 0,
            message: 'No enabled subscriptions'
          })
          continue
        }

        const subscriptionIds = subscriptions.map(s => s.subscription_id)
        console.log(`[Resource Sync] Discovering resources for ${subscriptionIds.length} subscription(s)`)

        // Discover resources using Resource Graph
        const resources = await discoverResourcesPaginated(credential, subscriptionIds)
        console.log(`[Resource Sync] Discovered ${resources.length} resources for tenant ${tenant.id}`)

        // Prepare resources for database insertion
        const resourceRecords = resources.map(resource => ({
          org_id: userData.org_id,
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
            console.error(`[Resource Sync] Error upserting resources batch ${i}-${i + batchSize}:`, upsertError)
            throw new Error(`Failed to sync resources: ${upsertError.message}`)
          }

          syncedCount += batch.length
          console.log(`[Resource Sync] Synced ${syncedCount}/${resourceRecords.length} resources`)
        }

        // Mark old resources as stale (resources that weren't in the latest sync)
        // This helps identify deleted resources
        const syncTimestamp = new Date().toISOString()
        const { error: cleanupError } = await supabase
          .from('azure_resources')
          .delete()
          .eq('tenant_id', tenant.id)
          .lt('last_synced_at', syncTimestamp)

        if (cleanupError) {
          console.error(`[Resource Sync] Error cleaning up old resources:`, cleanupError)
        }

        totalResourcesSynced += resources.length

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: true,
          resourcesDiscovered: resources.length,
          subscriptionsScanned: subscriptionIds.length
        })

      } catch (tenantError: any) {
        console.error(`[Resource Sync] Error processing tenant ${tenant.id}:`, tenantError)
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: false,
          error: tenantError.message || 'Unknown error'
        })
      }
    }

    console.log(`[Resource Sync] Completed. Total resources synced: ${totalResourcesSynced}`)

    return NextResponse.json({
      success: true,
      message: 'Resource sync completed',
      totalResourcesSynced,
      tenantsProcessed: results.length,
      results,
      syncedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Resource Sync] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
