'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface TenantSyncButtonProps {
  tenantId: string
}

export function TenantSyncButton({ tenantId }: TenantSyncButtonProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/tenants/${tenantId}/sync`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to sync tenant')
      }

      setSuccess(true)

      // Refresh the page data to show updated sync time and subscriptions
      router.refresh()

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)

    } catch (err: any) {
      console.error('Sync error:', err)
      setError(err.message || 'Failed to sync tenant')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleSync}
        disabled={syncing}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Now'}
      </Button>

      {success && (
        <div className="text-xs text-green-600 dark:text-green-500">
          Sync completed successfully!
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
