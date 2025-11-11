'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Mail, Trash2 } from 'lucide-react'

interface ScheduledReport {
  id: string
  name: string
  frequency: string
  report_type: string
  recipients: string[]
  enabled: boolean
  last_run_at: string | null
  azure_tenants: {
    id: string
    name: string
    azure_tenant_id: string
  }
}

export function ScheduledReportsList() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports/scheduled')
      if (!response.ok) {
        throw new Error('Failed to fetch reports')
      }
      const data = await response.json()
      setReports(data.reports || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return
    }

    try {
      const response = await fetch(`/api/reports/scheduled/${reportId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete report')
      }

      setReports(reports.filter((r) => r.id !== reportId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete report')
    }
  }

  const handleToggleEnabled = async (reportId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/reports/scheduled/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !currentEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update report')
      }

      const data = await response.json()
      setReports(reports.map((r) => (r.id === reportId ? data.report : r)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update report')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No scheduled reports yet. Create your first automated report to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{report.name}</CardTitle>
                <CardDescription>{report.azure_tenants.name}</CardDescription>
              </div>
              <Badge variant={report.enabled ? 'default' : 'secondary'}>
                {report.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">{report.frequency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{report.recipients.length} recipient(s)</span>
                </div>
              </div>

              {report.last_run_at && (
                <p className="text-sm text-muted-foreground">
                  Last sent: {new Date(report.last_run_at).toLocaleDateString()}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleEnabled(report.id, report.enabled)}
                >
                  {report.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(report.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
