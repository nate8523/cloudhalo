/**
 * Optimization Recommendations Page
 *
 * Displays AI-powered cost optimization recommendations for Azure resources
 * This is a key differentiator feature from competitors
 */

import { createClient } from '@/lib/supabase/server'
import { RecommendationsPageClient } from './page-client'
import { Lightbulb } from 'lucide-react'
import type { Database } from '@/types/database'

export const metadata = {
  title: 'Optimization Recommendations | CloudHalo',
  description: 'AI-powered cost optimization recommendations for your Azure resources',
}

export default async function RecommendationsPage() {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  let stats = {
    totalRecommendations: 0,
    totalMonthlySavings: 0,
    totalAnnualSavings: 0,
    highPriority: 0,
  }

  let tenants: any[] = []

  if (user) {
    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null }

    if (userData?.org_id) {
      // Fetch tenants for dropdown filter
      const { data: tenantsData } = await supabase
        .from('azure_tenants')
        .select('id, name')
        .eq('org_id', userData.org_id)
        .eq('connection_status', 'connected')
        .order('name', { ascending: true })

      tenants = tenantsData || []

      // Get recommendation statistics
      const { data: recommendations, count } = await supabase
        .from('optimization_recommendations')
        .select('severity, potential_monthly_savings_usd, potential_annual_savings_usd', { count: 'exact' })
        .eq('org_id', userData.org_id)
        .eq('status', 'active') as {
          data: {
            severity: string
            potential_monthly_savings_usd: number
            potential_annual_savings_usd: number
          }[] | null
          count: number | null
          error: any
        }

      stats.totalRecommendations = count || 0

      if (recommendations && recommendations.length > 0) {
        // Calculate total savings
        stats.totalMonthlySavings = recommendations.reduce(
          (sum, r) => sum + (r.potential_monthly_savings_usd || 0),
          0
        )
        stats.totalAnnualSavings = recommendations.reduce(
          (sum, r) => sum + (r.potential_annual_savings_usd || 0),
          0
        )

        // Count high priority recommendations
        stats.highPriority = recommendations.filter(r => r.severity === 'high').length
      }
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-primary" />
            <h1 className="text-display-sm font-bold text-foreground">
              Optimization Recommendations
            </h1>
          </div>
          <p className="text-body text-muted-foreground">
            AI-powered insights to reduce Azure costs and improve resource efficiency
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      {stats.totalRecommendations > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-card rounded-lg border border-border p-6 shadow-[var(--shadow-4dp)]">
            <div className="text-sm font-medium text-muted-foreground">Total Recommendations</div>
            <div className="text-3xl font-bold mt-2">{stats.totalRecommendations}</div>
            {stats.highPriority > 0 && (
              <p className="text-xs text-destructive mt-1 font-medium">
                {stats.highPriority} high priority
              </p>
            )}
          </div>
          <div className="bg-card rounded-lg border border-border p-6 shadow-[var(--shadow-4dp)]">
            <div className="text-sm font-medium text-muted-foreground">Monthly Savings Potential</div>
            <div className="text-3xl font-bold text-success mt-2">
              ${stats.totalMonthlySavings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per month</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6 shadow-[var(--shadow-4dp)]">
            <div className="text-sm font-medium text-muted-foreground">Annual Savings Potential</div>
            <div className="text-3xl font-bold text-success mt-2">
              ${stats.totalAnnualSavings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per year</p>
          </div>
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-lg border border-primary/20 p-6 shadow-[var(--shadow-4dp)]">
            <div className="text-sm font-medium text-primary">Potential ROI</div>
            <div className="text-3xl font-bold text-primary mt-2">
              {stats.totalAnnualSavings > 0 ? Math.round(stats.totalAnnualSavings / 10) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estimated return</p>
          </div>
        </div>
      )}

      {/* Client-side component for recommendations */}
      <RecommendationsPageClient tenants={tenants} />
    </div>
  )
}
