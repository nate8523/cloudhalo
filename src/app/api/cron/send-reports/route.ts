import { NextRequest, NextResponse } from 'next/server'
import { logSecureError, createSecureErrorResponse } from '@/lib/security/error-handler'
import { createClient } from '@/lib/supabase/server'
import { generateCostReportPDF } from '@/lib/pdf/generator'
import { Resend } from 'resend'
import { getPendingDigestItems, markDigestItemsSent } from '@/lib/digest/queue-manager'
import { aggregateAlertsForDigest, mapToDigestEmailData } from '@/lib/digest/aggregator'
import { generateDigestEmailHTML, generateDigestEmailText } from '@/lib/email/templates'
import { randomUUID } from 'crypto'
import { rateLimiters, applyRateLimit, constantTimeCompare, verifyCronIPWhitelist, verifyCronHmacSignature } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for processing multiple reports

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_for_build')

/**
 * POST /api/cron/send-reports
 * Process and send scheduled reports AND alert digests
 * This should be called by a cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth security layers for cron endpoints:

    // 1. Verify IP whitelist first (optional but recommended)
    const ipCheckResult = await verifyCronIPWhitelist(request)
    if (ipCheckResult) return ipCheckResult

    // 2. Apply IP-based rate limiting (10 attempts per hour per IP)
    const rateLimitResult = await applyRateLimit(request, rateLimiters.cron, 'ip')
    if (rateLimitResult) {
      console.error('[CRON] Rate limit exceeded for IP:', request.headers.get('x-forwarded-for'))
      return rateLimitResult
    }

    // 3. Verify HMAC signature (prevents replay attacks)
    const hmacCheckResult = await verifyCronHmacSignature(request)
    if (hmacCheckResult) return hmacCheckResult

    // 4. Verify Bearer token (defense in depth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not set')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    const expectedAuth = `Bearer ${cronSecret}`
    if (!constantTimeCompare(authHeader || '', expectedAuth)) {
      // Log suspicious activity for monitoring
      console.error('[CRON] Unauthorized cron request:', {
        ip: request.headers.get('x-forwarded-for'),
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
      })

      // Add delay before responding to slow down brute force attempts
      await new Promise(resolve => setTimeout(resolve, 1000))

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayOfMonth = today.getDate()

    // Process alert digests first
    const digestResults = await processAlertDigests(supabase)

    // Get all enabled scheduled reports
    const { data: reports, error: reportsError } = await (supabase
      .from('scheduled_reports') as any)
      .select(
        `
        *,
        azure_tenants (
          id,
          name,
          azure_tenant_id,
          org_id
        ),
        organizations (
          id,
          name
        )
      `
      )
      .eq('enabled', true)

    if (reportsError) {
      console.error('Error fetching scheduled reports:', reportsError)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled reports' },
        { status: 500 }
      )
    }

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const report of reports || []) {
      try {
        // Determine if report should run today
        let shouldRun = false

        switch ((report as any).frequency) {
          case 'daily':
            shouldRun = true
            break
          case 'weekly':
            // Run on Mondays
            shouldRun = dayOfWeek === 1
            break
          case 'monthly':
            // Run on the 1st of each month
            shouldRun = dayOfMonth === 1
            break
        }

        if (!shouldRun) {
          results.skipped++
          continue
        }

        results.processed++

        // Calculate date range based on frequency
        const { startDate, endDate } = getDateRange((report as any).frequency)

        // Fetch organization branding
        const { data: branding } = await (supabase
          .from('organization_branding') as any)
          .select('logo_url, primary_color, company_name')
          .eq('org_id', (report as any).azure_tenants.org_id)
          .single()

        // Fetch cost data
        const { data: costData, error: costError } = await (supabase
          .from('cost_snapshots') as any)
          .select(
            'date, cost_usd, service_category, resource_name, resource_type, location'
          )
          .eq('org_id', (report as any).azure_tenants.org_id)
          .eq('tenant_id', (report as any).tenant_id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })

        if (costError) {
          results.failed++
          results.errors.push(
            `Report ${(report as any).name}: Failed to fetch cost data - ${costError.message}`
          )
          continue
        }

        // Calculate total cost
        const totalCost = costData?.reduce((sum: number, row: any) => sum + (row as any).cost_usd, 0) || 0

        // Generate PDF
        const pdfBuffer = await generateCostReportPDF({
          title: (report as any).name,
          period: {
            start: startDate,
            end: endDate,
          },
          tenantInfo: {
            name: (report as any).azure_tenants.name,
            azure_tenant_id: (report as any).azure_tenants.azure_tenant_id,
          },
          costData: costData || [],
          totalCost,
          branding: branding || undefined,
          generatedBy: 'CloudHalo Automated Reports',
          generatedAt: new Date(),
        })

        // Send email with PDF attachment
        const filename = `${(report as any).name.replace(/\s+/g, '-')}-${startDate}-to-${endDate}.pdf`

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'reports@cloudhalo.app',
          to: (report as any).recipients,
          subject: `${sanitizeEmailSubject((report as any).name)} - ${formatDateRange((report as any).frequency)}`,
          html: generateEmailHtml(report, totalCost, startDate, endDate),
          attachments: [
            {
              filename,
              content: pdfBuffer,
            },
          ],
        })

        // Update last_run_at
        const supabaseClient: any = supabase
        await supabaseClient
          .from('scheduled_reports')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', (report as any).id)

        results.sent++
      } catch (error) {
        results.failed++
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`Report ${(report as any).name}: ${errorMsg}`)
        console.error(`Error processing report ${(report as any).id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      digestResults,
      reportResults: results,
    })
  } catch (error) {
    logSecureError('Cron:SendReports', error, {
      endpoint: 'GET /api/cron/send-reports'
    })
    return createSecureErrorResponse('Failed to process scheduled reports and digests', 500)
  }
}

/**
 * Process and send alert digests for all organizations
 */
