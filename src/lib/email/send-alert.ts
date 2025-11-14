import { resend, FROM_EMAIL } from './resend'
import { generateAlertEmailHTML, generateAlertEmailText } from './templates'

/**
 * Sanitizes text for email subject lines by removing newlines and control characters
 * to prevent email header injection attacks.
 */
function sanitizeEmailSubject(text: string): string {
  return text.replace(/[\r\n\t]/g, ' ').trim()
}

interface SendAlertEmailParams {
  to: string
  alertRuleName: string
  tenantName: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  currentCost: number
  thresholdValue: number
  percentChange?: number
  topResources?: Array<{
    name: string
    cost: number
  }>
  alertId: string
}

export async function sendAlertEmail(params: SendAlertEmailParams) {
  const {
    to,
    alertRuleName,
    tenantName,
    severity,
    currentCost,
    thresholdValue,
    percentChange,
    topResources,
    alertId,
  } = params

  // Generate alert link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cloudhalo.app'
  const alertLink = `${baseUrl}/dashboard/alerts?highlight=${alertId}`

  // Generate email content
  const emailData = {
    alertRuleName,
    tenantName,
    severity,
    currentCost,
    thresholdValue,
    percentChange,
    topResources,
    alertLink,
  }

  const html = generateAlertEmailHTML(emailData)
  const text = generateAlertEmailText(emailData)

  // Send email
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `[${severity.toUpperCase()}] CloudHalo Alert: ${sanitizeEmailSubject(alertRuleName)}`,
      html,
      text,
    })

    console.log('Alert email sent successfully:', result)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send alert email:', error)
    return { success: false, error }
  }
}
