'use client'

import { useState } from 'react'
import { RecommendationCard } from './recommendation-card'
import { Database } from '@/types/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Info } from 'lucide-react'

type Recommendation = Database['public']['Tables']['optimization_recommendations']['Row']

interface RecommendationsListProps {
  recommendations: Recommendation[]
  isLoading?: boolean
  onDismiss?: (id: string) => Promise<void>
  onImplement?: (id: string) => Promise<void>
  onUpdate?: () => void
}

export function RecommendationsList({
  recommendations,
  isLoading = false,
  onDismiss,
  onImplement,
  onUpdate
}: RecommendationsListProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  const handleDismiss = async (id: string) => {
    if (!onDismiss) return

    setUpdatingIds(prev => new Set(prev).add(id))
    try {
      await onDismiss(id)
      onUpdate?.()
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error)
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleImplement = async (id: string) => {
    if (!onImplement) return

    setUpdatingIds(prev => new Set(prev).add(id))
    try {
      await onImplement(id)
      onUpdate?.()
    } catch (error) {
      console.error('Failed to mark as implemented:', error)
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No optimization recommendations found. Your Azure resources are well optimized, or you may need to run a recommendation sync first.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {recommendations.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          onDismiss={onDismiss ? handleDismiss : undefined}
          onImplement={onImplement ? handleImplement : undefined}
        />
      ))}
    </div>
  )
}
