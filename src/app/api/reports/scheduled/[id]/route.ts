import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reports/scheduled/[id]
 * Get a specific scheduled report
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Fetch scheduled report with tenant info
    const { data: report, error: reportError } = await supabase
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
      .eq('id', id)
      .eq('org_id', (userData as any).org_id)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Error fetching scheduled report:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch scheduled report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/reports/scheduled/[id]
 * Update a scheduled report
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify report exists and belongs to org
    const { data: existingReport, error: checkError } = await supabase
      .from('scheduled_reports')
      .select('id, org_id')
      .eq('id', id)
      .eq('org_id', (userData as any).org_id)
      .single()

    if (checkError || !existingReport) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, frequency, report_type, recipients, format, enabled } = body

    // Build update object with only provided fields
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (frequency !== undefined) {
      const validFrequencies = ['daily', 'weekly', 'monthly']
      if (!validFrequencies.includes(frequency)) {
        return NextResponse.json(
          { error: 'Invalid frequency. Must be: daily, weekly, or monthly' },
          { status: 400 }
        )
      }
      updates.frequency = frequency
    }
    if (report_type !== undefined) {
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
      updates.report_type = report_type
    }
    if (recipients !== undefined) {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return NextResponse.json(
          { error: 'Recipients must be a non-empty array of email addresses' },
          { status: 400 }
        )
      }
      updates.recipients = recipients
    }
    if (format !== undefined) updates.format = format
    if (enabled !== undefined) updates.enabled = enabled

    updates.updated_at = new Date().toISOString()

    // Update report
    const supabaseClient: any = supabase
    const { data: updatedReport, error: updateError } = await supabaseClient
      .from('scheduled_reports')
      .update(updates)
      .eq('id', id)
      .eq('org_id', (userData as any).org_id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update scheduled report', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ report: updatedReport })
  } catch (error) {
    console.error('Error updating scheduled report:', error)
    return NextResponse.json(
      {
        error: 'Failed to update scheduled report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/reports/scheduled/[id]
 * Delete a scheduled report
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Delete report
    const { error: deleteError } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', id)
      .eq('org_id', (userData as any).org_id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete scheduled report', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scheduled report:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete scheduled report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
