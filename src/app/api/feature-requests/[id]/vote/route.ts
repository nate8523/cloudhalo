import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSecureError, createSecureErrorResponse, handleDatabaseError } from '@/lib/security/error-handler'
import { rateLimiters, applyRateLimit } from '@/lib/rate-limit'

// POST /api/feature-requests/[id]/vote - Vote for a feature request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, rateLimiters.api, 'user')
    if (rateLimitResult) return rateLimitResult

    // Authenticate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

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
      logSecureError('FeatureVoteAPI', userError || new Error('User data not found'), {
        userId: user.id,
        endpoint: 'POST /api/feature-requests/[id]/vote'
      })
      return createSecureErrorResponse('User organization not found', 404)
    }

    const orgId = userData.org_id
    const { id: featureRequestId } = await params

    // Check if feature request exists
    const { data: feature, error: featureError } = await supabase
      .from('feature_requests')
      .select('id')
      .eq('id', featureRequestId)
      .single()

    if (featureError || !feature) {
      return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
    }

    // Check if user has already voted
    const { data: existingVote, error: voteCheckError } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feature_request_id', featureRequestId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (voteCheckError) {
      return handleDatabaseError('FeatureVoteAPI', voteCheckError, {
        endpoint: 'POST /api/feature-requests/[id]/vote',
        operation: 'select'
      })
    }

    if (existingVote) {
      return NextResponse.json({ error: 'You have already voted for this feature' }, { status: 400 })
    }

    // Create vote
    const { data: newVote, error: createError } = await supabase
      .from('feature_votes')
      .insert({
        feature_request_id: featureRequestId,
        user_id: user.id,
        org_id: orgId
      } as any)
      .select()
      .single()

    if (createError) {
      return handleDatabaseError('FeatureVoteAPI', createError, {
        endpoint: 'POST /api/feature-requests/[id]/vote',
        operation: 'insert'
      })
    }

    return NextResponse.json({ data: newVote }, { status: 201 })
  } catch (error) {
    logSecureError('FeatureVoteAPI', error, {
      endpoint: 'POST /api/feature-requests/[id]/vote'
    })
    return createSecureErrorResponse('Failed to vote for feature', 500)
  }
}

// DELETE /api/feature-requests/[id]/vote - Remove vote from a feature request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, rateLimiters.api, 'user')
    if (rateLimitResult) return rateLimitResult

    // Authenticate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: featureRequestId } = await params

    // Delete vote (RLS will ensure user can only delete their own vote)
    const { error: deleteError } = await supabase
      .from('feature_votes')
      .delete()
      .eq('feature_request_id', featureRequestId)
      .eq('user_id', user.id)

    if (deleteError) {
      return handleDatabaseError('FeatureVoteAPI', deleteError, {
        endpoint: 'DELETE /api/feature-requests/[id]/vote',
        operation: 'delete'
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logSecureError('FeatureVoteAPI', error, {
      endpoint: 'DELETE /api/feature-requests/[id]/vote'
    })
    return createSecureErrorResponse('Failed to remove vote', 500)
  }
}
