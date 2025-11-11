import { sendAlertEmail } from '../email/send-alert'

interface AlertRule {
  id: string
  org_id: string
  tenant_id: string
  name: string
  type: 'THRESHOLD' | 'PERCENTAGE_SPIKE' | 'BUDGET' | 'ANOMALY'
  threshold_amount: number | null
  threshold_percent: number | null
  notification_channels: {
    email?: boolean
  }
  status: string
}

interface CostData {
  date: string
  total_cost: number
  resource_breakdown?: Array<{
    resource_name: string
    cost: number
  }>
}

/**
 * Evaluate alert rules against latest cost data
 */
export async function evaluateAlertRules(supabase: any) {
  console.log('[ALERTS] Starting alert rule evaluation...')

  // Fetch all active alert rules
  const { data: alertRules, error: rulesError } = await (supabase
    .from('alert_rules') as any)
    .select('*, azure_tenants(name)')
    .eq('status', 'active')

  if (rulesError || !alertRules || alertRules.length === 0) {
    console.log('[ALERTS] No active alert rules found')
    return { evaluated: 0, triggered: 0 }
  }

  console.log(`[ALERTS] Evaluating ${alertRules.length} alert rule(s)`)

  let evaluated = 0
  let triggered = 0

  for (const rule of alertRules) {
    try {
      const shouldAlert = await evaluateRule(rule, supabase)

      if (shouldAlert) {
        await createAlertEvent(rule, shouldAlert, supabase)
        triggered++
      }

      evaluated++
    } catch (error: any) {
      console.error(`[ALERTS] Error evaluating rule ${rule.name}:`, error.message)
    }
  }

  console.log(`[ALERTS] Evaluated ${evaluated} rules, triggered ${triggered} alerts`)

  return { evaluated, triggered }
}

/**
 * Evaluate a single alert rule
 */
async function evaluateRule(
  rule: AlertRule,
  supabase: any
): Promise<false | {
  severity: string
  currentCost: number
  thresholdValue: number
  percentChange?: number
  topResources?: Array<{ name: string; cost: number }>
}> {
  const { type, tenant_id, threshold_amount, threshold_percent } = rule

  // Get today's date
  const today = new Date().toISOString().split('T')[0]

  // Get current day costs for the tenant
  const { data: currentDayCosts } = await (supabase
    .from('cost_snapshots') as any)
    .select('cost_usd, resource_name')
    .eq('tenant_id', tenant_id)
    .eq('date', today)

  if (!currentDayCosts || currentDayCosts.length === 0) {
    return false // No data for today yet
  }

  // Calculate total cost for today
  const currentCost = currentDayCosts.reduce(
    (sum: number, row: any) => sum + row.cost_usd,
    0
  )

  // Get top 3 resources by cost
  const topResources = currentDayCosts
    .sort((a: any, b: any) => b.cost_usd - a.cost_usd)
    .slice(0, 3)
    .map((r: any) => ({
      name: r.resource_name || 'Unknown Resource',
      cost: r.cost_usd,
    }))

  // Evaluate based on rule type
  switch (type) {
    case 'THRESHOLD': {
      if (!threshold_amount) return false

      if (currentCost > threshold_amount) {
        return {
          severity: getSeverity('THRESHOLD', currentCost, threshold_amount),
          currentCost,
          thresholdValue: threshold_amount,
          topResources,
        }
      }
      break
    }

    case 'PERCENTAGE_SPIKE': {
      if (!threshold_percent) return false

      // Get yesterday's cost
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toISOString().split('T')[0]

      const { data: yesterdayCosts } = await (supabase
        .from('cost_snapshots') as any)
        .select('cost_usd')
        .eq('tenant_id', tenant_id)
        .eq('date', yesterdayDate)

      if (!yesterdayCosts || yesterdayCosts.length === 0) {
        return false // Can't compare without yesterday's data
      }

      const yesterdayCost = yesterdayCosts.reduce(
        (sum: number, row: any) => sum + row.cost_usd,
        0
      )

      if (yesterdayCost === 0) return false // Avoid division by zero

      const percentChange = ((currentCost - yesterdayCost) / yesterdayCost) * 100

      if (percentChange > threshold_percent) {
        return {
          severity: getSeverity('PERCENTAGE_SPIKE', percentChange, threshold_percent),
          currentCost,
          thresholdValue: yesterdayCost,
          percentChange: Math.round(percentChange * 10) / 10,
          topResources,
        }
      }
      break
    }

    case 'BUDGET': {
      if (!threshold_percent) return false

      // Calculate month-to-date costs
      const firstDayOfMonth = new Date()
      firstDayOfMonth.setDate(1)
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]

      const { data: monthCosts } = await (supabase
        .from('cost_snapshots') as any)
        .select('cost_usd')
        .eq('tenant_id', tenant_id)
        .gte('date', firstDayStr)
        .lte('date', today)

      if (!monthCosts || monthCosts.length === 0) {
        return false
      }

      const monthToDateCost = monthCosts.reduce(
        (sum: number, row: any) => sum + row.cost_usd,
        0
      )

      // For budget alerts, we need a reference budget
      // For now, project based on average daily spend
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate()
      const dayOfMonth = new Date().getDate()
      const projectedMonthCost = (monthToDateCost / dayOfMonth) * daysInMonth

      // Check if we've exceeded threshold percentage of projected budget
      const budgetUsedPercent = (monthToDateCost / projectedMonthCost) * 100

      if (budgetUsedPercent > threshold_percent) {
        return {
          severity: getSeverity('BUDGET', budgetUsedPercent, threshold_percent),
          currentCost: monthToDateCost,
          thresholdValue: projectedMonthCost,
          percentChange: Math.round(budgetUsedPercent * 10) / 10,
          topResources,
        }
      }
      break
    }

    case 'ANOMALY': {
      if (!threshold_amount) return false

      // Check for weekend activity (simple anomaly detection)
      const dayOfWeek = new Date().getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      if (isWeekend && currentCost > threshold_amount) {
        return {
          severity: 'medium',
          currentCost,
          thresholdValue: threshold_amount,
          topResources,
        }
      }
      break
    }
  }

  return false
}

