'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, XCircle, TrendingDown, Lightbulb } from 'lucide-react'
import { Database } from '@/types/database'

type Recommendation = Database['public']['Tables']['optimization_recommendations']['Row']

interface RecommendationCardProps {
  recommendation: Recommendation
  onDismiss?: (id: string) => void
  onImplement?: (id: string) => void
}

export function RecommendationCard({
  recommendation,
  onDismiss,
  onImplement
}: RecommendationCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'idle_vm':
        return 'Idle VM'
      case 'unused_disk':
        return 'Unused Resource'
      case 'oversized_resource':
        return 'Oversized'
      case 'reserved_instance':
        return 'Reserved Instance'
      case 'untagged_resource':
        return 'Missing Tags'
      default:
        return type
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'success'
      case 'medium':
        return 'warning'
      case 'high':
        return 'destructive'
      default:
        return 'default'
    }
  }

  const handleDismiss = async () => {
    if (!onDismiss) return
    setIsUpdating(true)
    try {
      await onDismiss(recommendation.id)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleImplement = async () => {
    if (!onImplement) return
    setIsUpdating(true)
    try {
      await onImplement(recommendation.id)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="hover:border-primary/30 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getSeverityColor(recommendation.severity)}>
                {recommendation.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {getTypeLabel(recommendation.recommendation_type)}
              </Badge>
              {recommendation.potential_monthly_savings_usd > 0 && (
                <Badge variant="success" className="gap-1">
                  <TrendingDown className="h-3 w-3" />
                  ${recommendation.potential_monthly_savings_usd.toFixed(2)}/mo
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{recommendation.title}</CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2">
          {recommendation.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resource Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Resource</div>
            <div className="font-medium truncate" title={recommendation.resource_name}>
              {recommendation.resource_name}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Resource Group</div>
            <div className="font-medium truncate" title={recommendation.resource_group}>
              {recommendation.resource_group}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Type</div>
            <div className="font-medium text-xs truncate" title={recommendation.resource_type}>
              {recommendation.resource_type}
            </div>
          </div>
          {recommendation.location && (
            <div>
              <div className="text-muted-foreground">Location</div>
              <div className="font-medium">{recommendation.location}</div>
            </div>
          )}
        </div>

        {/* Cost Impact */}
        {recommendation.potential_monthly_savings_usd > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-success" />
              Potential Savings
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Monthly</div>
                <div className="text-lg font-bold text-success">
                  ${recommendation.potential_monthly_savings_usd.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Annual</div>
                <div className="text-lg font-bold text-success">
                  ${recommendation.potential_annual_savings_usd.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Action */}
        {recommendation.suggested_action && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-primary" />
              Suggested Action
            </div>
            <p className="text-sm text-muted-foreground">
              {recommendation.suggested_action}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Implementation Effort:</span>
              <Badge variant={getEffortColor(recommendation.implementation_effort)} className="text-xs">
                {recommendation.implementation_effort.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>

      {(onDismiss || onImplement) && (
        <CardFooter className="flex gap-2">
          {onDismiss && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
          )}
          {onImplement && (
            <Button
              variant="default"
              size="sm"
              onClick={handleImplement}
              disabled={isUpdating}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Implemented
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
