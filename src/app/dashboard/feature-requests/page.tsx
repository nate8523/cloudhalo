'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquarePlus, ThumbsUp, Clock, CheckCircle2, XCircle, Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { Database } from '@/types/database'

type FeatureRequest = Database['public']['Tables']['feature_requests']['Row'] & {
  user_has_voted: boolean
}

export default function FeatureRequestsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [features, setFeatures] = useState<FeatureRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [votingFeatureId, setVotingFeatureId] = useState<string | null>(null)

  // Fetch feature requests
  const fetchFeatures = async () => {
    setIsLoading(true)
    try {
      const url = new URL('/api/feature-requests', window.location.origin)
      if (selectedCategory) {
        url.searchParams.set('category', selectedCategory)
      }

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Failed to fetch feature requests')
      const json = await res.json()
      setFeatures(json.data as FeatureRequest[])
    } catch (error) {
      console.error('Error fetching features:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Vote handler
  const handleVote = async (featureId: string, hasVoted: boolean) => {
    setVotingFeatureId(featureId)
    try {
      const method = hasVoted ? 'DELETE' : 'POST'
      const res = await fetch(`/api/feature-requests/${featureId}/vote`, {
        method,
      })
      if (!res.ok) throw new Error('Failed to update vote')

      // Refresh features after voting
      await fetchFeatures()
    } catch (error) {
      console.error('Error voting:', error)
    } finally {
      setVotingFeatureId(null)
    }
  }

  // Fetch on mount and when category changes
  useEffect(() => {
    fetchFeatures()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info'; label: string; icon: React.ReactNode }> = {
      submitted: { variant: 'secondary', label: 'Submitted', icon: <MessageSquarePlus className="h-3 w-3 mr-1" /> },
      under_review: { variant: 'info', label: 'Under Review', icon: <Clock className="h-3 w-3 mr-1" /> },
      planned: { variant: 'warning', label: 'Planned', icon: <Clock className="h-3 w-3 mr-1" /> },
      in_progress: { variant: 'info', label: 'In Progress', icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> },
      completed: { variant: 'success', label: 'Completed', icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
      declined: { variant: 'destructive', label: 'Declined', icon: <XCircle className="h-3 w-3 mr-1" /> },
    }

    const config = statusConfig[status] || statusConfig.submitted
    return (
      <Badge variant={config.variant} className="flex items-center w-fit">
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const getCategoryBadge = (category: string) => {
    const categoryColors: Record<string, string> = {
      integration: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      analytics: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      alerts: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      ui: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      automation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    }

    return (
      <Badge variant="outline" className={categoryColors[category] || categoryColors.other}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    )
  }

  const groupedFeatures = features?.reduce((acc, feature) => {
    const status = feature.status
    if (!acc[status]) acc[status] = []
    acc[status].push(feature)
    return acc
  }, {} as Record<string, FeatureRequest[]>)

  const statusOrder = ['in_progress', 'planned', 'under_review', 'completed', 'declined']
  const activeStatuses = ['in_progress', 'planned', 'under_review']
  const completedStatuses = ['completed', 'declined']

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feature Roadmap</h1>
          <p className="text-muted-foreground mt-1">
            View upcoming features, vote for your favorites, and submit new ideas
          </p>
        </div>
        <Link href="/dashboard/feature-requests/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Submit Request
          </Button>
        </Link>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All Categories
        </Button>
        {['integration', 'analytics', 'alerts', 'ui', 'automation', 'other'].map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roadmap" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="completed">Completed & Declined</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {statusOrder
                .filter((status) => activeStatuses.includes(status))
                .map((status) => {
                  const featuresInStatus = groupedFeatures?.[status] || []

                  return (
                    <div key={status} className="space-y-4">
                      <div className="sticky top-0 bg-background pb-4 z-10">
                        <h2 className="text-xl font-bold capitalize flex items-center gap-2 border-b pb-2">
                          {status.replace('_', ' ')}
                          <Badge variant="secondary">{featuresInStatus.length}</Badge>
                        </h2>
                      </div>
                      <div className="space-y-4">
                        {featuresInStatus.length === 0 ? (
                          <Card className="bg-muted/50">
                            <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                              No features in this stage
                            </CardContent>
                          </Card>
                        ) : (
                          featuresInStatus.map((feature) => (
                            <Card key={feature.id} className="hover:shadow-md transition-shadow">
                              <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 space-y-2">
                                    <CardTitle className="text-base line-clamp-2">{feature.title}</CardTitle>
                                    <div className="flex gap-2 flex-wrap">
                                      {getCategoryBadge(feature.category)}
                                    </div>
                                  </div>
                                  <Button
                                    variant={feature.user_has_voted ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleVote(feature.id, feature.user_has_voted)}
                                    disabled={votingFeatureId === feature.id}
                                    className="shrink-0"
                                  >
                                    <ThumbsUp className={`h-4 w-4 ${feature.user_has_voted ? 'fill-current' : ''}`} />
                                    <span className="ml-1 text-xs">{feature.vote_count}</span>
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <CardDescription className="line-clamp-3 text-sm">
                                  {feature.description}
                                </CardDescription>
                                {feature.estimated_delivery && (
                                  <div className="mt-3 flex items-center text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {feature.estimated_delivery}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            statusOrder
              .filter((status) => completedStatuses.includes(status))
              .map((status) => {
                const featuresInStatus = groupedFeatures?.[status] || []
                if (featuresInStatus.length === 0) return null

                return (
                  <div key={status} className="space-y-4">
                    <h2 className="text-xl font-semibold capitalize flex items-center gap-2">
                      {status.replace('_', ' ')}
                      <Badge variant="secondary">{featuresInStatus.length}</Badge>
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {featuresInStatus.map((feature) => (
                        <Card key={feature.id} className="hover:shadow-md transition-shadow opacity-80">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-2">
                                <CardTitle className="text-lg line-clamp-2">{feature.title}</CardTitle>
                                <div className="flex gap-2 flex-wrap">
                                  {getStatusBadge(feature.status)}
                                  {getCategoryBadge(feature.category)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                                <ThumbsUp className="h-4 w-4" />
                                <span>{feature.vote_count}</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <CardDescription className="line-clamp-3">{feature.description}</CardDescription>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
