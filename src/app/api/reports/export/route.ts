import { NextRequest, NextResponse } from 'next/server'
import { logSecureError, createSecureErrorResponse } from '@/lib/security/error-handler'
import { createClient } from '@/lib/supabase/server'
import { generateCostReportPDF } from '@/lib/pdf/generator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reports/export
 * Generate and download a PDF cost report
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
      .select('org_id, full_name')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      tenant_id,
      start_date,
      end_date,
      title = 'Azure Cost Report',
    } = body

    if (!tenant_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: tenant_id, start_date, end_date' },
        { status: 400 }
      )
    }

    // Verify tenant belongs to user's organization
    const { data: tenant, error: tenantError } = await supabase
      .from('azure_tenants')
      .select('id, name, azure_tenant_id, org_id')
      .eq('id', tenant_id)
      .eq('org_id', (userData as any).org_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or access denied' },
        { status: 404 }
      )
    }

    // Get organization branding
    const { data: orgBranding } = await supabase
      .from('organization_branding')
      .select('logo_url, primary_color, company_name')
      .eq('org_id', (userData as any).org_id)
      .single()

    // Fetch cost data for the period
    const { data: costData, error: costError } = await supabase
      .from('cost_snapshots')
      .select(
        'date, cost_usd, service_category, resource_name, resource_type, location'
      )
      .eq('org_id', (userData as any).org_id)
      .eq('tenant_id', tenant_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date', { ascending: false })

    if (costError) {
      return NextResponse.json(
        { error: 'Failed to fetch cost data', details: costError.message },
        { status: 500 }
      )
    }

    // Calculate total cost
    const totalCost = costData?.reduce((sum, row) => sum + (row as any).cost_usd, 0) || 0

    // Generate PDF
    const pdfBuffer = await generateCostReportPDF({
      title,
      period: {
        start: start_date,
        end: end_date,
      },
      tenantInfo: {
        name: (tenant as any).name,
        azure_tenant_id: (tenant as any).azure_tenant_id,
      },
      costData: costData || [],
      totalCost,
      branding: orgBranding || undefined,
      generatedBy: (userData as any).full_name || user.email,
      generatedAt: new Date(),
    })

    // Return PDF as downloadable file
    const filename = `azure-cost-report-${(tenant as any).name.replace(/\s+/g, '-')}-${start_date}-to-${end_date}.pdf`

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    logSecureError('ReportExport', error, {
      endpoint: 'GET /api/reports/export'
    })
    return createSecureErrorResponse('Failed to generate report', 500)
  }
}
