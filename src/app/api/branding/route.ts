import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/branding
 * Get organization branding configuration
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch branding configuration
    const { data: branding, error: brandingError } = await supabase
      .from('organization_branding')
      .select('*')
      .eq('org_id', (userData as any).org_id)
      .single()

    if (brandingError && brandingError.code !== 'PGRST116') {
      // PGRST116 is "not found" error - that's ok
      return NextResponse.json(
        { error: 'Failed to fetch branding', details: brandingError.message },
        { status: 500 }
      )
    }

    // Return empty branding if not configured yet
    if (!branding) {
      return NextResponse.json({
        branding: {
          org_id: (userData as any).org_id,
          logo_url: null,
          primary_color: null,
          company_name: null,
        },
      })
    }

    return NextResponse.json({ branding })
  } catch (error) {
    console.error('Error fetching branding:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch branding',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/branding
 * Update organization branding configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org_id and verify admin role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admins can update branding
    if ((userData as any).role !== 'admin' && (userData as any).role !== 'owner') {
      return NextResponse.json(
        { error: 'Only administrators can update branding' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { logo_url, primary_color, company_name } = body

    // Validate color format if provided
    if (primary_color && !/^#[0-9A-Fa-f]{6}$/.test(primary_color)) {
      return NextResponse.json(
        { error: 'Invalid color format. Must be hex color (e.g., #0078D4)' },
        { status: 400 }
      )
    }

    // Check if branding exists
    const { data: existingBranding } = await supabase
      .from('organization_branding')
      .select('id')
      .eq('org_id', (userData as any).org_id)
      .single()

    let result

    if (existingBranding) {
      // Update existing branding
      const supabaseClient: any = supabase
      const { data, error } = await supabaseClient
        .from('organization_branding')
        .update({
          logo_url,
          primary_color,
          company_name,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', (userData as any).org_id)
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update branding', details: error.message },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new branding
      const { data, error } = await supabase
        .from('organization_branding')
        .insert({
          org_id: (userData as any).org_id,
          logo_url,
          primary_color,
          company_name,
        } as any)
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Failed to create branding', details: error.message },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({ branding: result })
  } catch (error) {
    console.error('Error updating branding:', error)
    return NextResponse.json(
      {
        error: 'Failed to update branding',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
