import { Metadata } from 'next'
import { NotificationChannelsForm } from '@/components/settings/notification-channels-form'

export const metadata: Metadata = {
  title: 'Notification Settings | CloudHalo',
  description: 'Configure notification channels for cost alerts'
}

export default function NotificationSettingsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Channels</h1>
          <p className="text-muted-foreground mt-2">
            Configure where you receive cost alerts. Email notifications are always enabled.
            Add Microsoft Teams or Slack to receive alerts in your team channels.
          </p>
        </div>

        <NotificationChannelsForm />

        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                When creating alert rules, you can choose which channels receive notifications
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                Test each webhook before saving to ensure notifications are working
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                Webhook URLs are encrypted and stored securely in the database
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                Notifications include cost details, top resources, and direct links to CloudHalo
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
