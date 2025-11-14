import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { encryptAzureClientSecret } from '@/lib/encryption/vault'
import { logSecureError, createSecureErrorResponse, handleAzureError } from '@/lib/security/error-handler'

/**
 * POST /api/tenants/connect
 *
 * Creates a new Azure tenant connection and stores credentials securely.
 * Validates credentials, stores tenant info, and auto-discovers subscriptions.
 *
 * PRD Reference: Lines 266-287 (Feature 1: Multi-Tenant Authentication & Onboarding)
 *
 * Request Body:
 * {
 *   "name": "Acme Corp - Production",
 *   "azureTenantId": "tenant-guid",
 *   "azureAppId": "app-guid",
 *   "azureClientSecret": "secret-value"
 * }
 *
 * Response (Success):
 * {
 *   "success": true,
 *   "tenant": { id, name, connection_status, ... },
 *   "message": "Tenant connected successfully"
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

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null, error: any }

    if (userError || !userData) {
      logSecureError('TenantConnect', userError || new Error('User data not found'), {
        userId: user.id,
        endpoint: 'POST /api/tenants/connect'
      })
      return createSecureErrorResponse('User organization not found', 404)
    }

    const body = await request.json()
    const { name, azureTenantId, azureAppId, azureClientSecret } = body

    // Validate input
    if (!name || !azureTenantId || !azureAppId || !azureClientSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: name, azureTenantId, azureAppId, or azureClientSecret' },
        { status: 400 }
      )
    }

    // Check if tenant already exists for this organization
    const { data: existingTenant } = await supabase
      .from('azure_tenants')
      .select('id')
      .eq('org_id', userData.org_id)
      .eq('azure_tenant_id', azureTenantId)
      .single()

    if (existingTenant) {
      return NextResponse.json(
        { error: 'This Azure tenant is already connected to your organization' },
        { status: 409 }
      )
    }

    // Validate credentials before storing
    let subscriptionCount = 0
    try {
      const credential = new ClientSecretCredential(
        azureTenantId,
        azureAppId,
        azureClientSecret
      )

      // Get access token for Azure Management API
      const token = await credential.getToken('https://management.azure.com/.default')

      // Call Azure REST API directly to list subscriptions
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
      const subscriptions = data.value || []
      subscriptionCount = subscriptions.length

      if (subscriptionCount === 0) {
        return NextResponse.json(
          { error: 'No Azure subscriptions found. Service principal may not have access.' },
          { status: 400 }
        )
      }
    } catch (error: any) {
      return handleAzureError('TenantConnect', error, {
        endpoint: 'POST /api/tenants/connect',
        tenantId: azureTenantId
      })
    }

    // Encrypt client secret using application-level encryption
    // PRD Reference: Line 300 - "Store credentials encrypted (AES-256)"
    let encryptedSecret: string
    try {
      encryptedSecret = await encryptAzureClientSecret(azureClientSecret, name)
      console.log('✅ Successfully encrypted Azure client secret')
    } catch (error: any) {
      logSecureError('TenantConnect', error, {
        endpoint: 'POST /api/tenants/connect',
        operation: 'encrypt_secret'
      })
      return createSecureErrorResponse('Failed to securely store credentials. Please try again.', 500)
    }

    // Insert tenant into database with encrypted secret
    const { data: tenant, error: insertError } = await (supabase
      .from('azure_tenants')
      .insert as any)({
        org_id: userData.org_id,
        name,
        azure_tenant_id: azureTenantId,
        azure_app_id: azureAppId,
        azure_client_secret: encryptedSecret, // Encrypted in format: iv:authTag:ciphertext
        connection_status: 'connected',
        last_sync_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert tenant:', insertError)
      return NextResponse.json(
        { error: 'Failed to save tenant connection' },
        { status: 500 }
      )
    }

    // Return success with tenant info (excluding secret)
    const { azure_client_secret, ...tenantResponse } = tenant

    return NextResponse.json({
      success: true,
      tenant: tenantResponse,
      subscriptionCount,
      message: 'Tenant connected successfully. Subscription discovery will begin shortly.'
    }, { status: 201 })

  } catch (error: any) {
    logSecureError('TenantConnect', error, {
      endpoint: 'POST /api/tenants/connect'
    })
    return createSecureErrorResponse('Failed to connect tenant', 500)
  }
}

/**
 * GET /api/tenants/connect
 *
 * Lists all connected Azure tenants for the current user's organization.
 *
 * Response:
 * {
 *   "tenants": [
 *     { id, name, azure_tenant_id, connection_status, last_sync_at, ... }
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

    // Fetch tenants (RLS automatically filters by org_id)
    const { data: tenants, error: tenantsError } = await supabase
      .from('azure_tenants')
      .select('id, org_id, name, azure_tenant_id, connection_status, connection_error, last_sync_at, credentials_expire_at, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (tenantsError) {
      console.error('Failed to fetch tenants:', tenantsError)
      return NextResponse.json(
        { error: 'Failed to fetch tenants' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tenants: tenants || []
    })

  } catch (error: any) {
    logSecureError('TenantConnect', error, {
      endpoint: 'GET /api/tenants/connect'
    })
    return createSecureErrorResponse('Failed to fetch tenants', 500)
  }
}
