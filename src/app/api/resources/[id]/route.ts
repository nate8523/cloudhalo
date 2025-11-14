/**
 * Resource Detail API
 *
 * Fetches detailed information for a specific Azure resource including:
 * - Full resource metadata
 * - Cost history over time
 * - Related resources in the same resource group
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSecureError, createSecureErrorResponse } from '@/lib/security/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
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

    const resourceId = params.id

    // Fetch resource details with RLS
    const { data: resource, error: resourceError } = (await supabase
      .from('azure_resources')
      .select('*')
      .eq('id', resourceId)
      .eq('org_id', userData.org_id)
      .single()) as { data: any; error: any }

    if (resourceError || !resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    // Fetch cost history for this resource (last 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: costHistory, error: costError } = (await supabase
      .from('cost_snapshots')
      .select('date, cost_usd')
      .eq('org_id', userData.org_id)
      .eq('resource_id', resource.resource_id)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true })) as { data: any; error: any }

    if (costError) {
      console.error('[ResourceDetail] Error fetching cost history:', costError)
    }

    // Calculate cost summary
    const totalCost = costHistory?.reduce((sum: number, item: any) => sum + item.cost_usd, 0) || 0
    const avgDailyCost = costHistory && costHistory.length > 0
      ? totalCost / costHistory.length
      : 0
    const lastDayCost = costHistory && costHistory.length > 0
      ? costHistory[costHistory.length - 1].cost_usd
      : 0

    // Fetch related resources in the same resource group
    const { data: relatedResources, error: relatedError } = (await supabase
      .from('azure_resources')
      .select('id, resource_name, resource_type, provisioning_state, sku')
      .eq('org_id', userData.org_id)
      .eq('tenant_id', resource.tenant_id)
      .eq('subscription_id', resource.subscription_id)
      .eq('resource_group', resource.resource_group)
      .neq('id', resourceId)
      .order('resource_name', { ascending: true })
      .limit(10)) as { data: any; error: any }

    if (relatedError) {
      console.error('[ResourceDetail] Error fetching related resources:', relatedError)
    }

    // Fetch tenant and subscription information for context
    const { data: tenant } = (await supabase
      .from('azure_tenants')
      .select('id, name')
      .eq('id', resource.tenant_id)
      .single()) as { data: any }

    const { data: subscription } = (await supabase
      .from('azure_subscriptions')
      .select('subscription_id, name, display_name')
      .eq('tenant_id', resource.tenant_id)
      .eq('subscription_id', resource.subscription_id)
      .single()) as { data: any }

    return NextResponse.json({
      success: true,
      data: {
        resource,
        tenant,
        subscription,
        costSummary: {
          total: totalCost,
          avgDaily: avgDailyCost,
          lastDay: lastDayCost,
          currency: 'USD'
        },
        costHistory: costHistory || [],
        relatedResources: relatedResources || []
      }
    })

  } catch (error) {
    logSecureError('ResourceDetail', error, {
      endpoint: 'GET /api/resources/[id]',
      resourceId: params.id
    })
    return createSecureErrorResponse('Internal server error', 500)
  }
}
