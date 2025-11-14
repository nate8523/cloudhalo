/**
 * Slack Notification Service
 *
 * Sends rich message notifications to Slack channels via incoming webhooks.
 * PRD Reference: Feature 6 (FR-6.2) - Slack Integration
 */

export interface SlackNotificationPayload {
  tenantName: string
  alertName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  currentCost: number
  previousCost: number
  costDelta: number
  percentChange: number
  topResources: Array<{
    name: string
    type: string
    cost: number
  }>
  alertUrl: string
  triggeredAt: string
}

/**
 * Sends a rich message notification to a Slack channel
 *
 * @param webhookUrl - Slack incoming webhook URL
 * @param payload - Alert notification data
 * @returns Promise resolving to success status
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: SlackNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate webhook URL
    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      throw new Error('Invalid Slack webhook URL')
    }

    // Build Slack message
    const slackMessage = buildSlackMessage(payload)

    // Send to Slack
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Slack API error: ${response.status} - ${errorText}`)
    }

    console.log(`[Slack] Notification sent successfully for ${payload.tenantName}`)
    return { success: true }

  } catch (error: any) {
    console.error('[Slack] Failed to send notification:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Builds a Slack Block Kit message for cost alerts
 */
function buildSlackMessage(payload: SlackNotificationPayload) {
  const severityColors = {
    low: '#36a64f',      // Green
    medium: '#ff9900',   // Orange
    high: '#ff0000',     // Red
    critical: '#8b0000'  // Dark Red
  }

  const severityEmoji = {
    low: ':information_source:',
    medium: ':warning:',
    high: ':rotating_light:',
    critical: ':sos:'
  }

  const costChange = payload.costDelta >= 0 ? '+' : ''
  const percentChangeFormatted = payload.percentChange >= 0 ? '+' : ''

  return {
    text: `${payload.alertName} - ${payload.tenantName}`,
    attachments: [
      {
        color: severityColors[payload.severity],
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${severityEmoji[payload.severity]} ${payload.alertName}`,
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Tenant:*\n${payload.tenantName}`
              },
              {
                type: 'mrkdwn',
                text: `*Severity:*\n${payload.severity.toUpperCase()}`
              },
              {
                type: 'mrkdwn',
                text: `*Current Cost:*\n$${payload.currentCost.toFixed(2)}`
              },
              {
                type: 'mrkdwn',
                text: `*Previous Cost:*\n$${payload.previousCost.toFixed(2)}`
              },
              {
                type: 'mrkdwn',
                text: `*Change:*\n${costChange}$${payload.costDelta.toFixed(2)}`
              },
              {
                type: 'mrkdwn',
                text: `*Percent Change:*\n${percentChangeFormatted}${payload.percentChange.toFixed(1)}%`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Top Cost Contributors:*'
            }
          },
          ...payload.topResources.slice(0, 3).map(resource => ({
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*${resource.name}*\n${resource.type}`
              },
              {
                type: 'mrkdwn',
                text: `*Cost:*\n$${resource.cost.toFixed(2)}`
              }
            ]
          })),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Triggered at ${new Date(payload.triggeredAt).toLocaleString()}`
              }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View in CloudHalo',
                  emoji: true
                },
                url: payload.alertUrl,
                style: 'primary'
              }
            ]
          }
        ]
      }
    ]
  }
}

/**
 * Tests a Slack webhook URL by sending a test notification
 *
 * @param webhookUrl - Slack webhook URL to test
 * @returns Promise resolving to success status
 */
export async function testSlackWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const testPayload: SlackNotificationPayload = {
    tenantName: 'Test Tenant',
    alertName: 'Test Alert - CloudHalo',
    severity: 'low',
    currentCost: 150.00,
    previousCost: 100.00,
    costDelta: 50.00,
    percentChange: 50.0,
    topResources: [
      { name: 'test-vm-01', type: 'Virtual Machine', cost: 30.00 },
      { name: 'test-storage', type: 'Storage Account', cost: 15.00 },
      { name: 'test-sql-db', type: 'SQL Database', cost: 5.00 }
    ],
    alertUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cloudhalo.app'}/dashboard/alerts`,
    triggeredAt: new Date().toISOString()
  }

  return sendSlackNotification(webhookUrl, testPayload)
}
