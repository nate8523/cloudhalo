'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Calendar, Filter, X, Cloud, Tag } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface Tenant {
  id: string
  name: string
}

interface CostFiltersProps {
  tenants: Tenant[]
  serviceCategories: string[]
  currentFilters: {
    startDate: string
    endDate: string
    tenantId?: string
    serviceCategory?: string
  }
}

export function CostFilters({ tenants, serviceCategories, currentFilters }: CostFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [startDate, setStartDate] = useState(currentFilters.startDate)
  const [endDate, setEndDate] = useState(currentFilters.endDate)
  const [selectedTenantId, setSelectedTenantId] = useState(currentFilters.tenantId || '')
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(
    currentFilters.serviceCategory || ''
  )

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId)

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    // Always set dates
    params.set('startDate', startDate)
    params.set('endDate', endDate)

    // Set or remove tenant filter
    if (selectedTenantId) {
      params.set('tenantId', selectedTenantId)
    } else {
      params.delete('tenantId')
    }

    // Set or remove service category filter
    if (selectedServiceCategory) {
      params.set('serviceCategory', selectedServiceCategory)
    } else {
      params.delete('serviceCategory')
    }

    router.push(`/dashboard/costs?${params.toString()}`)
  }

  const resetFilters = () => {
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0]

    setStartDate(thirtyDaysAgo)
    setEndDate(today)
    setSelectedTenantId('')
    setSelectedServiceCategory('')

    router.push('/dashboard/costs')
  }

  const setQuickDateRange = (days: number) => {
    const today = new Date().toISOString().split('T')[0]
    const startDate = subDays(new Date(), days).toISOString().split('T')[0]

    setStartDate(startDate)
    setEndDate(today)
  }

  const hasActiveFilters = selectedTenantId || selectedServiceCategory

  return (
    <Card variant="premium" className="border-primary/20">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Date Range Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Date Range
              </Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuickDateRange(7)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-xs font-semibold transition-all duration-150 h-7 px-3 border border-border bg-background shadow-[var(--shadow-4dp)] hover:bg-muted hover:border-primary/30 hover:shadow-[var(--shadow-8dp)]"
                >
                  Last 7 days
                </button>
                <button
                  onClick={() => setQuickDateRange(30)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-xs font-semibold transition-all duration-150 h-7 px-3 border border-border bg-background shadow-[var(--shadow-4dp)] hover:bg-muted hover:border-primary/30 hover:shadow-[var(--shadow-8dp)]"
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => setQuickDateRange(90)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-xs font-semibold transition-all duration-150 h-7 px-3 border border-border bg-background shadow-[var(--shadow-4dp)] hover:bg-muted hover:border-primary/30 hover:shadow-[var(--shadow-8dp)]"
                >
                  Last 90 days
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                  Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                  End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Filters
            </Label>
            <div className="flex flex-wrap gap-3">
              {/* Tenant Filter */}
              {tenants.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Cloud className="h-4 w-4 mr-2" />
                      {selectedTenant ? selectedTenant.name : 'All Tenants'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Select Tenant</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedTenantId('')}>
                      All Tenants
                    </DropdownMenuItem>
                    {tenants.map((tenant) => (
                      <DropdownMenuItem
                        key={tenant.id}
                        onClick={() => setSelectedTenantId(tenant.id)}
                      >
                        {tenant.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Service Category Filter */}
              {serviceCategories.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Tag className="h-4 w-4 mr-2" />
                      {selectedServiceCategory || 'All Services'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel>Select Service</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedServiceCategory('')}>
                      All Services
                    </DropdownMenuItem>
                    {serviceCategories.map((category) => (
                      <DropdownMenuItem
                        key={category}
                        onClick={() => setSelectedServiceCategory(category)}
                      >
                        {category}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={applyFilters}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-semibold transition-all duration-150 h-8 px-3 bg-primary text-primary-foreground shadow-[var(--shadow-4dp)] hover:bg-[hsl(var(--primary-hover))] hover:shadow-[var(--shadow-8dp)]"
              >
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </button>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-semibold transition-all duration-150 h-8 px-3 hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                  {[selectedTenantId && 'Tenant', selectedServiceCategory && 'Service']
                    .filter(Boolean)
                    .join(', ')}{' '}
                  filter active
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
