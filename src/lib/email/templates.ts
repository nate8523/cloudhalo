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
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">${alertRuleName}</h3>
                <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                  An alert has been triggered for tenant <strong>${tenantName}</strong>.
                  Your Azure costs have ${percentChange ? `increased by ${percentChange}% and ` : ''}exceeded the configured threshold.
                </p>
              </div>

              <!-- Cost Details Card -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0 0 16px 0; border-bottom: 1px solid #e5e7eb;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Tenant</p>
                      <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500; color: #111827;">${tenantName}</p>
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
                        <p style="margin: 0; font-size: 13px; color: #374151;">${resource.name}</p>
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
