import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/**
 * GET /api/recommendations
 * Fetch optimization recommendations for the user's organization
 *
 * Query params:
 * - tenant_id: Filter by specific tenant (optional)
 * - status: Filter by status (active, dismissed, implemented) (optional)
 * - severity: Filter by severity (low, medium, high) (optional)
 * - type: Filter by recommendation type (optional)
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')
    const status = searchParams.get('status') || 'active'
    const severity = searchParams.get('severity')
    const type = searchParams.get('type')

    // Build query
    let query = supabase
      .from('optimization_recommendations')
      .select('*')
      .eq('org_id', userData.org_id)
      .eq('status', status)
      .order('potential_monthly_savings_usd', { ascending: false })

    // Apply filters
    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }
    if (type) {
      query = query.eq('recommendation_type', type)
    }

    const { data: recommendations, error: fetchError } = await query as {
      data: Database['public']['Tables']['optimization_recommendations']['Row'][] | null
      error: any
    }

    if (fetchError) {
      console.error('Failed to fetch recommendations:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch recommendations' },
        { status: 500 }
      )
    }

    // Calculate summary statistics
    const summary = {
      total_recommendations: recommendations?.length || 0,
      total_potential_monthly_savings: recommendations?.reduce(
        (sum, r) => sum + (r.potential_monthly_savings_usd || 0),
        0
      ) || 0,
      total_potential_annual_savings: recommendations?.reduce(
        (sum, r) => sum + (r.potential_annual_savings_usd || 0),
        0
      ) || 0,
      by_severity: {
        high: recommendations?.filter((r) => r.severity === 'high').length || 0,
        medium: recommendations?.filter((r) => r.severity === 'medium').length || 0,
        low: recommendations?.filter((r) => r.severity === 'low').length || 0,
      },
      by_type: recommendations?.reduce((acc, r) => {
        acc[r.recommendation_type] = (acc[r.recommendation_type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
    }

    return NextResponse.json({
      recommendations: recommendations || [],
      summary,
    })

  } catch (error: any) {
    console.error('Fetch recommendations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recommendations
 * Manually trigger recommendation generation (admin/testing only)
 * In production, this would be called by a background job
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body = await request.json()
    const { tenant_id } = body

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      )
    }

    // Verify tenant belongs to user's org
    const { data: tenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('*')
      .eq('id', tenant_id)
      .eq('org_id', userData.org_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Trigger recommendation generation
    // This would be implemented as a background job in production
    return NextResponse.json({
      message: 'Recommendation generation triggered',
      tenant_id,
    })

  } catch (error: any) {
    console.error('Generate recommendations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
