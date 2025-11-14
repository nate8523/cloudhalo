/**
 * Digest Queue Manager
 * Handles queuing alerts for digest delivery and managing quiet hours
 */

import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row']
type AlertDigestQueueInsert = Database['public']['Tables']['alert_digest_queue']['Insert']

export interface AlertForDigest {
  id: string
  org_id: string
  alert_rule_id: string
  tenant_id: string
  tenant_name: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  current_value: number
  threshold_value: number
  triggered_at: string
  metadata?: any
}

/**
 * Determines if an alert should be sent immediately or queued for digest
 * Based on quiet hours, digest mode, and severity settings
 */
export async function shouldQueueForDigest(
  supabase: SupabaseClient<Database>,
  orgId: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<{
  shouldQueue: boolean
  scheduledFor?: string
  reason: string
}> {
  // Fetch notification preferences for the organization
  const { data: prefs, error } = await (supabase
    .from('notification_preferences') as any)
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (error || !prefs) {
    // No preferences = send immediately
    return {
      shouldQueue: false,
      reason: 'no_preferences'
    }
  }

  // Check if digest mode is enabled
  if (prefs.digest_mode_enabled && prefs.digest_frequency !== 'immediate') {
    // Check severity bypass rules
    if (severity === 'critical' && prefs.critical_alerts_bypass_quiet_hours) {
      return {
        shouldQueue: false,
        reason: 'critical_bypass'
      }
    }
    if (severity === 'high' && prefs.high_alerts_bypass_quiet_hours) {
      return {
        shouldQueue: false,
        reason: 'high_bypass'
      }
    }

    // Queue for next digest
    const scheduledFor = await calculateNextDigestTime(supabase, orgId)
    return {
      shouldQueue: true,
      scheduledFor: scheduledFor || new Date().toISOString(),
      reason: 'digest_mode_enabled'
    }
  }

  // Check if in quiet hours
  if (prefs.quiet_hours_enabled) {
    const inQuietHours = isInQuietHours(prefs)

    if (inQuietHours) {
      // Check severity bypass rules
      if (severity === 'critical' && prefs.critical_alerts_bypass_quiet_hours) {
        return {
          shouldQueue: false,
          reason: 'critical_bypass_quiet_hours'
        }
      }
      if (severity === 'high' && prefs.high_alerts_bypass_quiet_hours) {
        return {
          shouldQueue: false,
          reason: 'high_bypass_quiet_hours'
        }
      }

      // Queue for next digest
      const scheduledFor = await calculateNextDigestTime(supabase, orgId)
      return {
        shouldQueue: true,
        scheduledFor: scheduledFor || new Date().toISOString(),
        reason: 'quiet_hours_active'
      }
    }
  }

  // Send immediately
  return {
    shouldQueue: false,
    reason: 'immediate_send'
  }
}

/**
 * Queues an alert for digest delivery
 */
export async function queueAlertForDigest(
  supabase: SupabaseClient<Database>,
  alert: AlertForDigest,
  scheduledFor: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const queueEntry: AlertDigestQueueInsert = {
      org_id: alert.org_id,
      alert_history_id: alert.id,
      scheduled_for: scheduledFor,
      alert_title: alert.title,
      alert_severity: alert.severity,
      tenant_name: alert.tenant_name,
      current_cost: alert.current_value,
      triggered_at: alert.triggered_at,
    }

    const { error } = await (supabase
      .from('alert_digest_queue') as any)
      .insert(queueEntry)

    if (error) {
      console.error('[DigestQueue] Failed to queue alert:', error)
      return { success: false, error: error.message }
    }

    // Mark alert as queued
    const supabaseClient: any = supabase
    await supabaseClient
      .from('alert_history')
      .update({ queued_for_digest: true })
      .eq('id', alert.id)

    console.log(`[DigestQueue] ✓ Queued alert ${alert.id} for digest at ${scheduledFor}`)
    return { success: true }

  } catch (error: any) {
    console.error('[DigestQueue] Error queuing alert:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Fetches pending digest items for an organization that are ready to send
 */
export async function getPendingDigestItems(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<AlertForDigest[]> {
  const now = new Date().toISOString()

  const { data: queueItems, error } = await (supabase
    .from('alert_digest_queue') as any)
    .select(`
      *,
      alert_history:alert_history_id (
        id,
        org_id,
        alert_rule_id,
        tenant_id,
        severity,
        title,
        message,
        current_value,
        threshold_value,
        triggered_at,
        metadata
      )
    `)
    .eq('org_id', orgId)
    .is('included_in_digest_at', null)
    .lte('scheduled_for', now)

  if (error) {
    console.error('[DigestQueue] Error fetching pending items:', error)
    return []
  }

  if (!queueItems || queueItems.length === 0) {
    return []
  }

  // Map to AlertForDigest format
  const alerts: AlertForDigest[] = queueItems
    .filter((item: any) => item.alert_history)
    .map((item: any) => ({
      id: (item.alert_history as any).id,
      org_id: (item.alert_history as any).org_id,
      alert_rule_id: (item.alert_history as any).alert_rule_id,
      tenant_id: (item.alert_history as any).tenant_id,
      tenant_name: item.tenant_name,
      severity: (item.alert_history as any).severity,
      title: (item.alert_history as any).title,
      message: (item.alert_history as any).message,
      current_value: (item.alert_history as any).current_value,
      threshold_value: (item.alert_history as any).threshold_value,
      triggered_at: (item.alert_history as any).triggered_at,
      metadata: (item.alert_history as any).metadata,
    }))

  return alerts
}

/**
 * Marks digest items as sent with a batch ID
 */
export async function markDigestItemsSent(
  supabase: SupabaseClient<Database>,
  alertIds: string[],
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseClient: any = supabase
    const { error } = await supabaseClient
      .from('alert_digest_queue')
      .update({
        included_in_digest_at: new Date().toISOString(),
        digest_batch_id: batchId
      })
      .in('alert_history_id', alertIds)

    if (error) {
      console.error('[DigestQueue] Failed to mark items as sent:', error)
      return { success: false, error: error.message }
    }

    console.log(`[DigestQueue] ✓ Marked ${alertIds.length} items as sent in batch ${batchId}`)
    return { success: true }

  } catch (error: any) {
    console.error('[DigestQueue] Error marking items as sent:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Checks if current time is within quiet hours
 */
function isInQuietHours(prefs: NotificationPreferences): boolean {
  try {
    const now = new Date()
    const timezone = prefs.quiet_hours_timezone || 'UTC'

    // Get current time in user's timezone
    const timeString = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })

    const [currentHour, currentMinute] = timeString.split(':').map(Number)
    const currentMinutes = currentHour * 60 + currentMinute

    const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute

    const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number)
    const endMinutes = endHour * 60 + endMinute

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
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
 * Calculates the next digest delivery time for an organization
 */
async function calculateNextDigestTime(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<string | null> {
  try {
    // Use the database function to calculate next digest time
    const { data, error } = await (supabase as any)
      .rpc('calculate_next_digest_time', { p_org_id: orgId })

    if (error) {
      console.error('[DigestQueue] Error calculating next digest time:', error)
      return null
    }

    return data as string

  } catch (error) {
    console.error('[DigestQueue] Error calculating next digest time:', error)
    return null
  }
}
