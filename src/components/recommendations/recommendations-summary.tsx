'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown, AlertTriangle, Info, Lightbulb } from 'lucide-react'

interface RecommendationsSummaryProps {
  summary: {
    total_recommendations: number
    total_potential_monthly_savings: number
    total_potential_annual_savings: number
    by_severity: {
      high: number
      medium: number
      low: number
    }
    by_type: Record<string, number>
  }
}

export function RecommendationsSummary({ summary }: RecommendationsSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Recommendations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Recommendations
          </CardTitle>
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.total_recommendations}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.by_severity.high > 0 && (
              <span className="text-destructive font-medium">
                {summary.by_severity.high} high priority
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Monthly Savings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly Savings Potential
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            ${summary.total_potential_monthly_savings.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estimated savings per month
          </p>
        </CardContent>
      </Card>

      {/* Annual Savings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Annual Savings Potential
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            ${summary.total_potential_annual_savings.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estimated savings per year
          </p>
        </CardContent>
      </Card>

      {/* Severity Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            By Severity
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-destructive">High</span>
              <span className="font-medium">{summary.by_severity.high}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-warning">Medium</span>
              <span className="font-medium">{summary.by_severity.medium}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-info">Low</span>
              <span className="font-medium">{summary.by_severity.low}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
