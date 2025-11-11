'use client'

/**
 * Resources Table Component
 *
 * Interactive table with filtering, search, and pagination for Azure resources
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, ChevronLeft, ChevronRight, Package, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Tenant {
  id: string
  name: string
}

interface AzureResource {
  id: string
  resource_id: string
  resource_name: string
  resource_type: string
  resource_group: string
  location: string | null
  sku: string | null
  tags: Record<string, string>
  provisioning_state: string | null
  power_state: string | null
  last_synced_at: string
}

interface ResourcesTableProps {
  tenants: Tenant[]
}

export function ResourcesTable({ tenants }: ResourcesTableProps) {
  const router = useRouter()
  const [resources, setResources] = useState<AzureResource[]>([])
  const [filteredResources, setFilteredResources] = useState<AzureResource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTenant, setSelectedTenant] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 50

  // Fetch resources
  useEffect(() => {
    fetchResources()
  }, [selectedTenant, selectedType, selectedLocation, currentPage])

  const fetchResources = async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString()
      })

      if (selectedTenant !== 'all') {
        params.append('tenantId', selectedTenant)
      }

      if (selectedType !== 'all') {
        params.append('resourceType', selectedType)
      }

      if (selectedLocation !== 'all') {
        params.append('location', selectedLocation)
      }

      if (search) {
        params.append('search', search)
      }

      console.log('[ResourcesTable] Fetching resources with params:', params.toString())
      const response = await fetch(`/api/resources?${params.toString()}`, {
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      console.log('[ResourcesTable] API response:', data)

      if (data.success) {
        setResources(data.data)
        setFilteredResources(data.data)
        setTotalCount(data.pagination.total)
        console.log('[ResourcesTable] Loaded', data.data.length, 'resources, total:', data.pagination.total)
      } else {
        console.error('[ResourcesTable] API returned error:', data.error)
      }
    } catch (error) {
      console.error('[ResourcesTable] Error fetching resources:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1)
    fetchResources()
  }

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()

      if (selectedTenant !== 'all') {
        params.append('tenantId', selectedTenant)
      }
      if (selectedType !== 'all') {
        params.append('resourceType', selectedType)
      }
      if (selectedLocation !== 'all') {
        params.append('location', selectedLocation)
      }
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/resources/export?${params.toString()}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `azure-resources-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting resources:', error)
    }
  }

  // Get unique resource types
  const resourceTypes = Array.from(new Set(resources.map(r => r.resource_type))).sort()

  // Get unique locations
  const locations = Array.from(
    new Set(resources.map(r => r.location).filter(Boolean) as string[])
  ).sort()

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  return (
    <div className="space-y-4">
      {/* Filters and Export */}
      <div className="flex items-center justify-between gap-4">
        <Card variant="premium" className="p-4 flex-1">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="md:col-span-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Search resources..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tenant Filter */}
            <div>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="All Tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={loading || totalCount === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredResources.length} of {totalCount.toLocaleString()} resources
      </div>

      {/* Resources Table */}
      <Card variant="premium">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Resource Group</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Location</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-muted-foreground">
                    Loading resources...
                  </td>
                </tr>
              ) : filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-muted-foreground">
                    No resources found
                  </td>
                </tr>
              ) : (
                filteredResources.map((resource) => (
                  <tr
                    key={resource.id}
                    onClick={() => router.push(`/dashboard/resources/${resource.id}`)}
                    className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {resource.resource_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {resource.resource_id.split('/').slice(-2).join('/')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-foreground">
                        {resource.resource_type.split('/').pop()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-foreground">{resource.resource_group}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-foreground">{resource.location || 'N/A'}</span>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          resource.provisioning_state === 'Succeeded'
                            ? 'default'
                            : resource.provisioning_state === 'Failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {resource.provisioning_state || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">{resource.sku || 'N/A'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