/**
 * Determine alert severity based on how much threshold was exceeded
 */
function getSeverity(
  type: string,
  currentValue: number,
  thresholdValue: number
): 'critical' | 'high' | 'medium' | 'low' {
  const ratio = currentValue / thresholdValue

  if (ratio >= 2.0) return 'critical' // 200%+ of threshold
  if (ratio >= 1.5) return 'high' // 150%+ of threshold
  if (ratio >= 1.2) return 'medium' // 120%+ of threshold
  return 'low' // Just exceeded threshold
}

/**
 * Create alert event and send notifications
 */
async function createAlertEvent(
  rule: AlertRule,
  alertData: any,
  supabase: any
) {
  const { severity, currentCost, thresholdValue, percentChange, topResources } = alertData

  // Check for duplicate alert in the last hour
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const { data: recentAlerts } = await (supabase
    .from('alert_history') as any)
    .select('id')
    .eq('alert_rule_id', rule.id)
    .eq('tenant_id', rule.tenant_id)
    .gte('created_at', oneHourAgo.toISOString())
    .limit(1)

  if (recentAlerts && recentAlerts.length > 0) {
    console.log(`[ALERTS] Skipping duplicate alert for rule: ${rule.name}`)
    return
  }

  // Create alert history entry
  const alertTitle = `${rule.name} - ${severity.toUpperCase()}`
  const alertMessage = percentChange
    ? `Cost increased by ${percentChange}% and exceeded threshold`
    : `Cost exceeded threshold of $${thresholdValue.toFixed(2)}`

  const { data: alertEvent, error: createError } = await (supabase
    .from('alert_history') as any)
    .insert({
      org_id: rule.org_id,
      alert_rule_id: rule.id,
      tenant_id: rule.tenant_id,
      severity,
      title: alertTitle,
      message: alertMessage,
      current_value: currentCost,
      threshold_value: thresholdValue,
      status: 'active',
      metadata: {
        percent_change: percentChange,
        top_resources: topResources,
      },
      triggered_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (createError) {
    console.error('[ALERTS] Failed to create alert event:', createError)
    return
  }

  console.log(`[ALERTS] ✓ Created alert: ${alertTitle}`)

  // Send notifications
  if (rule.notification_channels?.email) {
    await sendEmailNotification(rule, alertEvent, alertData, supabase)
  }
}

/**
 * Send email notification for alert
 */
async function sendEmailNotification(
  rule: AlertRule,
  alertEvent: any,
  alertData: any,
  supabase: any
) {
  try {
    // Get org users with email addresses
    const { data: users } = await (supabase
      .from('users') as any)
      .select('email')
      .eq('org_id', rule.org_id)

    if (!users || users.length === 0) {
      console.log('[ALERTS] No users found to notify')
      return
    }

    const tenantName = (rule as any).azure_tenants?.name || 'Unknown Tenant'

    // Send email to all org users
    for (const user of users) {
      try {
        await sendAlertEmail({
          to: user.email,
          alertRuleName: rule.name,
          tenantName,
          severity: alertData.severity,
          currentCost: alertData.currentCost,
          thresholdValue: alertData.thresholdValue,
          percentChange: alertData.percentChange,
          topResources: alertData.topResources,
          alertId: alertEvent.id,
        })

        console.log(`[ALERTS] ✓ Email sent to ${user.email}`)
      } catch (error: any) {
        console.error(`[ALERTS] Failed to send email to ${user.email}:`, error.message)
      }
    }
  } catch (error: any) {
    console.error('[ALERTS] Failed to send email notifications:', error.message)
  }
}
