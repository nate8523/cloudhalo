import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Cloud, Calendar, AlertCircle, CheckCircle2, Server } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TenantSyncButton } from '@/components/tenant-sync-button'

interface TenantDetailsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TenantDetailsPage({ params }: TenantDetailsPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch tenant details
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!userData?.org_id) {
    notFound()
  }

  // Fetch tenant with RLS protection
  const { data: tenant, error } = await supabase
    .from('azure_tenants')
    .select('*')
    .eq('id', id)
    .eq('org_id', userData.org_id)
    .single()

  if (error || !tenant) {
    notFound()
  }

  // Fetch subscriptions for this tenant
  const { data: subscriptions } = await supabase
    .from('azure_subscriptions')
    .select('*')
    .eq('tenant_id', id)
    .order('created_at', { ascending: false })

  const subscriptionCount = subscriptions?.length || 0
  const enabledCount = subscriptions?.filter(s => s.state === 'Enabled').length || 0

  // Calculate credential expiry status
  const getExpiryStatus = () => {
    if (!tenant.credentials_expire_at) return null

    const expiryDate = new Date(tenant.credentials_expire_at)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) {
      return { status: 'expired', days: Math.abs(daysUntilExpiry), variant: 'destructive' as const }
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring-soon', days: daysUntilExpiry, variant: 'destructive' as const }
    } else if (daysUntilExpiry <= 60) {
      return { status: 'expiring', days: daysUntilExpiry, variant: 'secondary' as const }
    }
    return { status: 'valid', days: daysUntilExpiry, variant: 'default' as const }
  }

  const expiryStatus = getExpiryStatus()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tenants
            </Button>
          </Link>
        </div>
        <TenantSyncButton tenantId={id} />
      </div>

      {/* Tenant Info Card */}
      <Card variant="premium" className="border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 p-3">
                <Cloud className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-display-xs">{tenant.name}</CardTitle>
                <CardDescription className="mt-1">
                  Azure Tenant ID: {tenant.azure_tenant_id}
                </CardDescription>
              </div>
            </div>
            <Badge variant={tenant.connection_status === 'connected' ? 'default' : 'destructive'}>
              {tenant.connection_status === 'connected' ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {tenant.connection_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Application ID</p>
              <p className="font-mono text-sm">{tenant.azure_app_id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created</p>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <p className="text-sm">{new Date(tenant.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Sync</p>
              <p className="text-sm">
                {tenant.last_sync_at
                  ? new Date(tenant.last_sync_at).toLocaleString()
                  : 'Never synced'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-sm">{new Date(tenant.updated_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Connection Error */}
          {tenant.connection_error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Connection Error</p>
                  <p className="text-sm text-muted-foreground mt-1">{tenant.connection_error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Credential Expiry Warning */}
          {expiryStatus && (
            <div className={`mt-4 p-3 rounded-lg border ${
              expiryStatus.status === 'expired' || expiryStatus.status === 'expiring-soon'
                ? 'bg-destructive/10 border-destructive/20'
                : 'bg-yellow-500/10 border-yellow-500/20'
            }`}>
              <div className="flex items-start space-x-2">
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  expiryStatus.status === 'expired' || expiryStatus.status === 'expiring-soon'
                    ? 'text-destructive'
                    : 'text-yellow-600 dark:text-yellow-500'
                }`} />
                <div>
                  <p className={`text-sm font-semibold ${
                    expiryStatus.status === 'expired' || expiryStatus.status === 'expiring-soon'
                      ? 'text-destructive'
                      : 'text-yellow-600 dark:text-yellow-500'
                  }`}>
                    {expiryStatus.status === 'expired'
                      ? 'Credentials Expired'
                      : 'Credentials Expiring Soon'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {expiryStatus.status === 'expired'
                      ? `Credentials expired ${expiryStatus.days} days ago on ${new Date(tenant.credentials_expire_at).toLocaleDateString()}`
                      : `Credentials will expire in ${expiryStatus.days} days on ${new Date(tenant.credentials_expire_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions Card */}
      <Card variant="premium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>Azure Subscriptions</CardTitle>
            </div>
            <Badge variant="secondary">
              {subscriptionCount} {subscriptionCount === 1 ? 'subscription' : 'subscriptions'}
            </Badge>
          </div>
          <CardDescription>
            Subscriptions discovered in this Azure tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptionCount === 0 ? (
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No subscriptions discovered yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Subscriptions will appear after the first successful sync
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {subscriptions?.map((subscription) => (
                <div
                  key={subscription.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold">
                          {subscription.display_name || subscription.name || 'Unnamed Subscription'}
                        </p>
                        <Badge variant={subscription.state === 'Enabled' ? 'default' : 'secondary'}>
                          {subscription.state}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {subscription.subscription_id}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                        <span>
                          Discovered: {new Date(subscription.discovered_at).toLocaleDateString()}
                        </span>
                        {subscription.last_synced_at && (
                          <span>
                            Last synced: {new Date(subscription.last_synced_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptionCount}</div>
            <p className="text-xs text-muted-foreground">
              {enabledCount} enabled
            </p>
          </CardContent>
        </Card>

        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            {tenant.connection_status === 'connected' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{tenant.connection_status}</div>
            <p className="text-xs text-muted-foreground">
              {tenant.last_sync_at
                ? `Synced ${new Date(tenant.last_sync_at).toLocaleDateString()}`
                : 'Never synced'}
            </p>
          </CardContent>
        </Card>

        <Card variant="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credential Status</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expiryStatus ? (
                expiryStatus.status === 'expired' ? (
                  <span className="text-destructive">Expired</span>
                ) : (
                  `${expiryStatus.days}d`
                )
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {expiryStatus
                ? expiryStatus.status === 'expired'
                  ? 'Credentials need renewal'
                  : 'Until expiry'
                : 'No expiry date set'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
