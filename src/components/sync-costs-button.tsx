'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react'

export function SyncCostsButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)

    try {
      const response = await fetch('/api/sync-costs', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          type: 'success',
          message: `Synced ${data.totalCostsIngested || 0} records in ${Math.round(data.duration / 1000)}s`
        })

        // Refresh the page after 2 seconds to show updated data
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        throw new Error(data.error || 'Sync failed')
      }
    } catch (error: any) {
      setResult({
        type: 'error',
        message: error.message || 'Failed to sync costs'
      })
    } finally {
      setSyncing(false)

      // Clear result after 5 seconds
      setTimeout(() => setResult(null), 5000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Costs'}
      </Button>

      {result && (
        <div className={`flex items-center gap-2 text-sm ${
          result.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {result.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  )
}
