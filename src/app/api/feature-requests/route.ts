import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSecureError, createSecureErrorResponse, handleDatabaseError } from '@/lib/security/error-handler'
import { rateLimiters, applyRateLimit } from '@/lib/rate-limit'

// GET /api/feature-requests - Get all feature requests (public and user's org)
export async function GET(request: NextRequest) {
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
      logSecureError('FeatureRequestsAPI', userError || new Error('User data not found'), {
        userId: user.id,
        endpoint: 'GET /api/feature-requests'
      })
      return createSecureErrorResponse('User organization not found', 404)
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    // Build query
    let query = supabase
      .from('feature_requests')
      .select(`
        *,
        user_votes:feature_votes!feature_votes_feature_request_id_fkey(
          id,
          user_id
        )
      `)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data: featureRequests, error: fetchError } = await query

    if (fetchError) {
      return handleDatabaseError('FeatureRequestsAPI', fetchError, {
        endpoint: 'GET /api/feature-requests',
        operation: 'select'
      })
    }

    // Add user's vote status to each feature
    const featuresWithVoteStatus = (featureRequests || []).map((feature: any) => ({
      ...feature,
      user_has_voted: feature.user_votes?.some((vote: { user_id: string }) => vote.user_id === user.id) || false,
      user_votes: undefined // Remove votes array from response
    }))

    return NextResponse.json({ data: featuresWithVoteStatus })
  } catch (error) {
    logSecureError('FeatureRequestsAPI', error, {
      endpoint: 'GET /api/feature-requests'
    })
    return createSecureErrorResponse('Failed to fetch feature requests', 500)
  }
}

// POST /api/feature-requests - Create new feature request
export async function POST(request: NextRequest) {
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
      logSecureError('FeatureRequestsAPI', userError || new Error('User data not found'), {
        userId: user.id,
        endpoint: 'POST /api/feature-requests'
      })
      return createSecureErrorResponse('User organization not found', 404)
    }

    const orgId = (userData as { org_id: string }).org_id

    // Parse request body
    const body = await request.json()
    const { title, description, category } = body

    // Validate required fields
    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, category' },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = ['integration', 'analytics', 'alerts', 'ui', 'automation', 'other']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Create feature request
    const { data: newFeature, error: createError } = await supabase
      .from('feature_requests')
      .insert({
        org_id: orgId,
        user_id: user.id,
        title,
        description,
        category,
        status: 'submitted'
      } as any)
      .select()
      .single()

    if (createError) {
      return handleDatabaseError('FeatureRequestsAPI', createError, {
        endpoint: 'POST /api/feature-requests',
        operation: 'insert'
      })
    }

    return NextResponse.json({ data: newFeature }, { status: 201 })
  } catch (error) {
    logSecureError('FeatureRequestsAPI', error, {
      endpoint: 'POST /api/feature-requests'
    })
    return createSecureErrorResponse('Failed to create feature request', 500)
  }
}
