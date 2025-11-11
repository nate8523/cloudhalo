'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, TrendingUp, Calendar, Filter } from 'lucide-react'
import { CostFilters } from '@/components/costs/cost-filters'
import { CostChart } from '@/components/costs/cost-chart'
import { CostBreakdown } from '@/components/costs/cost-breakdown'
import { CostTable } from '@/components/costs/cost-table'

interface Tenant {
  id: string
  name: string
}

interface CostSnapshot {
  id: string
  date: string
  cost_usd: number
  service_category: string | null
  resource_name: string | null
  resource_type: string | null
  resource_group: string | null
  location: string | null
  subscription_id: string
}

interface CostsPageClientProps {
  costData: CostSnapshot[]
  tenants: Tenant[]
  serviceCategories: string[]
  currentFilters: {
    startDate: string
    endDate: string
    tenantId?: string
    serviceCategory?: string
  }
  totalCost: number
  avgDailyCost: number
  costChange: number
}

export function CostsPageClient({
  costData,
  tenants,
  serviceCategories,
  currentFilters,
  totalCost,
  avgDailyCost,
  costChange
}: CostsPageClientProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-display-sm font-bold text-foreground">Cost Analysis</h1>
          <p className="text-body text-muted-foreground">
            Detailed cost breakdown across all Azure tenants
          </p>
        </div>
      </div>

      {/* Filters */}
      <CostFilters
        tenants={tenants}
        serviceCategories={serviceCategories}
        currentFilters={currentFilters}
      />

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Total Cost</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 transition-all duration-300 group-hover:from-primary/30 group-hover:to-primary/20 group-hover:scale-110">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground">
              ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-body-sm text-muted-foreground mt-2 flex items-center gap-1">
              <span className={`font-semibold inline-flex items-center gap-0.5 ${
                costChange > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {costChange > 0 ? '↑' : '↓'}
                {Math.abs(costChange).toFixed(1)}%
              </span>
              <span>vs previous period</span>
            </p>
          </CardContent>
        </Card>

        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Avg Daily Cost</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-accent/20 to-accent/10 p-2.5 transition-all duration-300 group-hover:from-accent/30 group-hover:to-accent/20 group-hover:scale-110">
              <Calendar className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground">
              ${avgDailyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-body-sm text-muted-foreground mt-2">
              Per day in selected period
            </p>
          </CardContent>
        </Card>

        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Total Records</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-success/20 to-success/10 p-2.5 transition-all duration-300 group-hover:from-success/30 group-hover:to-success/20 group-hover:scale-110">
              <Filter className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground">
              {costData.length.toLocaleString()}
            </div>
            <p className="text-body-sm text-muted-foreground mt-2">
              Cost snapshots
            </p>
          </CardContent>
        </Card>

        <Card variant="premium" className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-label-lg text-muted-foreground">Date Range</CardTitle>
            <div className="rounded-full bg-gradient-to-br from-warning/20 to-warning/10 p-2.5 transition-all duration-300 group-hover:from-warning/30 group-hover:to-warning/20 group-hover:scale-110">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-display-xs font-bold text-foreground">
              {new Set(costData.map(r => r.date)).size}
            </div>
            <p className="text-body-sm text-muted-foreground mt-2">
              Days of data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Trend Chart */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-display-xs text-foreground">Cost Trends</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            Daily cost trends for selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-[350px] w-full" />}>
            <CostChart data={costData} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <CostBreakdown data={costData} />
        </Suspense>
      </div>

      {/* Detailed Cost Table */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-display-xs text-foreground">Detailed Cost Records</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            All cost records for the selected filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
            <CostTable data={costData} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
