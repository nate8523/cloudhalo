import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/alert-rules/[id] - Get a specific alert rule
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Fetch alert rule
    const { data: alertRule, error: fetchError } = await (supabase
      .from('alert_rules') as any)
      .select(`
        *,
        azure_tenants (
          id,
          name,
          azure_tenant_id
        )
      `)
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single()

    if (fetchError || !alertRule) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    return NextResponse.json({ data: alertRule })
  } catch (error) {
    console.error('Unexpected error in GET /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/alert-rules/[id] - Update an alert rule
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify alert rule exists and belongs to org
    const { data: existingRule } = await (supabase
      .from('alert_rules') as any)
      .select('id')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single()

    if (!existingRule) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      type,
      threshold_amount,
      threshold_percent,
      notification_channels,
      status
    } = body

    // Build update object (only include provided fields)
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (type !== undefined) {
      const validTypes = ['THRESHOLD', 'PERCENTAGE_SPIKE', 'BUDGET', 'ANOMALY']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.type = type
    }
    if (threshold_amount !== undefined) updateData.threshold_amount = threshold_amount
    if (threshold_percent !== undefined) updateData.threshold_percent = threshold_percent
    if (notification_channels !== undefined) updateData.notification_channels = notification_channels
    if (status !== undefined) {
      const validStatuses = ['active', 'paused']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be either "active" or "paused"' },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    // Update alert rule
    const { data: alertRule, error: updateError } = await (supabase
      .from('alert_rules') as any)
      .update(updateData)
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating alert rule:', updateError)
      return NextResponse.json(
        { error: 'Failed to update alert rule', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: alertRule })
  } catch (error) {
    console.error('Unexpected error in PUT /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/alert-rules/[id] - Delete an alert rule
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Delete alert rule (RLS will ensure it belongs to the org)
    const { error: deleteError } = await (supabase
      .from('alert_rules') as any)
      .delete()
      .eq('id', id)
      .eq('org_id', userData.org_id)

    if (deleteError) {
      console.error('Error deleting alert rule:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete alert rule', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Alert rule deleted successfully' })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