async function processAlertDigests(supabase: any) {
  const results = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  }

  try {
    console.log('[Digest] Starting digest processing...')

    // Get all organizations
    const { data: orgs, error: orgsError } = await (supabase
      .from('organizations') as any)
      .select('id, name')

    if (orgsError) {
      console.error('[Digest] Error fetching organizations:', orgsError)
      results.errors.push(`Failed to fetch organizations: ${orgsError.message}`)
      return results
    }

    if (!orgs || orgs.length === 0) {
      console.log('[Digest] No organizations found')
      return results
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cloudhalo.app'

    // Process each organization
    for (const org of orgs) {
      try {
        results.processed++

        // Fetch notification preferences for this org
        const { data: orgPrefs, error: prefsError } = await (supabase
          .from('notification_preferences') as any)
          .select('*')
          .eq('org_id', (org as any).id)
          .single()

        // Skip if no preferences or error
        if (prefsError || !orgPrefs) {
          console.log(`[Digest] No preferences for org ${(org as any).name}`)
          results.skipped++
          continue
        }

        // Skip if digest mode not enabled
        if (!orgPrefs.digest_mode_enabled || orgPrefs.digest_frequency === 'immediate') {
          results.skipped++
          continue
        }

        // Get pending digest items for this organization
        const pendingAlerts = await getPendingDigestItems(supabase, (org as any).id)

        if (!pendingAlerts || pendingAlerts.length === 0) {
          console.log(`[Digest] No pending alerts for org ${(org as any).name}`)
          results.skipped++
          continue
        }

        console.log(`[Digest] Processing ${pendingAlerts.length} alerts for org ${(org as any).name}`)

        // Aggregate alerts into digest format
        const digestData = aggregateAlertsForDigest(pendingAlerts)

        // Convert to email format
        const emailData = mapToDigestEmailData(
          digestData,
          (org as any).name,
          orgPrefs.digest_frequency,
          `${appUrl}/dashboard/alerts`
        )

        // Determine recipients
        let recipients: string[] = []
        if (orgPrefs.digest_recipients && orgPrefs.digest_recipients.length > 0) {
          recipients = orgPrefs.digest_recipients
        } else {
          // Fallback to organization users
          const { data: users } = await (supabase
            .from('users') as any)
            .select('email')
            .eq('org_id', (org as any).id)
          recipients = users?.map((u: any) => u.email).filter(Boolean) || []
        }

        if (recipients.length === 0) {
          console.warn(`[Digest] No recipients found for org ${(org as any).name}`)
          results.failed++
          results.errors.push(`${(org as any).name}: No recipients configured`)
          continue
        }

        // Generate email HTML and text
        const htmlContent = generateDigestEmailHTML(emailData)
        const textContent = generateDigestEmailText(emailData)

        // Send digest email
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'alerts@cloudhalo.app',
          to: recipients,
          subject: `CloudHalo Alert Digest - ${emailData.totalAlerts} Alert${emailData.totalAlerts !== 1 ? 's' : ''}`,
          html: htmlContent,
          text: textContent,
        })

        // Mark alerts as sent
        const batchId = randomUUID()
        const alertIds = pendingAlerts.map(a => a.id)
        await markDigestItemsSent(supabase, alertIds, batchId)

        console.log(`[Digest] ✓ Sent digest to ${recipients.length} recipient(s) for org ${(org as any).name}`)
        results.sent++

      } catch (error) {
        results.failed++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`${(org as any).name}: ${errorMsg}`)
        console.error(`[Digest] Error processing org ${(org as any).id}:`, error)
      }
    }

    console.log(`[Digest] Complete. Sent: ${results.sent}, Skipped: ${results.skipped}, Failed: ${results.failed}`)
    return results

  } catch (error) {
    console.error('[Digest] Fatal error:', error)
    results.errors.push(error instanceof Error ? error.message : 'Fatal error')
    return results
  }
}

