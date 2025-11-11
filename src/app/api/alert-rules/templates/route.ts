import { NextResponse } from 'next/server'

// GET /api/alert-rules/templates - Get pre-built alert rule templates
export async function GET() {
  const templates = [
    {
      id: 'daily-spike-30',
      name: 'Daily Spike >30%',
      description: 'Alert when daily costs increase by more than 30% compared to yesterday',
      type: 'PERCENTAGE_SPIKE',
      threshold_percent: 30,
      threshold_amount: null,
      notification_channels: { email: true },
      status: 'active',
      severity: 'high',
      icon: 'TrendingUp'
    },
    {
      id: 'daily-cost-100',
      name: 'Daily Cost >$100',
      description: 'Alert when daily spending exceeds $100',
      type: 'THRESHOLD',
      threshold_amount: 100,
      threshold_percent: null,
      notification_channels: { email: true },
      status: 'active',
      severity: 'medium',
      icon: 'DollarSign'
    },
    {
      id: 'monthly-budget-80',
      name: 'Monthly Budget 80% Reached',
      description: 'Alert when monthly spending reaches 80% of projected budget',
      type: 'BUDGET',
      threshold_percent: 80,
      threshold_amount: null,
      notification_channels: { email: true },
      status: 'active',
      severity: 'medium',
      icon: 'Wallet'
    },
    {
      id: 'weekend-activity',
      name: 'Weekend Activity Alert',
      description: 'Alert for unexpected spending on weekends (Saturday/Sunday)',
      type: 'ANOMALY',
      threshold_percent: null,
      threshold_amount: 50,
      notification_channels: { email: true },
      status: 'active',
      severity: 'low',
      icon: 'Calendar'
    },
    {
      id: 'critical-threshold',
      name: 'Critical Cost Threshold',
      description: 'Alert when daily costs exceed $500 (critical)',
      type: 'THRESHOLD',
      threshold_amount: 500,
      threshold_percent: null,
      notification_channels: { email: true },
      status: 'active',
      severity: 'critical',
      icon: 'AlertTriangle'
    }
  ]

  return NextResponse.json({ data: templates })
}
