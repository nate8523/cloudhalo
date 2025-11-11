import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  TrendingUp,
  Filter,
  Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AlertActions } from '@/components/alerts/alert-actions'

export default async function AlertsPage() {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Get user's organization
  const { data: userData } = await (supabase
    .from('users') as any)
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!userData?.org_id) {
    notFound()
  }

  // Fetch alert history with related data
  const { data: alerts } = await (supabase
    .from('alert_history') as any)
    .select(`
      *,
      alert_rules (
        name,
        type
      ),
      azure_tenants (
        name,
        azure_tenant_id
      )
    `)
    .eq('org_id', userData.org_id)
    .order('triggered_at', { ascending: false })
    .limit(100)

  // Get summary statistics
  const activeAlerts = alerts?.filter((a: any) => a.status === 'active') || []
  const criticalCount = activeAlerts.filter((a: any) => a.severity === 'critical').length
  const highCount = activeAlerts.filter((a: any) => a.severity === 'high').length
  const mediumCount = activeAlerts.filter((a: any) => a.severity === 'medium').length
  const lowCount = activeAlerts.filter((a: any) => a.severity === 'low').length

  // Get severity icon and color
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: AlertTriangle,
          color: 'text-red-600 dark:text-red-500',
          bg: 'bg-red-100 dark:bg-red-950',
          badge: 'destructive' as const
        }
      case 'high':
        return {
          icon: AlertCircle,
          color: 'text-orange-600 dark:text-orange-500',
          bg: 'bg-orange-100 dark:bg-orange-950',
          badge: 'destructive' as const
        }
      case 'medium':
        return {
          icon: AlertCircle,
          color: 'text-yellow-600 dark:text-yellow-500',
          bg: 'bg-yellow-100 dark:bg-yellow-950',
          badge: 'secondary' as const
        }
      case 'low':
        return {
          icon: Info,
          color: 'text-blue-600 dark:text-blue-500',
          bg: 'bg-blue-100 dark:bg-blue-950',
          badge: 'secondary' as const
        }
      default:
        return {
          icon: Info,
          color: 'text-gray-600 dark:text-gray-500',
          bg: 'bg-gray-100 dark:bg-gray-950',
          badge: 'secondary' as const
        }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="destructive">Active</Badge>
      case 'acknowledged':
        return <Badge variant="secondary">Acknowledged</Badge>
      case 'resolved':
        return <Badge variant="default">Resolved</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold">Alerts</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage cost alerts from your Azure subscriptions
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/alerts/rules">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Manage Rules
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">
              Immediate action needed
            </p>
          </CardContent>
        </Card>

        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highCount}</div>
            <p className="text-xs text-muted-foreground">
              High priority items
            </p>
          </CardContent>
        </Card>

        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 100 alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>
            Recent cost alerts triggered from your subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!alerts || alerts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Alerts</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                You don't have any alerts yet. Alerts will appear here when cost thresholds are exceeded
                based on your configured alert rules.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert: any) => {
                const severityConfig = getSeverityConfig(alert.severity)
                const SeverityIcon = severityConfig.icon

                return (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg transition-all hover:border-primary/50 ${
                      alert.status === 'active' ? 'border-l-4' : ''
                    } ${
                      alert.status === 'active' && alert.severity === 'critical'
                        ? 'border-l-red-600'
                        : alert.status === 'active' && alert.severity === 'high'
                        ? 'border-l-orange-600'
                        : alert.status === 'active' && alert.severity === 'medium'
                        ? 'border-l-yellow-600'
                        : 'border-l-blue-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`rounded-lg p-2 ${severityConfig.bg}`}>
                          <SeverityIcon className={`h-5 w-5 ${severityConfig.color}`} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{alert.title}</h4>
                                <Badge variant={severityConfig.badge} className="capitalize">
                                  {alert.severity}
                                </Badge>
                                {getStatusBadge(alert.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                            <div>
                              <p className="font-medium mb-1">Tenant</p>
                              <p>{alert.azure_tenants?.name || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="font-medium mb-1">Alert Rule</p>
                              <p>{alert.alert_rules?.name || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="font-medium mb-1">Current Value</p>
                              <p className="font-mono">${alert.current_value.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="font-medium mb-1">Threshold</p>
                              <p className="font-mono">${alert.threshold_value.toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                Triggered {new Date(alert.triggered_at).toLocaleString()}
                              </span>
                            </div>
                            {alert.acknowledged_at && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>
                                  Acknowledged {new Date(alert.acknowledged_at).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {alert.resolved_at && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                <span>
                                  Resolved {new Date(alert.resolved_at).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <AlertActions alertId={alert.id} status={alert.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
