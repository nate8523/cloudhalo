'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface RecommendationsSyncButtonProps {
  tenantId: string
  tenantName?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  showLabel?: boolean
  onSyncComplete?: (result: any) => void
}

export function RecommendationsSyncButton({
  tenantId,
  tenantName,
  variant = 'default',
  size = 'default',
  showLabel = true,
  onSyncComplete,
}: RecommendationsSyncButtonProps) {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenants/${tenantId}/sync-recommendations`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync recommendations')
      }

      const result = await response.json()

      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete(result)
      }

      // Refresh the page data
      router.refresh()

      // Show success message
      if (result.recommendations_created > 0) {
        console.log(`Generated ${result.recommendations_created} recommendations for ${tenantName || 'tenant'}`)
      } else {
        console.log('No new recommendations found')
      }

    } catch (err: any) {
      console.error('Sync error:', err)
      setError(err.message || 'Failed to sync recommendations')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={handleSync}
        disabled={isSyncing}
        title={isSyncing ? 'Syncing...' : 'Generate optimization recommendations'}
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''} ${showLabel ? 'mr-2' : ''}`} />
        {showLabel && (isSyncing ? 'Syncing...' : 'Sync Recommendations')}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
