/**
 * Resources Export API
 *
 * Exports resource inventory to CSV format
 * Supports filtering by tenant, resource type, location, and search
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeCsvValue } from '@/lib/utils'

export async function GET(request: NextRequest) {
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
    const { data: userData } = (await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()) as { data: { org_id: string } | null }

    if (!userData?.org_id) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId') // Single resource export
    const tenantId = searchParams.get('tenantId')
    const resourceType = searchParams.get('resourceType')
    const location = searchParams.get('location')
    const search = searchParams.get('search')

    // Handle single resource export with cost history
    if (resourceId) {
      return await exportSingleResourceWithCosts(supabase, userData.org_id, resourceId)
    }

    // Build query for bulk export
    let query = supabase
      .from('azure_resources')
      .select('*')
      .eq('org_id', userData.org_id)
      .order('resource_name', { ascending: true })

    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    if (location) {
      query = query.eq('location', location)
    }

    if (search) {
      query = query.or(`resource_name.ilike.%${search}%,resource_id.ilike.%${search}%`)
    }

    const { data: resources, error: resourcesError } = (await query) as { data: any; error: any }

    if (resourcesError) {
      console.error('[ResourcesExport] Error fetching resources:', resourcesError)
      return NextResponse.json(
        { error: 'Failed to fetch resources' },
        { status: 500 }
      )
    }

    // Generate CSV content
    const headers = [
      'Resource Name',
      'Resource Type',
      'Resource Group',
      'Location',
      'SKU',
      'Kind',
      'Provisioning State',
      'Power State',
      'Subscription ID',
      'Resource ID',
      'Tags',
      'Last Synced At'
    ]

    const csvRows = [headers.join(',')]

    for (const resource of resources || []) {
      const tags = resource.tags
        ? Object.entries(resource.tags as Record<string, string>)
            .map(([key, value]) => `${key}:${value}`)
            .join(';')
        : ''

      const row = [
        escapeCsvField(resource.resource_name),
        escapeCsvField(resource.resource_type),
        escapeCsvField(resource.resource_group),
        escapeCsvField(resource.location || ''),
        escapeCsvField(resource.sku || ''),
        escapeCsvField(resource.kind || ''),
        escapeCsvField(resource.provisioning_state || ''),
        escapeCsvField(resource.power_state || ''),
        escapeCsvField(resource.subscription_id),
        escapeCsvField(resource.resource_id),
        escapeCsvField(tags),
        escapeCsvField(resource.last_synced_at)
      ]

      csvRows.push(row.join(','))
    }

    const csvContent = csvRows.join('\n')

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `azure-resources-${timestamp}.csv`

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('[ResourcesExport] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Export single resource with cost history
 */
async function exportSingleResourceWithCosts(
  supabase: any,
  orgId: string,
  resourceId: string
) {
  // Fetch resource details
  const { data: resource, error: resourceError } = (await supabase
    .from('azure_resources')
    .select('*')
    .eq('id', resourceId)
    .eq('org_id', orgId)
    .single()) as { data: any; error: any }

  if (resourceError || !resource) {
    return NextResponse.json(
      { error: 'Resource not found' },
      { status: 404 }
    )
  }

  // Fetch cost history (last 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: costHistory } = (await supabase
    .from('cost_snapshots')
    .select('date, cost_usd')
    .eq('org_id', orgId)
    .eq('resource_id', resource.resource_id)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })) as { data: any }

  // Generate CSV with resource info and cost history
  const headers = [
    'Date',
    'Resource Name',
    'Resource Type',
    'Resource Group',
    'Location',
    'Cost (USD)',
    'SKU',
    'Provisioning State'
  ]

  const csvRows = [headers.join(',')]

  if (costHistory && costHistory.length > 0) {
    for (const cost of costHistory) {
      const row = [
        escapeCsvField(cost.date),
        escapeCsvField(resource.resource_name),
        escapeCsvField(resource.resource_type),
        escapeCsvField(resource.resource_group),
        escapeCsvField(resource.location || ''),
        escapeCsvField(cost.cost_usd.toFixed(2)),
        escapeCsvField(resource.sku || ''),
        escapeCsvField(resource.provisioning_state || '')
      ]
      csvRows.push(row.join(','))
    }
  } else {
    // If no cost data, export just the resource info
    const row = [
      escapeCsvField('N/A'),
      escapeCsvField(resource.resource_name),
      escapeCsvField(resource.resource_type),
      escapeCsvField(resource.resource_group),
      escapeCsvField(resource.location || ''),
      escapeCsvField('0.00'),
      escapeCsvField(resource.sku || ''),
      escapeCsvField(resource.provisioning_state || '')
    ]
    csvRows.push(row.join(','))
  }

  const csvContent = csvRows.join('\n')

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `resource-${resource.resource_name}-${timestamp}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/**
 * Escape CSV field value with security sanitization
 *
 * Defense-in-depth approach:
 * 1. Sanitize against CSV Formula Injection (OWASP vulnerability)
 * 2. Apply standard CSV escaping (commas, quotes, newlines)
 *
 * @param value - The value to escape (string, number, null, or undefined)
 * @returns Properly escaped and sanitized CSV field value
 */
function escapeCsvField(value: string | number | null | undefined): string {
  // Step 1: Sanitize against CSV Formula Injection
  // This prevents values starting with =, +, -, @, tab, \r from executing as formulas
  const sanitized = sanitizeCsvValue(value)

  // Empty values don't need further escaping
  if (!sanitized) return ''

  // Step 2: Apply standard CSV escaping
  // Trim whitespace
  const stringValue = sanitized.trim()

  // Check if field needs quoting (contains special CSV characters)
  const needsQuoting = stringValue.includes(',') ||
                       stringValue.includes('\n') ||
                       stringValue.includes('"')

  if (needsQuoting) {
    // Escape quotes by doubling them (RFC 4180 standard)
    const escaped = stringValue.replace(/"/g, '""')
    return `"${escaped}"`
  }

  return stringValue
}
