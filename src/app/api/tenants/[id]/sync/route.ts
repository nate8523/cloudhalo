import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
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

    // Fetch tenant with RLS protection
    const { data: tenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single() as { data: any | null, error: any }

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Test Azure connection and discover subscriptions
    try {
      // Decrypt the client secret before using it
      let clientSecret: string
      try {
        clientSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
      } catch (decryptError: any) {
        console.error('Failed to decrypt client secret:', decryptError)
        return NextResponse.json(
          { error: 'Failed to decrypt credentials. Please update tenant settings.' },
          { status: 500 }
        )
      }

      // Create credential object
      const credential = new ClientSecretCredential(
        tenant.azure_tenant_id,
        tenant.azure_app_id,
        clientSecret
      )

      // Get access token for Azure Management API
      const token = await credential.getToken('https://management.azure.com/.default')

      // Set timeout for Azure API call (30 seconds for sync - longer than validation)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Azure API timeout')), 30000)
      })

      // Call Azure REST API to list subscriptions
      const subscriptionsPromise = (async () => {
        const response = await fetch(
          'https://management.azure.com/subscriptions?api-version=2022-12-01',
          {
            headers: {
              'Authorization': `Bearer ${token.token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!response.ok) {
          throw new Error(`Azure API returned ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return data.value || []
      })()

      // Race between API call and timeout
      const azureSubscriptions = await Promise.race([
        subscriptionsPromise,
        timeoutPromise
      ]) as any[]

      // Process subscriptions
      const subscriptions = azureSubscriptions.map((sub: any) => ({
        subscription_id: sub.subscriptionId || '',
        name: sub.displayName || sub.subscriptionId || 'Unnamed Subscription',
        display_name: sub.displayName,
        state: sub.state,
        subscription_policies: sub.subscriptionPolicies,
        tags: sub.tags
      }))

      // Update tenant status
      const { error: updateError } = await (supabase
        .from('azure_tenants')
        .update as any)({
          connection_status: 'connected',
          connection_error: null,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) {
        console.error('Error updating tenant status:', updateError)
      }

      // Upsert subscriptions
      if (subscriptions.length > 0) {
        for (const sub of subscriptions) {
          const { error: upsertError } = await (supabase
            .from('azure_subscriptions')
            .upsert as any)(
              {
                tenant_id: id,
                subscription_id: sub.subscription_id,
                name: sub.name,
                display_name: sub.display_name,
                state: sub.state,
                subscription_policies: sub.subscription_policies,
                tags: sub.tags,
                last_synced_at: new Date().toISOString()
              },
              {
                onConflict: 'subscription_id'
              }
            )

          if (upsertError) {
            console.error('Error upserting subscription:', upsertError)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Sync completed successfully',
        subscriptionsFound: subscriptions.length,
        lastSyncAt: new Date().toISOString()
      })

    } catch (azureError: any) {
      console.error('Azure sync error:', azureError)
      console.error('Error details:', {
        message: azureError.message,
        code: azureError.code,
        statusCode: azureError.statusCode
      })

      // Parse error message
      let errorMessage = 'Failed to connect to Azure'

      if (azureError.message?.includes('AADSTS')) {
        if (azureError.message.includes('AADSTS700016')) {
          errorMessage = 'Invalid application (client) ID'
        } else if (azureError.message.includes('AADSTS7000215')) {
          errorMessage = 'Invalid client secret'
        } else if (azureError.message.includes('AADSTS90002')) {
          errorMessage = 'Invalid tenant ID'
        } else {
          errorMessage = 'Azure AD authentication failed'
        }
      } else if (azureError.message?.includes('timeout')) {
        errorMessage = 'Azure API timeout. Please try again.'
      } else if (azureError.statusCode === 403) {
        errorMessage = 'Insufficient permissions'
      }

      // Update tenant with error status
      await (supabase
        .from('azure_tenants')
        .update as any)({
          connection_status: 'failed',
          connection_error: errorMessage
        })
        .eq('id', id)

      return NextResponse.json(
        {
          error: errorMessage,
          details: azureError.message || 'Failed to connect to Azure'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
