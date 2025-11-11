'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  azure_tenant_id: string
}

interface CreateScheduledReportFormProps {
  tenants: Tenant[]
  onSuccess?: () => void
}

export function CreateScheduledReportForm({
  tenants,
  onSuccess,
}: CreateScheduledReportFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    tenant_id: '',
    frequency: 'weekly',
    report_type: 'cost_summary',
  })

  const [recipients, setRecipients] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState('')

  const handleAddRecipient = () => {
    const email = emailInput.trim()
    if (!email) return

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (recipients.includes(email)) {
      setError('This email is already in the recipients list')
      return
    }

    setRecipients([...recipients, email])
    setEmailInput('')
    setError(null)
  }

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    if (recipients.length === 0) {
      setError('Please add at least one recipient')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          recipients,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create scheduled report')
      }

      setSuccess(true)
      // Reset form
      setFormData({
        name: '',
        tenant_id: '',
        frequency: 'weekly',
        report_type: 'cost_summary',
      })
      setRecipients([])

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scheduled report')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Scheduled Report</CardTitle>
        <CardDescription>
          Set up automated cost reports to be sent via email on a regular schedule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Weekly Cost Summary"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenant">Azure Tenant</Label>
            <Select
              value={formData.tenant_id}
              onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}
              required
            >
              <SelectTrigger id="tenant">
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) => setFormData({ ...formData, frequency: value })}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (Mondays)</SelectItem>
                <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="report-type">Report Type</Label>
            <Select
              value={formData.report_type}
              onValueChange={(value) => setFormData({ ...formData, report_type: value })}
            >
              <SelectTrigger id="report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cost_summary">Cost Summary</SelectItem>
                <SelectItem value="detailed_breakdown">Detailed Breakdown</SelectItem>
                <SelectItem value="trend_analysis">Trend Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email Recipients</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="recipient@example.com"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddRecipient()
                  }
                }}
              />
              <Button type="button" onClick={handleAddRecipient} variant="outline">
                Add
              </Button>
            </div>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>
                Scheduled report created successfully!
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Creating...' : 'Create Scheduled Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
