import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Cloud, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function TenantsPage() {
  const supabase = await createClient()

  // Fetch tenants from database
  const { data: { user } } = await supabase.auth.getUser()
  let tenants: any[] = []

  if (user) {
    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null }

    if (userData?.org_id) {
      // Fetch tenants for this organization
      const { data } = await supabase
        .from('azure_tenants')
        .select('id, name, azure_tenant_id, connection_status, last_sync_at, created_at')
        .eq('org_id', userData.org_id)
        .order('created_at', { ascending: false })

      tenants = data || []
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-display-sm font-bold text-foreground">Azure Tenants</h1>
          <p className="text-body text-muted-foreground">
            Manage your connected Azure client tenants
          </p>
        </div>
        <Link href="/dashboard/tenants/new">
          <Button className="shadow-md hover:shadow-lg transition-all">
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Button>
        </Link>
      </div>

      {tenants.length === 0 ? (
        <Card variant="glassmorphism" className="border-dashed border-border dark:border-border/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none"></div>
          <CardHeader className="text-center py-12 relative">
            <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 flex items-center justify-center mb-4 shadow-lg ring-2 ring-primary/10 dark:ring-primary/20">
              <Cloud className="h-7 w-7 text-primary dark:text-primary" />
            </div>
            <CardTitle className="text-foreground text-display-xs">No tenants connected yet</CardTitle>
            <CardDescription className="mt-2 text-muted-foreground text-body">
              Connect your first Azure tenant to start monitoring costs and resources
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-12 relative">
            <Link href="/dashboard/tenants/new">
              <Button className="shadow-lg hover:shadow-xl transition-all">
                <Plus className="mr-2 h-4 w-4" />
                Connect Your First Tenant
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              variant="premium"
              className="group hover:border-primary/50 dark:hover:border-primary/40 transition-all duration-300"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="rounded-md bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 p-1.5 transition-all duration-300 group-hover:from-primary/30 group-hover:to-accent/30 dark:group-hover:from-primary/40 dark:group-hover:to-accent/40 group-hover:scale-110">
                      <Cloud className="h-4 w-4 text-primary dark:text-primary" />
                    </div>
                    <CardTitle className="text-lg text-foreground">{tenant.name}</CardTitle>
                  </div>
                  <Badge variant={tenant.connection_status === 'connected' ? 'default' : 'destructive'}>
                    {tenant.connection_status}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Tenant ID: {tenant.azure_tenant_id?.substring(0, 8)}...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Cost:</span>
                    <span className="font-semibold text-foreground">${tenant.monthly_cost?.toLocaleString() || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Sync:</span>
                    <span className="text-foreground">{tenant.last_sync_at ? new Date(tenant.last_sync_at).toLocaleDateString() : 'Never'}</span>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Link href={`/dashboard/tenants/${tenant.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/dashboard/tenants/${tenant.id}/settings`}>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
