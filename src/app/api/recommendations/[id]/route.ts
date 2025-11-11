import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/recommendations/[id]
 * Update recommendation status (dismiss, implement, reactivate)
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

    // Verify recommendation exists and belongs to user's org
    const { data: existingRec, error: recError } = await supabase
      .from('optimization_recommendations')
      .select('*')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single()

    if (recError || !existingRec) {
      return NextResponse.json(
        { error: 'Recommendation not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { status } = body

    if (!status || !['active', 'dismissed', 'implemented'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, dismissed, or implemented' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'dismissed') {
      updates.dismissed_at = new Date().toISOString()
      updates.dismissed_by = user.id
    }

    if (status === 'implemented') {
      updates.implemented_at = new Date().toISOString()
    }

    if (status === 'active') {
      // Reactivating a dismissed/implemented recommendation
      updates.dismissed_at = null
      updates.dismissed_by = null
      updates.implemented_at = null
    }

    // Update recommendation
    const { data: updatedRec, error: updateError } = await (supabase
      .from('optimization_recommendations')
      .update as any)(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update recommendation:', updateError)
      return NextResponse.json(
        { error: 'Failed to update recommendation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      recommendation: updatedRec
    })

  } catch (error: any) {
    console.error('Update recommendation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/recommendations/[id]
 * Delete a recommendation permanently
 */
export async function DELETE(
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

    // Verify recommendation exists and belongs to user's org
    const { data: existingRec, error: recError } = await supabase
      .from('optimization_recommendations')
      .select('*')
      .eq('id', id)
      .eq('org_id', userData.org_id)
      .single()

    if (recError || !existingRec) {
      return NextResponse.json(
        { error: 'Recommendation not found or access denied' },
        { status: 404 }
      )
    }

    // Delete recommendation
    const { error: deleteError } = await supabase
      .from('optimization_recommendations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete recommendation:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete recommendation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Recommendation deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete recommendation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
