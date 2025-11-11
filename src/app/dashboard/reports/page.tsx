import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateScheduledReportForm } from '@/components/reports/create-scheduled-report-form'
import { ScheduledReportsList } from '@/components/reports/scheduled-reports-list'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Reports - CloudHalo',
  description: 'Manage scheduled reports and export cost data',
}

export default async function ReportsPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user's org_id
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  // Fetch available tenants for the form
  const { data: tenants } = await supabase
    .from('azure_tenants')
    .select('id, name, azure_tenant_id')
    .eq('org_id', (userData as any).org_id)
    .eq('connection_status', 'connected')
    .order('name')

  return (
    <div className="container max-w-6xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-2">
            Schedule automated cost reports and export data to PDF.
          </p>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <CreateScheduledReportForm tenants={tenants || []} />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Scheduled Reports</h2>
            <ScheduledReportsList />
          </div>
        </div>
      </div>
    </div>
  )
}
