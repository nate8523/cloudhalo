/**
 * Unified Notification Sender
 *
 * Orchestrates sending notifications across multiple channels (email, Teams, Slack)
 * with retry logic and error handling.
 * PRD Reference: Feature 6 - Multi-Channel Notifications
 */

import { sendTeamsNotification, type TeamsNotificationPayload } from './teams'
import { sendSlackNotification, type SlackNotificationPayload } from './slack'

export interface NotificationChannels {
  email?: {
    enabled: boolean
    addresses?: string[]
  }
  teams?: {
    enabled: boolean
    webhookUrl?: string
  }
  slack?: {
    enabled: boolean
    webhookUrl?: string
  }
}

export interface AlertNotificationData {
  tenantName: string
  tenantId: string
  alertName: string
  alertRuleId: string
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
  triggeredAt: string
}

export interface NotificationResult {
  channel: 'email' | 'teams' | 'slack'
  success: boolean
  error?: string
  retries?: number
}

/**
 * Sends alert notifications to all enabled channels with retry logic
 *
 * @param data - Alert notification data
 * @param channels - Enabled notification channels with configuration
 * @returns Array of results for each channel
 */
export async function sendAlertNotifications(
  data: AlertNotificationData,
  channels: NotificationChannels
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []

  // Build alert URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cloudhalo.app'
  const alertUrl = `${appUrl}/dashboard/alerts`

  // Send to Teams if enabled
  if (channels.teams?.enabled && channels.teams.webhookUrl) {
    const teamsResult = await sendWithRetry(
      'teams',
      async () => {
        const payload: TeamsNotificationPayload = {
          ...data,
          alertUrl
        }
        return sendTeamsNotification(channels.teams!.webhookUrl!, payload)
      }
    )
    results.push(teamsResult)
  }

  // Send to Slack if enabled
  if (channels.slack?.enabled && channels.slack.webhookUrl) {
    const slackResult = await sendWithRetry(
      'slack',
      async () => {
        const payload: SlackNotificationPayload = {
          ...data,
          alertUrl
        }
        return sendSlackNotification(channels.slack!.webhookUrl!, payload)
      }
    )
    results.push(slackResult)
  }

  // Send to Email if enabled
  if (channels.email?.enabled) {
    const emailResult = await sendEmailNotification(data, channels.email.addresses)
    results.push(emailResult)
  }

  return results
}

/**
 * Sends notification with exponential backoff retry logic
 * PRD: 3 attempts - 0s, 30s, 5m
 *
 * @param channel - Channel name for logging
 * @param sendFn - Async function that sends the notification
 * @returns Notification result with retry count
 */
async function sendWithRetry(
  channel: 'email' | 'teams' | 'slack',
  sendFn: () => Promise<{ success: boolean; error?: string }>
): Promise<NotificationResult> {
  const delays = [0, 30000, 300000] // 0s, 30s, 5m
  let lastError: string | undefined

  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      // Wait before retry (except first attempt)
      if (attempt > 0) {
        console.log(`[${channel}] Retrying in ${delays[attempt] / 1000}s (attempt ${attempt + 1}/${delays.length})`)
        await sleep(delays[attempt])
      }

      // Attempt to send
      const result = await sendFn()

      if (result.success) {
        console.log(`[${channel}] Notification sent successfully${attempt > 0 ? ` after ${attempt} retries` : ''}`)
        return {
          channel,
          success: true,
          retries: attempt
        }
      }

      lastError = result.error
      console.warn(`[${channel}] Attempt ${attempt + 1} failed: ${result.error}`)

    } catch (error: any) {
      lastError = error.message || 'Unknown error'
      console.error(`[${channel}] Attempt ${attempt + 1} threw error:`, error)
    }
  }

  // All retries exhausted
  console.error(`[${channel}] All ${delays.length} attempts failed. Last error: ${lastError}`)
  return {
    channel,
    success: false,
    error: lastError || 'All retry attempts failed',
    retries: delays.length - 1
  }
}

/**
 * Sends email notification using existing email service
 */
async function sendEmailNotification(
  data: AlertNotificationData,
  addresses?: string[]
): Promise<NotificationResult> {
  try {
    // Import email sender dynamically to avoid circular dependencies
    const { sendAlertEmail } = await import('../email/alerts')

    await sendAlertEmail({
      to: addresses || [],
      tenantName: data.tenantName,
      alertName: data.alertName,
      severity: data.severity,
      currentCost: data.currentCost,
      previousCost: data.previousCost,
      costDelta: data.costDelta,
      percentChange: data.percentChange,
      topResources: data.topResources,
      alertUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cloudhalo.app'}/dashboard/alerts`
    })

    return {
      channel: 'email',
      success: true
    }
  } catch (error: any) {
    console.error('[Email] Failed to send notification:', error)
    return {
      channel: 'email',
      success: false,
      error: error.message || 'Email send failed'
    }
  }
}

/**
 * Checks if quiet hours are active based on notification preferences
 *
 * @param preferences - Notification preferences with quiet hours configuration
 * @returns True if currently in quiet hours
 */
export function isQuietHours(preferences?: {
  quietHoursEnabled?: boolean
  quietHoursStart?: string // Format: "HH:MM"
  quietHoursEnd?: string // Format: "HH:MM"
  quietHoursTimezone?: string // IANA timezone
}): boolean {
  if (!preferences?.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false
  }

  try {
    const now = new Date()
    const timezone = preferences.quietHoursTimezone || 'UTC'

    // Get current time in user's timezone
    const timeString = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })

    const [currentHour, currentMinute] = timeString.split(':').map(Number)
    const currentMinutes = currentHour * 60 + currentMinute

    const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute

    const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number)
    const endMinutes = endHour * 60 + endMinute

    // Handle overnight quiet hours (e.g., 23:00 to 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes

  } catch (error) {
    console.error('[QuietHours] Error checking quiet hours:', error)
    return false
  }
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
