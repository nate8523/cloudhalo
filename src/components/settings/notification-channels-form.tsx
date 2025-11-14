'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const formSchema = z.object({
  teams_enabled: z.boolean(),
  teams_webhook_url: z.string().optional(),
  slack_enabled: z.boolean(),
  slack_webhook_url: z.string().optional(),
}).refine((data) => {
  // If Teams is enabled, webhook URL is required
  if (data.teams_enabled && !data.teams_webhook_url) {
    return false
  }
  // If Slack is enabled, webhook URL is required
  if (data.slack_enabled && !data.slack_webhook_url) {
    return false
  }
  return true
}, {
  message: 'Webhook URL is required when channel is enabled'
})

type FormData = z.infer<typeof formSchema>

interface TestResult {
  success: boolean
  message?: string
}

export function NotificationChannelsForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingTeams, setTestingTeams] = useState(false)
  const [testingSlack, setTestingSlack] = useState(false)
  const [teamsTestResult, setTeamsTestResult] = useState<TestResult | null>(null)
  const [slackTestResult, setSlackTestResult] = useState<TestResult | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teams_enabled: false,
      teams_webhook_url: '',
      slack_enabled: false,
      slack_webhook_url: ''
    }
  })

  const { watch, setValue } = form
  const teamsEnabled = watch('teams_enabled')
  const slackEnabled = watch('slack_enabled')

  // Load existing configuration
  useEffect(() => {
    async function loadChannels() {
      try {
        const response = await fetch('/api/notifications/channels')
        if (!response.ok) throw new Error('Failed to load notification channels')

        const { data } = await response.json()

        if (data) {
          form.reset({
            teams_enabled: data.teams_enabled || false,
            teams_webhook_url: data.teams_webhook_url || '',
            slack_enabled: data.slack_enabled || false,
            slack_webhook_url: data.slack_webhook_url || ''
          })
        }
      } catch (error) {
        console.error('Error loading notification channels:', error)
      } finally {
        setLoading(false)
      }
    }

    loadChannels()
  }, [form])

  // Clear test results when URLs change
  useEffect(() => {
    setTeamsTestResult(null)
  }, [watch('teams_webhook_url')])

  useEffect(() => {
    setSlackTestResult(null)
  }, [watch('slack_webhook_url')])

  async function onSubmit(data: FormData) {
    setSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/notifications/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save notification channels')
      }

      setSaveMessage({ type: 'success', text: 'Notification channels saved successfully!' })

      // Clear success message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000)
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save notification channels' })
    } finally {
      setSaving(false)
    }
  }

  async function testTeamsWebhook() {
    const webhookUrl = watch('teams_webhook_url')
    if (!webhookUrl) return

    setTestingTeams(true)
    setTeamsTestResult(null)

    try {
      const response = await fetch('/api/notifications/test-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      })

      const data = await response.json()

      if (response.ok) {
        setTeamsTestResult({ success: true, message: 'Test notification sent successfully!' })
      } else {
        setTeamsTestResult({ success: false, message: data.error || 'Test failed' })
      }
    } catch (error: any) {
      setTeamsTestResult({ success: false, message: error.message || 'Test failed' })
    } finally {
      setTestingTeams(false)
    }
  }

  async function testSlackWebhook() {
    const webhookUrl = watch('slack_webhook_url')
    if (!webhookUrl) return

    setTestingSlack(true)
    setSlackTestResult(null)

    try {
      const response = await fetch('/api/notifications/test-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      })

      const data = await response.json()

      if (response.ok) {
        setSlackTestResult({ success: true, message: 'Test notification sent successfully!' })
      } else {
        setSlackTestResult({ success: false, message: data.error || 'Test failed' })
      }
    } catch (error: any) {
      setSlackTestResult({ success: false, message: error.message || 'Test failed' })
    } finally {
      setTestingSlack(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Microsoft Teams */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Microsoft Teams</CardTitle>
              <CardDescription>
                Send cost alerts to your Microsoft Teams channels
              </CardDescription>
            </div>
            <Switch
              checked={teamsEnabled}
              onCheckedChange={(checked) => setValue('teams_enabled', checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teams_webhook_url">
              Incoming Webhook URL
              {teamsEnabled && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id="teams_webhook_url"
              type="url"
              placeholder="https://outlook.office.com/webhook/..."
              disabled={!teamsEnabled}
              {...form.register('teams_webhook_url')}
            />
            <p className="text-sm text-muted-foreground">
              Create an incoming webhook in Teams. <a href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Learn how</a>
            </p>
          </div>

          {teamsEnabled && watch('teams_webhook_url') && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={testTeamsWebhook}
                disabled={testingTeams}
              >
                {testingTeams && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Webhook
              </Button>

              {teamsTestResult && (
                <div className={`flex items-center gap-2 text-sm ${teamsTestResult.success ? 'text-green-600' : 'text-destructive'}`}>
                  {teamsTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{teamsTestResult.message}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slack */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Slack</CardTitle>
              <CardDescription>
                Send cost alerts to your Slack channels
              </CardDescription>
            </div>
            <Switch
              checked={slackEnabled}
              onCheckedChange={(checked) => setValue('slack_enabled', checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack_webhook_url">
              Incoming Webhook URL
              {slackEnabled && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id="slack_webhook_url"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              disabled={!slackEnabled}
              {...form.register('slack_webhook_url')}
            />
            <p className="text-sm text-muted-foreground">
              Create an incoming webhook in Slack. <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Learn how</a>
            </p>
          </div>

          {slackEnabled && watch('slack_webhook_url') && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={testSlackWebhook}
                disabled={testingSlack}
              >
                {testingSlack && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Webhook
              </Button>

              {slackTestResult && (
                <div className={`flex items-center gap-2 text-sm ${slackTestResult.success ? 'text-green-600' : 'text-destructive'}`}>
                  {slackTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{slackTestResult.message}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-md ${saveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-destructive/10 text-destructive'}`}>
          <div className="flex items-center gap-2">
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{saveMessage.text}</span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  )
}
