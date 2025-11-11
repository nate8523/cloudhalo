'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RecommendationsList } from '@/components/recommendations/recommendations-list'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Filter, Download, Info } from 'lucide-react'
import { Database } from '@/types/database'

type Recommendation = Database['public']['Tables']['optimization_recommendations']['Row']

interface RecommendationsPageClientProps {
  tenants: Array<{ id: string; name: string }>
}

export function RecommendationsPageClient({ tenants }: RecommendationsPageClientProps) {
  const router = useRouter()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedTenant, setSelectedTenant] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  const fetchRecommendations = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (selectedTenant !== 'all') params.append('tenant_id', selectedTenant)
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity)
      if (selectedType !== 'all') params.append('type', selectedType)
      params.append('status', 'active')

      const response = await fetch(`/api/recommendations?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations')
      }

      const data = await response.json()
      setRecommendations(data.recommendations || [])
    } catch (err) {
      console.error('Error fetching recommendations:', err)
      setError('Failed to load recommendations. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
  }, [selectedTenant, selectedSeverity, selectedType])

  const handleSyncRecommendations = async () => {
    if (!selectedTenant || selectedTenant === 'all') {
      alert('Please select a specific tenant to sync recommendations')
      return
    }

    setIsSyncing(true)
    try {
      const response = await fetch(`/api/tenants/${selectedTenant}/sync-recommendations`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sync recommendations')
      }

      const data = await response.json()

      // Refresh the page to show updated data
      router.refresh()
      await fetchRecommendations()

      alert(`Successfully generated ${data.recommendations_created} recommendations`)
    } catch (err) {
      console.error('Error syncing recommendations:', err)
      alert('Failed to sync recommendations. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      const response = await fetch(`/api/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss recommendation')
      }

      // Remove from local state
      setRecommendations(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Error dismissing recommendation:', err)
      throw err
    }
  }

  const handleImplement = async (id: string) => {
    try {
      const response = await fetch(`/api/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'implemented' }),
      })

      if (!response.ok) {
        throw new Error('Failed to mark as implemented')
      }

      // Remove from local state
      setRecommendations(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Error marking as implemented:', err)
      throw err
    }
  }

  const hasNoTenants = tenants.length === 0
  const hasNoRecommendations = !isLoading && recommendations.length === 0

  return (
    <div className="space-y-6">
      {/* Info Alert for first-time users */}
      {hasNoRecommendations && !isLoading && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {hasNoTenants ? (
              <>
                No Azure tenants connected yet. <a href="/dashboard/tenants/new" className="underline font-medium">Connect a tenant</a> to start receiving optimization recommendations.
              </>
            ) : (
              <>
                No recommendations found. Click "Sync Recommendations" to analyze your Azure resources and generate cost optimization insights.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-5 w-5 text-muted-foreground" />

          {/* Tenant Filter */}
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={hasNoTenants}
          >
            <option value="all">All Tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Types</option>
            <option value="idle_vm">Idle VMs</option>
            <option value="unused_disk">Unused Resources</option>
            <option value="oversized_resource">Oversized</option>
            <option value="reserved_instance">Reserved Instances</option>
            <option value="untagged_resource">Missing Tags</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncRecommendations}
            disabled={isSyncing || hasNoTenants}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Recommendations'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Recommendations List */}
      <RecommendationsList
        recommendations={recommendations}
        isLoading={isLoading}
        onDismiss={handleDismiss}
        onImplement={handleImplement}
        onUpdate={fetchRecommendations}
      />
    </div>
  )
}
