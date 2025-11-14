/**
 * Escapes HTML special characters to prevent XSS and injection attacks in email templates.
 * This is critical for user-controlled data like tenant names and alert rule names.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

interface AlertEmailData {
  alertRuleName: string
  tenantName: string
  severity: string
  currentCost: number
  thresholdValue: number
  percentChange?: number
  topResources?: Array<{
    name: string
    cost: number
  }>
  alertLink: string
}

interface DigestEmailData {
  organizationName: string
  periodStart: string
  periodEnd: string
  totalAlerts: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalCostImpact: number
  alertsByTenant: Array<{
    tenantName: string
    tenantId: string
    alertCount: number
    totalCostImpact: number
    alerts: Array<{
      id: string
      severity: 'critical' | 'high' | 'medium' | 'low'
      title: string
      currentValue: number
      thresholdValue: number
      triggeredAt: string
    }>
  }>
  dashboardLink: string
  digestFrequency: string
}

export function generateAlertEmailHTML(data: AlertEmailData): string {
  const {
    alertRuleName,
    tenantName,
    severity,
    currentCost,
    thresholdValue,
    percentChange,
    topResources = [],
    alertLink,
  } = data

  const severityColor = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
  }[severity] || '#6b7280'

  const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudHalo Cost Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #ffffff;">CloudHalo</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #e0e7ff;">Azure Cost Monitoring</p>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="padding: 0; background-color: ${severityColor};">
              <div style="padding: 16px 32px; color: #ffffff;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 40px; vertical-align: middle;">
                      <div style="width: 32px; height: 32px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 20px;">⚠️</span>
                      </div>
                    </td>
                    <td style="vertical-align: middle;">
                      <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Cost Alert Triggered</h2>
                      <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">${severityLabel} Priority</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Alert Details -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(alertRuleName)}</h3>
                <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                  An alert has been triggered for tenant <strong>${escapeHtml(tenantName)}</strong>.
                  Your Azure costs have ${percentChange ? `increased by ${percentChange}% and ` : ''}exceeded the configured threshold.
                </p>
              </div>

              <!-- Cost Details Card -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0 0 16px 0; border-bottom: 1px solid #e5e7eb;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Tenant</p>
                      <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500; color: #111827;">${escapeHtml(tenantName)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="width: 50%;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Current Cost</p>
                            <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: ${severityColor};">$${currentCost.toFixed(2)}</p>
                          </td>
                          <td style="width: 50%; text-align: right;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Threshold</p>
                            <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #6b7280;">$${thresholdValue.toFixed(2)}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${percentChange ? `
                  <tr>
                    <td style="padding: 16px 0;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Change</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: ${severityColor};">+${percentChange}%</p>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <!-- Top Resources -->
              ${topResources.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111827;">Top Cost Contributors</h4>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${topResources.map((resource, index) => `
                    <tr>
                      <td style="padding: 8px 0; ${index < topResources.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
                        <p style="margin: 0; font-size: 13px; color: #374151;">${escapeHtml(resource.name)}</p>
                      </td>
                      <td style="padding: 8px 0; text-align: right; ${index < topResources.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
                        <p style="margin: 0; font-size: 13px; font-weight: 600; font-family: 'Monaco', 'Courier New', monospace; color: #111827;">$${resource.cost.toFixed(2)}</p>
                      </td>
                    </tr>
                  `).join('')}
                </table>
              </div>
              ` : ''}

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${alertLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  View Alert in CloudHalo
                </a>
              </div>

              <p style="margin: 0; text-align: center; font-size: 12px; color: #9ca3af;">
                Click the button above to view detailed cost analysis and take action
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                This is an automated alert from CloudHalo. You received this email because you have configured cost alert rules for your Azure tenants.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                &copy; ${new Date().getFullYear()} CloudHalo. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function generateAlertEmailText(data: AlertEmailData): string {
  const {
    alertRuleName,
    tenantName,
    severity,
    currentCost,
    thresholdValue,
    percentChange,
    topResources = [],
    alertLink,
  } = data

  const severityLabel = severity.toUpperCase()

  let text = `
CloudHalo Cost Alert - ${severityLabel} PRIORITY

${alertRuleName}

An alert has been triggered for tenant "${tenantName}".
${percentChange ? `Your Azure costs have increased by ${percentChange}% and exceeded the configured threshold.` : 'Your Azure costs have exceeded the configured threshold.'}

COST DETAILS:
- Tenant: ${tenantName}
- Current Cost: $${currentCost.toFixed(2)}
- Threshold: $${thresholdValue.toFixed(2)}
${percentChange ? `- Change: +${percentChange}%` : ''}
`

  if (topResources.length > 0) {
    text += `\nTOP COST CONTRIBUTORS:\n`
    topResources.forEach((resource) => {
      text += `- ${resource.name}: $${resource.cost.toFixed(2)}\n`
    })
  }

  text += `
VIEW ALERT: ${alertLink}

Click the link above to view detailed cost analysis and take action.

---
This is an automated alert from CloudHalo.
© ${new Date().getFullYear()} CloudHalo. All rights reserved.
  `.trim()

  return text
}

export function generateDigestEmailHTML(data: DigestEmailData): string {
  const {
    organizationName,
    periodStart,
    periodEnd,
    totalAlerts,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    totalCostImpact,
    alertsByTenant,
    dashboardLink,
    digestFrequency,
  } = data

  const severityColorMap = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getSeveritySummary = () => {
    const parts: string[] = []
    if (criticalCount > 0) parts.push(`${criticalCount} critical`)
    if (highCount > 0) parts.push(`${highCount} high`)
    if (mediumCount > 0) parts.push(`${mediumCount} medium`)
    if (lowCount > 0) parts.push(`${lowCount} low`)
    return parts.join(', ')
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudHalo Alert Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #ffffff;">CloudHalo</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #e0e7ff;">Alert Digest</p>
            </td>
          </tr>

          <!-- Summary Banner -->
          <tr>
            <td style="padding: 32px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #111827;">
                ${totalAlerts} Alert${totalAlerts !== 1 ? 's' : ''} in ${digestFrequency} Digest
              </h2>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                ${formatDate(periodStart)} - ${formatDate(periodEnd)}
              </p>
              ${getSeveritySummary() ? `
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #374151;">
                ${getSeveritySummary()}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Cost Impact Summary -->
          ${totalCostImpact > 0 ? `
          <tr>
            <td style="padding: 24px 32px; background-color: #fef2f2; border-bottom: 1px solid #fecaca;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 40px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; background-color: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 18px; color: #ffffff;">💰</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #991b1b; letter-spacing: 0.05em;">Total Cost Impact</p>
                    <p style="margin: 2px 0 0 0; font-size: 24px; font-weight: 700; color: #dc2626;">$${totalCostImpact.toFixed(2)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Alerts by Tenant -->
          <tr>
            <td style="padding: 32px;">
              ${alertsByTenant.map((tenant, tenantIndex) => `
                <div style="margin-bottom: ${tenantIndex < alertsByTenant.length - 1 ? '32px' : '0'};">
                  <!-- Tenant Header -->
                  <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
                    <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(tenant.tenantName)}</h3>
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">
                      ${tenant.alertCount} alert${tenant.alertCount !== 1 ? 's' : ''}
                      ${tenant.totalCostImpact > 0 ? ` · Cost impact: <span style="font-weight: 600; color: #dc2626;">$${tenant.totalCostImpact.toFixed(2)}</span>` : ''}
                    </p>
                  </div>

                  <!-- Alerts List -->
                  ${tenant.alerts.map((alert, alertIndex) => `
                    <div style="padding: 16px; background-color: #f9fafb; border-left: 3px solid ${severityColorMap[alert.severity]}; margin-bottom: ${alertIndex < tenant.alerts.length - 1 ? '12px' : '0'}; border-radius: 4px;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td>
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                              <span style="display: inline-block; padding: 2px 8px; background-color: ${severityColorMap[alert.severity]}; color: #ffffff; font-size: 11px; font-weight: 600; text-transform: uppercase; border-radius: 3px; margin-right: 8px;">
                                ${alert.severity}
                              </span>
                              <span style="font-size: 12px; color: #9ca3af;">
                                ${formatTime(alert.triggeredAt)}
                              </span>
                            </div>
                            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827;">
                              ${escapeHtml(alert.title)}
                            </p>
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                              <tr>
                                <td style="width: 50%; padding: 4px 0;">
                                  <p style="margin: 0; font-size: 11px; color: #6b7280;">Current</p>
                                  <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 700; color: ${severityColorMap[alert.severity]};">$${alert.currentValue.toFixed(2)}</p>
                                </td>
                                <td style="width: 50%; padding: 4px 0;">
                                  <p style="margin: 0; font-size: 11px; color: #6b7280;">Threshold</p>
                                  <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 600; color: #6b7280;">$${alert.thresholdValue.toFixed(2)}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </div>
                  `).join('')}
                </div>
              `).join('')}

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${dashboardLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  View All Alerts in Dashboard
                </a>
              </div>

              <p style="margin: 0; text-align: center; font-size: 12px; color: #9ca3af;">
                Click to view detailed analysis and take action on all alerts
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                This is your ${digestFrequency} digest from CloudHalo. You received this email because you have configured alert digest preferences for ${escapeHtml(organizationName)}.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                &copy; ${new Date().getFullYear()} CloudHalo. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function generateDigestEmailText(data: DigestEmailData): string {
  const {
    organizationName,
    periodStart,
    periodEnd,
    totalAlerts,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    totalCostImpact,
    alertsByTenant,
    dashboardLink,
    digestFrequency,
  } = data

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getSeveritySummary = () => {
    const parts: string[] = []
    if (criticalCount > 0) parts.push(`${criticalCount} critical`)
    if (highCount > 0) parts.push(`${highCount} high`)
    if (mediumCount > 0) parts.push(`${mediumCount} medium`)
    if (lowCount > 0) parts.push(`${lowCount} low`)
    return parts.join(', ')
  }

  let text = `
CloudHalo Alert Digest - ${digestFrequency.toUpperCase()}

${totalAlerts} Alert${totalAlerts !== 1 ? 's' : ''} for ${organizationName}
Period: ${formatDate(periodStart)} - ${formatDate(periodEnd)}
${getSeveritySummary() ? `Severity: ${getSeveritySummary()}` : ''}
${totalCostImpact > 0 ? `\nTOTAL COST IMPACT: $${totalCostImpact.toFixed(2)}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`

  alertsByTenant.forEach((tenant, tenantIndex) => {
    text += `
${tenant.tenantName.toUpperCase()}
${tenant.alertCount} alert${tenant.alertCount !== 1 ? 's' : ''}${tenant.totalCostImpact > 0 ? ` · Cost impact: $${tenant.totalCostImpact.toFixed(2)}` : ''}

`
    tenant.alerts.forEach((alert, alertIndex) => {
      text += `  [${alert.severity.toUpperCase()}] ${alert.title}
  Triggered: ${formatTime(alert.triggeredAt)}
  Current: $${alert.currentValue.toFixed(2)} | Threshold: $${alert.thresholdValue.toFixed(2)}

`
    })

    if (tenantIndex < alertsByTenant.length - 1) {
      text += `──────────────────────────────────────────────────

`
    }
  })

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VIEW DASHBOARD: ${dashboardLink}

---
This is your ${digestFrequency} digest from CloudHalo.
You received this email because you have configured alert digest preferences for ${organizationName}.

© ${new Date().getFullYear()} CloudHalo. All rights reserved.
  `.trim()

  return text
}