function getDateRange(frequency: string): { startDate: string; endDate: string } {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() - 1) // Yesterday

  let startDate = new Date(endDate)

  switch (frequency) {
    case 'daily':
      // Yesterday only
      startDate = new Date(endDate)
      break
    case 'weekly':
      // Last 7 days
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'monthly':
      // Last 30 days
      startDate.setDate(startDate.getDate() - 29)
      break
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

function formatDateRange(frequency: string): string {
  const { startDate, endDate } = getDateRange(frequency)

  switch (frequency) {
    case 'daily':
      return new Date(endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    case 'weekly':
      return `Week of ${new Date(startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    case 'monthly':
      return new Date(endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    default:
      return `${startDate} to ${endDate}`
  }
}

/**
 * Escapes HTML special characters to prevent XSS and injection attacks in email templates.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Sanitizes text for email subject lines by removing newlines and control characters
 * to prevent email header injection attacks.
 */
function sanitizeEmailSubject(text: string): string {
  return text.replace(/[\r\n\t]/g, ' ').trim()
}

function generateEmailHtml(
  report: any,
  totalCost: number,
  startDate: string,
  endDate: string
): string {
  const formattedCost = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalCost)

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml((report as any).name)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0078D4; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">${escapeHtml((report as any).name)}</h1>
        </div>

        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #0078D4; margin-top: 0;">Azure Cost Report</h2>

          <p>Your automated cost report for <strong>${escapeHtml((report as any).azure_tenants.name)}</strong> is ready.</p>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0078D4;">
            <h3 style="margin-top: 0; color: #666;">Report Period</h3>
            <p style="font-size: 16px; margin: 5px 0;">
              <strong>${new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
              to
              <strong>${new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            </p>

            <h3 style="margin-top: 20px; color: #666;">Total Cost</h3>
            <p style="font-size: 28px; font-weight: bold; color: #0078D4; margin: 5px 0;">
              ${formattedCost}
            </p>
          </div>

          <p>The detailed PDF report is attached to this email.</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p>This is an automated report from CloudHalo. To manage your scheduled reports, log in to your dashboard.</p>
            <p style="margin: 5px 0;">Frequency: <strong>${(report as any).frequency.charAt(0).toUpperCase() + (report as any).frequency.slice(1)}</strong></p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          <p>© ${new Date().getFullYear()} CloudHalo. All rights reserved.</p>
        </div>
      </body>
    </html>
  `
}
