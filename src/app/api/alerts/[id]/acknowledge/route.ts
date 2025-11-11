import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Update alert to acknowledged status
    const { data: alert, error: updateError } = await (supabase
      .from('alert_history') as any)
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id
      })
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error acknowledging alert:', updateError)
      return NextResponse.json(
        { error: 'Failed to acknowledge alert' },
        { status: 500 }
      )
    }

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged successfully',
      alert
    })
  } catch (error: any) {
    console.error('Error in POST /api/alerts/[id]/acknowledge:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
