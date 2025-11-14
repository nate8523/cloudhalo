/**
 * Digest Aggregator
 * Handles aggregating alerts and generating digest emails
 */

import type { Database } from '@/types/database'
import type { AlertForDigest } from './queue-manager'

export interface DigestData {
  org_id: string
  period_start: string
  period_end: string
  total_alerts: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  alerts_by_tenant: {
    tenant_name: string
    tenant_id: string
    alerts: AlertForDigest[]
    total_cost_impact: number
  }[]
  total_cost_impact: number
  recommendations_summary?: {
    total_recommendations: number
    total_potential_savings: number
  }
  cost_summary?: {
    total_spend: number
    vs_previous_period: number
  }
}

/**
 * Aggregates alerts into a structured digest format
 */
export function aggregateAlertsForDigest(
  alerts: AlertForDigest[],
  preferences?: {
    include_resolved_alerts?: boolean
    include_recommendations?: boolean
    include_cost_summary?: boolean
  }
): DigestData {
  // Validate input
  if (!alerts || alerts.length === 0) {
    throw new Error('Cannot aggregate empty alerts array')
  }

  // Validate first alert has required fields
  if (!alerts[0].org_id) {
    throw new Error('Alerts must have org_id')
  }

  // Group alerts by tenant
  const tenantMap = new Map<string, {
    tenant_name: string
    tenant_id: string
    alerts: AlertForDigest[]
    total_cost_impact: number
  }>()

  let criticalCount = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let totalCostImpact = 0

  for (const alert of alerts) {
    // Validate alert data
    if (!alert.tenant_id || !alert.severity) {
      console.warn('[Aggregator] Skipping alert with missing required fields:', alert.id)
      continue
    }

    // Count by severity
    switch (alert.severity) {
      case 'critical':
        criticalCount++
        break
      case 'high':
        highCount++
        break
      case 'medium':
        mediumCount++
        break
      case 'low':
        lowCount++
        break
      default:
        console.warn(`[Aggregator] Unknown severity level: ${alert.severity}`)
    }

    // Calculate cost impact (safely handle missing values)
    const currentValue = alert.current_value || 0
    const thresholdValue = alert.threshold_value || 0
    const costImpact = Math.max(0, currentValue - thresholdValue) // Ensure non-negative
    totalCostImpact += costImpact

    // Group by tenant
    if (!tenantMap.has(alert.tenant_id)) {
      tenantMap.set(alert.tenant_id, {
        tenant_name: alert.tenant_name || 'Unknown Tenant',
        tenant_id: alert.tenant_id,
        alerts: [],
        total_cost_impact: 0
      })
    }

    const tenantGroup = tenantMap.get(alert.tenant_id)!
    tenantGroup.alerts.push(alert)
    tenantGroup.total_cost_impact += costImpact
  }

  // Convert map to array and sort by cost impact
  const alertsByTenant = Array.from(tenantMap.values())
    .sort((a, b) => b.total_cost_impact - a.total_cost_impact)

  // Calculate period
  const sortedAlerts = [...alerts]
    .filter(a => a.triggered_at) // Filter out alerts without timestamp
    .sort((a, b) =>
      new Date(a.triggered_at).getTime() - new Date(b.triggered_at).getTime()
    )

  const periodStart = sortedAlerts[0]?.triggered_at || new Date().toISOString()
  const periodEnd = sortedAlerts[sortedAlerts.length - 1]?.triggered_at || new Date().toISOString()

  return {
    org_id: alerts[0].org_id,
    period_start: periodStart,
    period_end: periodEnd,
    total_alerts: alerts.length,
    critical_count: criticalCount,
    high_count: highCount,
    medium_count: mediumCount,
    low_count: lowCount,
    alerts_by_tenant: alertsByTenant,
    total_cost_impact: totalCostImpact
  }
}

/**
 * Generates a human-readable summary of the digest period
 */
export function formatDigestPeriod(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const now = new Date()

  // Same day
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Different days
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return `${startStr} - ${endStr}`
}

/**
 * Generates severity distribution summary text
 */
export function formatSeveritySummary(data: DigestData): string {
  const parts: string[] = []

  if (data.critical_count > 0) {
    parts.push(`${data.critical_count} critical`)
  }
  if (data.high_count > 0) {
    parts.push(`${data.high_count} high`)
  }
  if (data.medium_count > 0) {
    parts.push(`${data.medium_count} medium`)
  }
  if (data.low_count > 0) {
    parts.push(`${data.low_count} low`)
  }

  if (parts.length === 0) {
    return 'No alerts'
  }

  if (parts.length === 1) {
    return parts[0]
  }

  if (parts.length === 2) {
    return parts.join(' and ')
  }

  return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]
}

/**
 * Calculates time since alert was triggered
 */
export function formatTimeSince(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  }
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
}

/**
 * Converts DigestData to DigestEmailData format for email templates
 */
export function mapToDigestEmailData(
  digestData: DigestData,
  organizationName: string,
  digestFrequency: string,
  dashboardUrl: string
): {
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
} {
  return {
    organizationName,
    periodStart: digestData.period_start,
    periodEnd: digestData.period_end,
    totalAlerts: digestData.total_alerts,
    criticalCount: digestData.critical_count,
    highCount: digestData.high_count,
    mediumCount: digestData.medium_count,
    lowCount: digestData.low_count,
    totalCostImpact: digestData.total_cost_impact,
    alertsByTenant: digestData.alerts_by_tenant.map(tenant => ({
      tenantName: tenant.tenant_name,
      tenantId: tenant.tenant_id,
      alertCount: tenant.alerts.length,
      totalCostImpact: tenant.total_cost_impact,
      alerts: tenant.alerts.map(alert => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        currentValue: alert.current_value,
        thresholdValue: alert.threshold_value,
        triggeredAt: alert.triggered_at,
      }))
    })),
    dashboardLink: dashboardUrl,
    digestFrequency,
  }
}
