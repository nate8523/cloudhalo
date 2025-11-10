// src/app/api/tenants/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptAzureClientSecret, decryptAzureClientSecret } from '@/lib/encryption/vault'
import type { Database } from '@/lib/supabase/types'

type AzureTenantRow = Database['public']['Tables']['azure_tenants']['Row']
type AzureTenantUpdate = Database['public']['Tables']['azure_tenants']['Update']
type UserRow = Database['public']['Tables']['users']['Row']

/**
 * GET /api/tenants/[id]
 * Fetch a specific tenant's details with decrypted credentials
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient<Database>()

    // Get authenticated user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userData, error: userTableError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single<UserRow>()

    if (userTableError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch tenant with RLS protection
    const { data: tenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single<AzureTenantRow>()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found or access denied' }, { status: 404 })
    }

    // Decrypt the client secret before returning
    try {
      const decryptedSecret = await decryptAzureClientSecret(tenant.azure_client_secret)
      return NextResponse.json({
        ...tenant,
        azure_client_secret: decryptedSecret
      })
    } catch (decryptError: any) {
      console.error('Failed to decrypt client secret:', decryptError)
      // Return tenant but mask the secret if decryption fails
      return NextResponse.json({
        ...tenant,
        azure_client_secret: '********' // Masked
      })
    }
  } catch (error: any) {
    console.error('Fetch tenant error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient<Database>()

    // Get authenticated user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userData, error: userTableError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single<UserRow>()

    if (userTableError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch existing tenant to verify ownership (and to get the current name if needed)
    const { data: existingTenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single<AzureTenantRow>()

    if (tenantError || !existingTenant) {
      return NextResponse.json({ error: 'Tenant not found or access denied' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      azure_tenant_id,
      azure_app_id,
      azure_client_secret,
      credentials_expire_at
    }: Partial<AzureTenantRow> & {
      azure_client_secret?: string
    } = body ?? {}

    // Prepare update data as the table's Update type
    const updateData: AzureTenantUpdate = {
      // only set fields that were provided to avoid overwriting with undefined
      ...(name !== undefined ? { name } : {}),
      ...(azure_tenant_id !== undefined ? { azure_tenant_id } : {}),
      ...(azure_app_id !== undefined ? { azure_app_id } : {}),
      ...(credentials_expire_at !== undefined ? { credentials_expire_at } : {}),
      updated_at: new Date().toISOString()
    }

    // Handle client secret encryption if provided (non-empty string)
    if (azure_client_secret !== undefined && azure_client_secret !== '') {
      try {
        const encryptedSecret = await encryptAzureClientSecret(
          azure_client_secret,
          name ?? existingTenant.name
        )
        updateData.azure_client_secret = encryptedSecret
      } catch (encryptError: any) {
        console.error('Failed to encrypt client secret:', encryptError)
        return NextResponse.json(
          { error: 'Failed to encrypt credentials' },
          { status: 500 }
        )
      }
    }

    // Update tenant — note the typed payload prevents the "never" error
    const { data: updatedTenant, error: updateError } = await supabase
      .from('azure_tenants')
      .update(updateData) // <-- typed as AzureTenantUpdate
      .eq('id', id)
      .select('*')
      .single<AzureTenantRow>()

    if (updateError || !updatedTenant) {
      console.error('Failed to update tenant:', updateError)
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 })
    }

    // Return updated tenant without exposing the encrypted secret
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { azure_client_secret: _secret, ...tenantResponse } = updatedTenant

    return NextResponse.json({
      success: true,
      tenant: tenantResponse
    })
  } catch (error: any) {
    console.error('Update tenant error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
