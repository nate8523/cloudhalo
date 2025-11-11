/**
 * Resource Detail Client Component
 *
 * Client-side component for displaying resource details with interactive features
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  DollarSign,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface ResourceDetailClientProps {
  resourceId: string
  initialResource: any
  tenant: any
  subscription: any
}

export function ResourceDetailClient({
  resourceId,
  initialResource,
  tenant,
  subscription
}: ResourceDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  useEffect(() => {
    fetchResourceDetails()
  }, [resourceId])

  async function fetchResourceDetails() {
    setLoading(true)
    try {
      const response = await fetch(`/api/resources/${resourceId}`)
      if (response.ok) {
        const result = await response.json()
        setDetailData(result.data)
      }
    } catch (error) {
      console.error('Error fetching resource details:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleExportCSV() {
    try {
      const response = await fetch(`/api/resources/export?resourceId=${resourceId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `resource-${initialResource.resource_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
    }
  }

  const costHistory = detailData?.costHistory || []
  const relatedResources = detailData?.relatedResources || []
  const costSummary = detailData?.costSummary || {
    total: 0,
    avgDaily: 0,
    lastDay: 0,
    currency: 'USD'
  }

  // Format cost history for chart
  const chartData = costHistory.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: parseFloat(item.cost_usd || 0)
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/resources')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-display-sm font-bold text-foreground">
              {initialResource.resource_name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{initialResource.resource_type}</span>
              {initialResource.location && (
                <>
                  <span>•</span>
                  <MapPin className="h-3 w-3" />
                  <span>{initialResource.location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchResourceDetails}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Resource Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={initialResource.provisioning_state === 'Succeeded' ? 'default' : 'outline'}>
              {initialResource.provisioning_state || 'Unknown'}
            </Badge>
          </CardContent>
        </Card>

        <Card variant="premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost (90d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                ${costSummary.total.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                ${costSummary.avgDaily.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Synced</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground">
              {initialResource.last_synced_at
                ? new Date(initialResource.last_synced_at).toLocaleString()
                : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cost Trend Chart */}
          <Card variant="glassmorphism">
            <CardHeader>
              <CardTitle>Cost Trend (Last 90 Days)</CardTitle>
              <CardDescription>Daily cost in USD</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No cost data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resource Properties */}
          <Card variant="glassmorphism">
            <CardHeader>
              <CardTitle>Resource Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PropertyRow label="Resource ID" value={initialResource.resource_id} />
              <Separator />
              <PropertyRow label="Resource Group" value={initialResource.resource_group} />
              <Separator />
              <PropertyRow label="Subscription" value={subscription?.display_name || subscription?.name || initialResource.subscription_id} />
              <Separator />
              <PropertyRow label="Tenant" value={tenant?.name || initialResource.tenant_id} />
              <Separator />
              {initialResource.sku && (
                <>
                  <PropertyRow label="SKU" value={initialResource.sku} />
                  <Separator />
                </>
              )}
              {initialResource.kind && (
                <>
                  <PropertyRow label="Kind" value={initialResource.kind} />
                  <Separator />
                </>
              )}
              <PropertyRow label="Created At" value={initialResource.created_at ? new Date(initialResource.created_at).toLocaleString() : 'N/A'} />
            </CardContent>
          </Card>

          {/* Tags */}
          {initialResource.tags && Object.keys(initialResource.tags).length > 0 && (
            <Card variant="glassmorphism">
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(initialResource.tags).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Related Resources */}
        <div className="space-y-6">
          <Card variant="glassmorphism">
            <CardHeader>
              <CardTitle>Related Resources</CardTitle>
              <CardDescription>
                Other resources in {initialResource.resource_group}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : relatedResources.length > 0 ? (
                <div className="space-y-3">
                  {relatedResources.map((related: any) => (
                    <Link
                      key={related.id}
                      href={`/dashboard/resources/${related.id}`}
                      className="block p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground truncate">
                            {related.resource_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {related.resource_type}
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      {related.sku && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {related.sku}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No related resources found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right break-all">{value}</span>
    </div>
  )
}
