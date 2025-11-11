'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AlertRuleList } from '@/components/alerts/alert-rule-list'
import { AlertRuleForm } from '@/components/alerts/alert-rule-form'

export default function AlertRulesPage() {
  const router = useRouter()
  const [alertRules, setAlertRules] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch alert rules and tenants in parallel
      const [rulesRes, tenantsRes] = await Promise.all([
        fetch('/api/alert-rules'),
        fetch('/api/tenants/connect'),
      ])

      if (!rulesRes.ok || !tenantsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const rulesData = await rulesRes.json()
      const tenantsData = await tenantsRes.json()

      setAlertRules(rulesData.data || [])
      setTenants(tenantsData.tenants || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load alert rules. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRule = async (data: any) => {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create alert rule')
      }

      // Refresh the list
      await fetchData()
      setShowCreateForm(false)
    } catch (err: any) {
      console.error('Error creating alert rule:', err)
      setError(err.message || 'Failed to create alert rule')
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleStatus = async (ruleId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/alert-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update alert rule')
      }

      // Update local state
      setAlertRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId ? { ...rule, status: newStatus } : rule
        )
      )
    } catch (err) {
      console.error('Error updating alert rule:', err)
      setError('Failed to update alert rule')
    }
  }

  const handleDelete = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/alert-rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete alert rule')
      }

      // Remove from local state
      setAlertRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    } catch (err) {
      console.error('Error deleting alert rule:', err)
      setError('Failed to delete alert rule')
    }
  }

  const handleEdit = (ruleId: string) => {
    // TODO: Implement edit functionality (could open a modal or navigate to edit page)
    console.log('Edit rule:', ruleId)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold">Alert Rules</h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage cost alert rules for your Azure tenants
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Alert Rule
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card variant="premium" className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card variant="premium">
          <CardHeader>
            <CardTitle>Create Alert Rule</CardTitle>
            <CardDescription>
              Set up a new alert rule to monitor Azure costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertRuleForm
              tenants={tenants}
              onSubmit={handleCreateRule}
              onCancel={() => setShowCreateForm(false)}
              isLoading={isCreating}
            />
          </CardContent>
        </Card>
      )}

      {/* Alert Rules List */}
      <Card variant="premium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Alert Rules</CardTitle>
              <CardDescription>
                {alertRules.length} active alert rule{alertRules.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-sm text-muted-foreground">Loading alert rules...</p>
            </div>
          ) : (
            <AlertRuleList
              alertRules={alertRules}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      {/* Quick Start Guide */}
      {!isLoading && alertRules.length === 0 && !showCreateForm && (
        <Card variant="glassmorphism">
          <CardHeader>
            <CardTitle>Getting Started with Alert Rules</CardTitle>
            <CardDescription>
              Create your first alert rule to start monitoring Azure costs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                  <div className="rounded-full bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                </div>
                <div>
                  <p className="font-medium">Choose an alert type</p>
                  <p className="text-sm text-muted-foreground">
                    Select from Percentage Spike, Cost Threshold, Budget Alert, or Anomaly Detection
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                  <div className="rounded-full bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                </div>
                <div>
                  <p className="font-medium">Set your thresholds</p>
                  <p className="text-sm text-muted-foreground">
                    Define the dollar amount or percentage that triggers an alert
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                  <div className="rounded-full bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                </div>
                <div>
                  <p className="font-medium">Get notified</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications when costs exceed your thresholds
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowCreateForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Alert Rule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
