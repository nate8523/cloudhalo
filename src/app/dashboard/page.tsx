import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartSkeleton } from '@/components/ui/chart-skeleton'
import { ChartPlaceholder } from '@/components/ui/chart-placeholder'
import { DollarSign, TrendingUp, AlertTriangle, Cloud } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch tenant count from database
  const { data: { user } } = await supabase.auth.getUser()
  let totalTenants = 0

  if (user) {
    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null }

    if (userData?.org_id) {
      // Count tenants for this organization
      const { count } = await supabase
        .from('azure_tenants')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userData.org_id)

      totalTenants = count || 0
    }
  }

  const stats = {
    totalCost: 24567.89,
    totalTenants,
    activeAlerts: 0,
    savingsOpportunities: 0,
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-display-sm font-bold text-foreground">Dashboard</h1>
        <p className="text-body text-muted-foreground">
          Overview of all your Azure tenants and costs
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Total Monthly Cost</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 transition-all duration-300 group-hover:from-primary/30 group-hover:to-primary/20 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground stat-card-value">
              ${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-body-sm text-muted-foreground mt-2 flex items-center gap-1">
              <span className="text-gradient-success font-semibold inline-flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l-5 5 5 5M19 12H6" /></svg>
                12%
              </span>
              <span>from last month</span>
            </p>
          </CardContent>
        </Card>

        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Connected Tenants</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-accent/20 to-accent/10 p-2.5 transition-all duration-300 group-hover:from-accent/30 group-hover:to-accent/20 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-accent/20">
              <Cloud className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground stat-card-value">{stats.totalTenants}</div>
            <p className="text-body-sm text-muted-foreground mt-2">
              {stats.totalTenants === 0 ? (
                <a href="/dashboard/tenants/new" className="text-primary hover:text-primary/80 font-medium transition-all duration-200 inline-flex items-center gap-1 group/link hover:gap-1.5">
                  Connect your first tenant
                  <span className="transition-transform duration-200 group-hover/link:translate-x-0.5">→</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="status-dot status-dot-success"></span>
                  All tenants active
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Active Alerts</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-warning/20 to-warning/10 p-2.5 transition-all duration-300 group-hover:from-warning/30 group-hover:to-warning/20 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground stat-card-value">{stats.activeAlerts}</div>
            <p className="text-body-sm text-muted-foreground mt-2">
              {stats.activeAlerts > 0 ? (
                <span className="text-gradient-warning font-semibold inline-flex items-center gap-1.5">
                  <span className="status-dot status-dot-warning animate-pulse"></span>
                  Requires attention
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="status-dot status-dot-success"></span>
                  All systems normal
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Savings Opportunities</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-success/20 to-success/10 p-2.5 transition-all duration-300 group-hover:from-success/30 group-hover:to-success/20 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-success/20">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground stat-card-value">${stats.savingsOpportunities.toLocaleString()}</div>
            <p className="text-body-sm text-muted-foreground mt-2">
              {stats.savingsOpportunities > 0 ? (
                <span className="text-gradient-success font-semibold">Potential monthly savings</span>
              ) : (
                'Potential monthly savings'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start Guide */}
      {stats.totalTenants === 0 && (
        <Card variant="glassmorphism" className="border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 animate-slide-in-bottom overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none"></div>
          <CardHeader className="relative">
            <CardTitle className="text-display-xs text-gradient">Welcome to CloudHalo!</CardTitle>
            <CardDescription className="text-body text-foreground/70">Get started in 3 easy steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative">
            <div className="flex items-start space-x-4 group/step transition-all duration-200 hover:translate-x-1">
              <Badge variant="gradient" className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-sm shadow-md">1</Badge>
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-foreground text-body-lg">Connect your first Azure tenant</p>
                <p className="text-body-sm text-muted-foreground">
                  Generate a PowerShell script and run it in Azure Cloud Shell (takes 5 minutes)
                </p>
                <a href="/dashboard/tenants/new" className="text-body-sm text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1 transition-all duration-200 group/link mt-2 hover:gap-1.5">
                  Connect tenant
                  <span className="transition-transform duration-200 group-hover/link:translate-x-0.5">→</span>
                </a>
              </div>
            </div>
            <div className="flex items-start space-x-4 group/step transition-all duration-200 hover:translate-x-1">
              <Badge variant="gradient" className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-sm shadow-md">2</Badge>
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-foreground text-body-lg">Configure cost alerts</p>
                <p className="text-body-sm text-muted-foreground">
                  Set up automatic notifications when costs spike unexpectedly
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4 group/step transition-all duration-200 hover:translate-x-1">
              <Badge variant="gradient" className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-sm shadow-md">3</Badge>
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-foreground text-body-lg">Review optimization recommendations</p>
                <p className="text-body-sm text-muted-foreground">
                  Identify idle resources and potential cost savings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Trends Chart */}
      <Card variant="premium" className="overflow-hidden group">
        <CardHeader>
          <CardTitle className="text-display-xs text-foreground">Cost Trends</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">Last 30 days across all tenants</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          {stats.totalTenants === 0 ? (
            <ChartPlaceholder
              title="Connect a tenant to see cost trends"
              description="Real-time cost monitoring and analytics across all your Azure tenants"
              icon="trend"
            />
          ) : (
            <ChartSkeleton variant="area" showGrid showAxes />
          )}
        </CardContent>
      </Card>

      {/* Additional Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="premium" className="overflow-hidden group">
          <CardHeader>
            <CardTitle className="text-body-lg text-foreground">Cost by Service</CardTitle>
            <CardDescription className="text-body-sm text-muted-foreground">Top Azure services by spend</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {stats.totalTenants === 0 ? (
              <ChartPlaceholder
                title="Service breakdown"
                description="See which Azure services cost the most"
                icon="pie"
              />
            ) : (
              <ChartSkeleton variant="bar" showGrid showAxes />
            )}
          </CardContent>
        </Card>

        <Card variant="premium" className="overflow-hidden group">
          <CardHeader>
            <CardTitle className="text-body-lg text-foreground">Resource Distribution</CardTitle>
            <CardDescription className="text-body-sm text-muted-foreground">Resources by type</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {stats.totalTenants === 0 ? (
              <ChartPlaceholder
                title="Resource overview"
                description="Track your Azure resources across tenants"
                icon="bar"
              />
            ) : (
              <ChartSkeleton variant="donut" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
