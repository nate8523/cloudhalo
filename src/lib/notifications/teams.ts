/**
 * Microsoft Teams Notification Service
 *
 * Sends adaptive card notifications to Teams channels via incoming webhooks.
 * PRD Reference: Feature 6 (FR-6.1) - Microsoft Teams Integration
 */

export interface TeamsNotificationPayload {
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
 * Sends an adaptive card notification to a Microsoft Teams channel
 *
 * @param webhookUrl - Teams incoming webhook URL
 * @param payload - Alert notification data
 * @returns Promise resolving to success status
 */
export async function sendTeamsNotification(
  webhookUrl: string,
  payload: TeamsNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate webhook URL
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      throw new Error('Invalid Teams webhook URL')
    }

    // Build adaptive card
    const adaptiveCard = buildTeamsAdaptiveCard(payload)

    // Send to Teams
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adaptiveCard),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Teams API error: ${response.status} - ${errorText}`)
    }

    console.log(`[Teams] Notification sent successfully for ${payload.tenantName}`)
    return { success: true }

  } catch (error: any) {
    console.error('[Teams] Failed to send notification:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Builds a Microsoft Teams adaptive card for cost alerts
 */
function buildTeamsAdaptiveCard(payload: TeamsNotificationPayload) {
  const severityColors = {
    low: 'Good',
    medium: 'Warning',
    high: 'Attention',
    critical: 'Attention'
  }

  const severityEmoji = {
    low: 'ℹ️',
    medium: '⚠️',
    high: '🔴',
    critical: '🚨'
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              items: [
                {
                  type: 'TextBlock',
                  text: `${severityEmoji[payload.severity]} ${payload.alertName}`,
                  size: 'Large',
                  weight: 'Bolder',
                  color: severityColors[payload.severity]
                },
                {
                  type: 'TextBlock',
                  text: payload.tenantName,
                  size: 'Medium',
                  weight: 'Bolder',
                  spacing: 'None'
                },
                {
                  type: 'TextBlock',
                  text: new Date(payload.triggeredAt).toLocaleString(),
                  size: 'Small',
                  isSubtle: true,
                  spacing: 'None'
                }
              ]
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'Current Cost',
                  value: `$${payload.currentCost.toFixed(2)}`
                },
                {
                  title: 'Previous Cost',
                  value: `$${payload.previousCost.toFixed(2)}`
                },
                {
                  title: 'Change',
                  value: `${payload.costDelta >= 0 ? '+' : ''}$${payload.costDelta.toFixed(2)} (${payload.percentChange >= 0 ? '+' : ''}${payload.percentChange.toFixed(1)}%)`
                }
              ]
            },
            {
              type: 'Container',
              items: [
                {
                  type: 'TextBlock',
                  text: 'Top Cost Contributors',
                  weight: 'Bolder',
                  size: 'Medium'
                },
                ...payload.topResources.slice(0, 3).map(resource => ({
                  type: 'ColumnSet',
                  columns: [
                    {
                      type: 'Column',
                      width: 'stretch',
                      items: [
                        {
                          type: 'TextBlock',
                          text: resource.name,
                          wrap: true
                        },
                        {
                          type: 'TextBlock',
                          text: resource.type,
                          size: 'Small',
                          isSubtle: true,
                          spacing: 'None'
                        }
                      ]
                    },
                    {
                      type: 'Column',
                      width: 'auto',
                      items: [
                        {
                          type: 'TextBlock',
                          text: `$${resource.cost.toFixed(2)}`,
                          weight: 'Bolder'
                        }
                      ]
                    }
                  ]
                }))
              ]
            }
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View in CloudHalo',
              url: payload.alertUrl
            }
          ]
        }
      }
    ]
  }
}

/**
 * Tests a Teams webhook URL by sending a test notification
 *
 * @param webhookUrl - Teams webhook URL to test
 * @returns Promise resolving to success status
 */
export async function testTeamsWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const testPayload: TeamsNotificationPayload = {
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

  return sendTeamsNotification(webhookUrl, testPayload)
}
