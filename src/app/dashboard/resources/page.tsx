/**
 * Resources Page
 *
 * Displays Azure resource inventory with filtering and search capabilities
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { createClient } from '@/lib/supabase/server'
import { ResourcesTable } from '@/components/resources/resources-table'
import { ResourcesSyncButton } from '@/components/resources/resources-sync-button'
import { Package, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ResourcesPage() {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  let stats = {
    totalResources: 0,
    resourceTypes: 0,
    locations: 0,
    lastSyncAt: null as string | null
  }

  let tenants: any[] = []

  if (user) {
    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null }

    if (userData?.org_id) {
      // Fetch tenants for dropdown filter
      const { data: tenantsData } = await supabase
        .from('azure_tenants')
        .select('id, name')
        .eq('org_id', userData.org_id)
        .eq('connection_status', 'connected')
        .order('name', { ascending: true })

      tenants = tenantsData || []

      // Get resource statistics
      const { data: resources, count } = await supabase
        .from('azure_resources')
        .select('resource_type, location, last_synced_at', { count: 'exact' })
        .eq('org_id', userData.org_id)

      stats.totalResources = count || 0

      if (resources && resources.length > 0) {
        // Count unique resource types
        const uniqueTypes = new Set(resources.map(r => r.resource_type))
        stats.resourceTypes = uniqueTypes.size

        // Count unique locations
        const uniqueLocations = new Set(
          resources.map(r => r.location).filter(Boolean)
        )
        stats.locations = uniqueLocations.size

        // Get latest sync time
        const sortedBySyncTime = resources
          .filter(r => r.last_synced_at)
          .sort((a, b) =>
            new Date(b.last_synced_at).getTime() - new Date(a.last_synced_at).getTime()
          )

        if (sortedBySyncTime.length > 0) {
          stats.lastSyncAt = sortedBySyncTime[0].last_synced_at
        }
      }
    }
  }

  const hasResources = stats.totalResources > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-display-sm font-bold text-foreground">Resource Inventory</h1>
          <p className="text-body text-muted-foreground">
            View and manage your Azure resources across all connected tenants
          </p>
        </div>
        <ResourcesSyncButton />
      </div>

      {/* Statistics Cards */}
      {hasResources && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Resources</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalResources.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card variant="premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Resource Types</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.resourceTypes}</div>
            </CardContent>
          </Card>

          <Card variant="premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Azure Regions</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.locations}</div>
              {stats.lastSyncAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last synced: {new Date(stats.lastSyncAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resources Table or Empty State */}
      {!hasResources ? (
        <Card variant="glassmorphism" className="border-dashed border-border dark:border-border/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none"></div>
          <CardHeader className="text-center py-12 relative">
            <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 flex items-center justify-center mb-4 shadow-lg ring-2 ring-primary/10 dark:ring-primary/20">
              <Package className="h-7 w-7 text-primary dark:text-primary" />
            </div>
            <CardTitle className="text-foreground text-display-xs">No resources discovered yet</CardTitle>
            <CardDescription className="mt-2 text-muted-foreground text-body">
              Sync your Azure tenants to discover and inventory resources
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-12 relative">
            <ResourcesSyncButton variant="default" size="lg" showIcon />
          </CardContent>
        </Card>
      ) : (
        <ResourcesTable tenants={tenants} />
      )}
    </div>
  )
}
