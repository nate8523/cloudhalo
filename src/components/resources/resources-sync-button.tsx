'use client'

/**
 * Resources Sync Button Component
 *
 * Triggers resource discovery sync for all connected Azure tenants
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ResourcesSyncButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showIcon?: boolean
}

export function ResourcesSyncButton({
  variant = 'outline',
  size = 'default',
  showIcon = true
}: ResourcesSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsSyncing(true)

    try {
      const response = await fetch('/api/resources/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync resources')
      }

      // Refresh the page to show updated resources
      router.refresh()
    } catch (error: any) {
      console.error('Resource sync error:', error)
      alert(`Failed to sync resources: ${error.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isSyncing}
      className="shadow-md hover:shadow-lg transition-all"
    >
      <RefreshCw className={`${showIcon ? 'mr-2' : ''} h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {showIcon && (isSyncing ? 'Syncing Resources...' : 'Sync Resources')}
    </Button>
  )
}
