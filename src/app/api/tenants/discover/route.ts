import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { SubscriptionClient } from '@azure/arm-subscriptions'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'
import { logSecureError, createSecureErrorResponse, handleAzureError } from '@/lib/security/error-handler'

/**
 * POST /api/tenants/discover
 *
 * Auto-discovers Azure subscriptions for a connected tenant and stores them in the database.
 * This is called after tenant connection or manually to refresh subscription list.
 *
 * PRD Reference: Lines 277-281 (FR-1.2: Tenant Connection Flow)
 * PRD Reference: Lines 955-963 (azure_subscriptions table schema)
 *
 * Request Body:
 * {
 *   "tenantId": "uuid-of-tenant-in-database"
 * }
 *
 * Response (Success):
 * {
 *   "success": true,
 *   "discovered": 5,
 *   "subscriptions": [
 *     { id, subscription_id, name, status }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tenantId } = body

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required field: tenantId' },
        { status: 400 }
      )
    }

    // Fetch tenant from database (RLS ensures user can only access their org's tenants)
    const { data: tenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('id', tenantId)
      .single() as { data: any | null, error: any }

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Decrypt Azure client secret from vault
    let clientSecret: string
    try {
      clientSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
    } catch (error: any) {
      logSecureError('TenantDiscover', error, {
        endpoint: 'POST /api/tenants/discover',
        tenantId,
        operation: 'decrypt_secret'
      })
      return createSecureErrorResponse('Failed to retrieve credentials. Please reconnect this tenant.', 500)
    }

    // Create Azure credential
    const credential = new ClientSecretCredential(
      tenant.azure_tenant_id,
      tenant.azure_app_id,
      clientSecret
    )

    // Discover subscriptions
    const subscriptionClient = new SubscriptionClient(credential)
    const discoveredSubscriptions = []

    try {
      // @ts-ignore - Azure SDK type definitions may be incomplete
      for await (const subscription of subscriptionClient.subscriptions.list()) {
        discoveredSubscriptions.push({
          subscription_id: subscription.subscriptionId!,
          name: subscription.displayName || 'Unnamed Subscription',
          status: subscription.state || 'Unknown'
        })
      }
    } catch (error: any) {
      console.error('Failed to discover subscriptions:', error)

      // Update tenant status to failed
      await (supabase
        .from('azure_tenants')
        .update as any)({
          connection_status: 'failed',
          connection_error: 'Failed to discover subscriptions. Please verify credentials and permissions.'
        })
        .eq('id', tenantId)

      return NextResponse.json(
        { error: 'Failed to discover subscriptions. Please verify credentials have Reader access.' },
        { status: 500 }
      )
    }

    if (discoveredSubscriptions.length === 0) {
      // Update tenant status
      await (supabase
        .from('azure_tenants')
        .update as any)({
          connection_status: 'failed',
          connection_error: 'No subscriptions found. Service principal may not have access.'
        })
        .eq('id', tenantId)

      return NextResponse.json(
        { error: 'No subscriptions found for this tenant' },
        { status: 404 }
      )
    }

    // Store discovered subscriptions in database
    const subscriptionsToInsert = discoveredSubscriptions.map(sub => ({
      tenant_id: tenantId,
      subscription_id: sub.subscription_id,
      name: sub.name,
      status: sub.status
    }))

    // Use upsert to handle re-discovery (update existing subscriptions)
    const { data: insertedSubscriptions, error: insertError } = await (supabase
      .from('azure_subscriptions')
      .upsert as any)(subscriptionsToInsert, {
        onConflict: 'subscription_id',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('Failed to insert subscriptions:', insertError)
      return NextResponse.json(
        { error: 'Failed to save discovered subscriptions' },
        { status: 500 }
      )
    }

    // Update tenant last sync time and status
    await (supabase
      .from('azure_tenants')
      .update as any)({
        connection_status: 'connected',
        connection_error: null,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', tenantId)

    return NextResponse.json({
      success: true,
      discovered: discoveredSubscriptions.length,
      subscriptions: insertedSubscriptions || discoveredSubscriptions,
      message: `Successfully discovered ${discoveredSubscriptions.length} subscription(s)`
    })

  } catch (error: any) {
    logSecureError('TenantDiscover', error, {
      endpoint: 'POST /api/tenants/discover'
    })
    return createSecureErrorResponse('Failed to discover subscriptions', 500)
  }
}

/**
 * GET /api/tenants/discover?tenantId=uuid
 *
 * Retrieves stored subscriptions for a tenant.
 *
 * Response:
 * {
 *   "subscriptions": [
 *     { id, subscription_id, name, status, created_at }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: tenantId' },
        { status: 400 }
      )
    }

    // Fetch subscriptions for tenant (RLS via tenant lookup)
    const { data: subscriptions, error: subsError } = await supabase
      .from('azure_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (subsError) {
      console.error('Failed to fetch subscriptions:', subsError)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptions: subscriptions || []
    })

  } catch (error: any) {
    logSecureError('TenantDiscover', error, {
      endpoint: 'GET /api/tenants/discover'
    })
    return createSecureErrorResponse('Failed to fetch subscriptions', 500)
  }
}
