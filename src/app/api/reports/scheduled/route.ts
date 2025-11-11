import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reports/scheduled
 * Get all scheduled reports for the user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch scheduled reports
    const { data: reports, error: reportsError } = await supabase
      .from('scheduled_reports')
      .select(
        `
        *,
        azure_tenants (
          id,
          name,
          azure_tenant_id
        )
      `
      )
      .eq('org_id', (userData as any).org_id)
      .order('created_at', { ascending: false })

    if (reportsError) {
      return NextResponse.json(
        { error: 'Failed to fetch scheduled reports', details: reportsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error fetching scheduled reports:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reports/scheduled
 * Create a new scheduled report
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      tenant_id,
      frequency,
      report_type,
      recipients,
      format = 'pdf',
      enabled = true,
    } = body

    // Validate required fields
    if (!name || !tenant_id || !frequency || !report_type || !recipients) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: name, tenant_id, frequency, report_type, recipients',
        },
        { status: 400 }
      )
    }

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be: daily, weekly, or monthly' },
        { status: 400 }
      )
    }

    // Validate report type
    const validReportTypes = ['cost_summary', 'detailed_breakdown', 'trend_analysis']
    if (!validReportTypes.includes(report_type)) {
      return NextResponse.json(
        {
          error:
            'Invalid report_type. Must be: cost_summary, detailed_breakdown, or trend_analysis',
        },
        { status: 400 }
      )
    }

    // Validate recipients is an array
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients must be a non-empty array of email addresses' },
        { status: 400 }
      )
    }

    // Verify tenant belongs to user's organization
    const { data: tenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('id, org_id')
      .eq('id', tenant_id)
      .eq('org_id', (userData as any).org_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Create scheduled report
    const { data: newReport, error: createError } = await supabase
      .from('scheduled_reports')
      .insert({
        org_id: (userData as any).org_id,
        tenant_id,
        name,
        frequency,
        report_type,
        recipients,
        format,
        enabled,
        created_by: user.id,
      } as any)
      .select()
      .single()

    if (createError) {
      return NextResponse.json(
        { error: 'Failed to create scheduled report', details: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ report: newReport }, { status: 201 })
  } catch (error) {
    console.error('Error creating scheduled report:', error)
    return NextResponse.json(
      {
        error: 'Failed to create scheduled report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
