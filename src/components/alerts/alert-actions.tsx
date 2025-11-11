'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface AlertActionsProps {
  alertId: string
  status: string
}

export function AlertActions({ alertId, status }: AlertActionsProps) {
  const router = useRouter()
  const [isAcknowledging, setIsAcknowledging] = useState(false)
  const [isResolving, setIsResolving] = useState(false)

  const handleAcknowledge = async () => {
    setIsAcknowledging(true)
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to acknowledge alert')
      }

      router.refresh()
    } catch (error: any) {
      console.error('Error acknowledging alert:', error)
      alert(error.message || 'Failed to acknowledge alert')
    } finally {
      setIsAcknowledging(false)
    }
  }

  const handleResolve = async () => {
    setIsResolving(true)
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resolve alert')
      }

      router.refresh()
    } catch (error: any) {
      console.error('Error resolving alert:', error)
      alert(error.message || 'Failed to resolve alert')
    } finally {
      setIsResolving(false)
    }
  }

  if (status !== 'active') {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleAcknowledge}
        disabled={isAcknowledging || isResolving}
      >
        {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
      </Button>
      <Button
        size="sm"
        variant="default"
        onClick={handleResolve}
        disabled={isAcknowledging || isResolving}
      >
        {isResolving ? 'Resolving...' : 'Resolve'}
      </Button>
    </div>
  )
}
