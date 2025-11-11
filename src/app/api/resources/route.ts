/**
 * Resources API Endpoint
 *
 * GET /api/resources - List all resources with optional filtering
 *
 * Query parameters:
 * - tenantId: Filter by tenant ID
 * - subscriptionId: Filter by subscription ID
 * - resourceType: Filter by resource type
 * - resourceGroup: Filter by resource group
 * - location: Filter by location
 * - tag: Filter by tag key
 * - tagValue: Filter by tag value (requires tag parameter)
 * - search: Search in resource name or ID
 * - limit: Maximum number of results (default 100, max 1000)
 * - offset: Pagination offset (default 0)
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const subscriptionId = searchParams.get('subscriptionId')
    const resourceType = searchParams.get('resourceType')
    const resourceGroup = searchParams.get('resourceGroup')
    const location = searchParams.get('location')
    const tag = searchParams.get('tag')
    const tagValue = searchParams.get('tagValue')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('azure_resources')
      .select('*', { count: 'exact' })
      .eq('org_id', userData.org_id)

    // Apply filters
    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    if (subscriptionId) {
      query = query.eq('subscription_id', subscriptionId)
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    if (resourceGroup) {
      query = query.eq('resource_group', resourceGroup)
    }

    if (location) {
      query = query.eq('location', location)
    }

    if (tag) {
      if (tagValue) {
        // Filter by tag key and value
        query = query.contains('tags', { [tag]: tagValue })
      } else {
        // Filter by tag key existence using a JSONB path query
        // This will match any resource that has the specified tag key
        query = query.not('tags', 'is', null)
      }
    }

    if (search) {
      // Search in resource name or resource ID
      query = query.or(`resource_name.ilike.%${search}%,resource_id.ilike.%${search}%`)
    }

    // Apply pagination
    query = query
      .order('resource_type', { ascending: true })
      .order('resource_name', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: resources, error: queryError, count } = await query

    if (queryError) {
      console.error('[Resources API] Query error:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch resources' },
        { status: 500 }
      )
    }

    // Get summary statistics
    const { data: stats } = await supabase
      .from('azure_resources')
      .select('resource_type, tenant_id, location')
      .eq('org_id', userData.org_id)

    let resourceTypeCounts: Record<string, number> = {}
    let tenantCounts: Record<string, number> = {}
    let locationCounts: Record<string, number> = {}

    if (stats) {
      resourceTypeCounts = stats.reduce((acc, r) => {
        acc[r.resource_type] = (acc[r.resource_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      tenantCounts = stats.reduce((acc, r) => {
        acc[r.tenant_id] = (acc[r.tenant_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      locationCounts = stats.reduce((acc, r) => {
        if (r.location) {
          acc[r.location] = (acc[r.location] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)
    }

    return NextResponse.json({
      success: true,
      data: resources || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      summary: {
        totalResources: count || 0,
        resourceTypeCounts,
        tenantCounts,
        locationCounts
      }
    })

  } catch (error: any) {
    console.error('[Resources API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
