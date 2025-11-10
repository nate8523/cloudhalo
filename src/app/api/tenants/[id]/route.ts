import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptAzureClientSecret, decryptAzureClientSecret } from '@/lib/encryption/vault'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/tenants/[id]
 * Fetch a specific tenant's details with decrypted credentials
 */
export async function GET(
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

    // Decrypt the client secret before returning
    let decryptedSecret: string
    try {
      decryptedSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
    } catch (decryptError: any) {
      console.error('Failed to decrypt client secret:', decryptError)
      // Return tenant but mask the secret if decryption fails
      return NextResponse.json({
        ...tenant,
        azure_client_secret: '********' // Masked
      })
    }

    return NextResponse.json({
      ...tenant,
      azure_client_secret: decryptedSecret
    })

  } catch (error: any) {
    console.error('Fetch tenant error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/tenants/[id]
 * Update tenant settings with proper encryption
 */
export async function PATCH(
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

    // Fetch existing tenant to verify ownership
    const { data: existingTenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single() as { data: any | null, error: any }

    if (tenantError || !existingTenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      azure_tenant_id,
      azure_app_id,
      azure_client_secret,
      credentials_expire_at
    } = body

    // Handle client secret encryption if provided
    let encryptedSecret: string | undefined
    if (azure_client_secret !== undefined && azure_client_secret !== '') {
      try {
        // Encrypt the new client secret
        encryptedSecret = await encryptAzureClientSecret(azure_client_secret, name || existingTenant.name)
      } catch (encryptError: any) {
        console.error('Failed to encrypt client secret:', encryptError)
        return NextResponse.json(
          { error: 'Failed to encrypt credentials' },
          { status: 500 }
        )
      }
    }

    // Build update query dynamically
    let updateQuery = supabase
      .from('azure_tenants')
      .update({
        updated_at: new Date().toISOString(),
        ...(name !== undefined && { name }),
        ...(azure_tenant_id !== undefined && { azure_tenant_id }),
        ...(azure_app_id !== undefined && { azure_app_id }),
        ...(credentials_expire_at !== undefined && { credentials_expire_at }),
        ...(encryptedSecret !== undefined && { azure_client_secret: encryptedSecret })
      } as any)
      .eq('id', id)
      .select()
      .single()

    // Update tenant
    const { data: updatedTenant, error: updateError } = await updateQuery

    if (updateError) {
      console.error('Failed to update tenant:', updateError)
      return NextResponse.json(
        { error: 'Failed to update tenant' },
        { status: 500 }
      )
    }

    // Return updated tenant without exposing the encrypted secret
    const { azure_client_secret: _, ...tenantResponse } = updatedTenant

    return NextResponse.json({
      success: true,
      tenant: tenantResponse
    })

  } catch (error: any) {
    console.error('Update tenant error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
