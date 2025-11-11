import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/alert-rules - List all alert rules for the user's organization
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userData } = await (supabase
      .from('users') as any)
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get tenant filter from query params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    // Build query
    let query = (supabase
      .from('alert_rules') as any)
      .select(`
        *,
        azure_tenants (
          id,
          name,
          azure_tenant_id
        )
      `)
      .eq('org_id', userData.org_id)
      .order('created_at', { ascending: false })

    // Filter by tenant if specified
    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    const { data: alertRules, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching alert rules:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch alert rules', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: alertRules })
  } catch (error) {
    console.error('Unexpected error in GET /api/alert-rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/alert-rules - Create a new alert rule
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userData } = await (supabase
      .from('users') as any)
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      tenant_id,
      name,
      type,
      threshold_amount,
      threshold_percent,
      notification_channels,
      status = 'active'
    } = body

    // Validate required fields
    if (!tenant_id || !name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: tenant_id, name, type' },
        { status: 400 }
      )
    }

    // Validate alert type
    const validTypes = ['THRESHOLD', 'PERCENTAGE_SPIKE', 'BUDGET', 'ANOMALY']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate thresholds based on type
    if (type === 'THRESHOLD' && !threshold_amount) {
      return NextResponse.json(
        { error: 'threshold_amount is required for THRESHOLD alerts' },
        { status: 400 }
      )
    }

    if ((type === 'PERCENTAGE_SPIKE' || type === 'BUDGET') && !threshold_percent) {
      return NextResponse.json(
        { error: 'threshold_percent is required for PERCENTAGE_SPIKE and BUDGET alerts' },
        { status: 400 }
      )
    }

    // Verify tenant belongs to user's organization
    const { data: tenant } = await (supabase
      .from('azure_tenants') as any)
      .select('id')
      .eq('id', tenant_id)
      .eq('org_id', userData.org_id)
      .single()

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or does not belong to your organization' },
        { status: 404 }
      )
    }

    // Create alert rule
    const { data: alertRule, error: createError } = await (supabase
      .from('alert_rules') as any)
      .insert({
        org_id: userData.org_id,
        tenant_id,
        name,
        type,
        threshold_amount,
        threshold_percent,
        notification_channels: notification_channels || { email: true },
        status
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating alert rule:', createError)
      return NextResponse.json(
        { error: 'Failed to create alert rule', details: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: alertRule }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/alert-rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
