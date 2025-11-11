import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { decryptAzureClientSecret } from '@/lib/encryption/vault'
import { generateRecommendations } from '@/lib/azure/recommendation-engine'
import type { Database } from '@/types/database'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

type AzureResource = Database['public']['Tables']['azure_resources']['Row']
type CostSnapshot = Database['public']['Tables']['cost_snapshots']['Row']
type RecommendationInsert = Database['public']['Tables']['optimization_recommendations']['Insert']

/**
 * POST /api/tenants/[id]/sync-recommendations
 * Generate and sync optimization recommendations for a tenant
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: tenantId } = await context.params
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
      .eq('id', tenantId)
      .eq('org_id', userData.org_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch all resources for this tenant
    const { data: resources, error: resourcesError } = await supabase
      .from('azure_resources')
      .select('*')
      .eq('tenant_id', tenantId) as { data: AzureResource[] | null, error: any }

    if (resourcesError) {
      console.error('Failed to fetch resources:', resourcesError)
      return NextResponse.json(
        { error: 'Failed to fetch resources' },
        { status: 500 }
      )
    }

    if (!resources || resources.length === 0) {
      return NextResponse.json({
        message: 'No resources found for this tenant. Run resource discovery first.',
        recommendations_created: 0,
      })
    }

    // Fetch cost data for the last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: costSnapshots, error: costError } = await supabase
      .from('cost_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0]) as { data: CostSnapshot[] | null, error: any }

    if (costError) {
      console.error('Failed to fetch cost data:', costError)
      return NextResponse.json(
        { error: 'Failed to fetch cost data' },
        { status: 500 }
      )
    }

    // Generate recommendations using the recommendation engine
    const recommendations = generateRecommendations(
      resources,
      costSnapshots || []
    )

    if (recommendations.length === 0) {
      return NextResponse.json({
        message: 'No optimization opportunities found',
        recommendations_created: 0,
      })
    }

    // Get subscription IDs for resources (we'll use the first subscription found)
    const subscriptionId = resources[0]?.subscription_id || 'unknown'

    // Expire old recommendations for these resources before inserting new ones
    const resourceIds = recommendations.map((r) => r.resource_id)

    const { error: expireError } = await (supabase
      .from('optimization_recommendations')
      .update as any)({
        status: 'expired',
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .in('resource_id', resourceIds)
      .eq('status', 'active')

    if (expireError) {
      console.error('Warning: Failed to expire old recommendations:', expireError)
      // Continue anyway - this is not critical
    }

    // Insert new recommendations
    const recommendationsToInsert: RecommendationInsert[] = recommendations.map((rec) => ({
      org_id: userData.org_id,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      recommendation_type: rec.recommendation_type,
      severity: rec.severity,
      title: rec.title,
      description: rec.description,
      resource_id: rec.resource_id,
      resource_name: rec.resource_name,
      resource_type: rec.resource_type,
      resource_group: rec.resource_group,
      location: rec.location,
      current_monthly_cost_usd: rec.current_monthly_cost_usd,
      potential_monthly_savings_usd: rec.potential_monthly_savings_usd,
      potential_annual_savings_usd: rec.potential_annual_savings_usd,
      metrics: rec.metrics,
      suggested_action: rec.suggested_action,
      implementation_effort: rec.implementation_effort,
      status: 'active',
      detected_at: new Date().toISOString(),
      last_evaluated_at: new Date().toISOString(),
    }))

    const { data: insertedRecs, error: insertError } = await supabase
      .from('optimization_recommendations')
      .insert(recommendationsToInsert)
      .select()

    if (insertError) {
      console.error('Failed to insert recommendations:', insertError)
      return NextResponse.json(
        { error: 'Failed to save recommendations' },
        { status: 500 }
      )
    }

    // Calculate summary
    const totalMonthlySavings = recommendations.reduce(
      (sum, r) => sum + r.potential_monthly_savings_usd,
      0
    )
    const totalAnnualSavings = recommendations.reduce(
      (sum, r) => sum + r.potential_annual_savings_usd,
      0
    )

    return NextResponse.json({
      success: true,
      message: 'Recommendations generated successfully',
      recommendations_created: insertedRecs?.length || 0,
      summary: {
        total_recommendations: recommendations.length,
        total_monthly_savings: totalMonthlySavings,
        total_annual_savings: totalAnnualSavings,
        by_severity: {
          high: recommendations.filter((r) => r.severity === 'high').length,
          medium: recommendations.filter((r) => r.severity === 'medium').length,
          low: recommendations.filter((r) => r.severity === 'low').length,
        },
        by_type: recommendations.reduce((acc, r) => {
          acc[r.recommendation_type] = (acc[r.recommendation_type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
    })

  } catch (error: any) {
    console.error('Sync recommendations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
