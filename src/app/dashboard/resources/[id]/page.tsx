/**
 * Resource Detail Page
 *
 * Displays detailed information about a specific Azure resource including:
 * - Resource metadata and properties
 * - Cost trends and history
 * - Related resources
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ResourceDetailClient } from '@/components/resources/resource-detail-client'

export default async function ResourceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single() as { data: { org_id: string } | null; error: any }

  if (!userData?.org_id) {
    notFound()
  }

  // Fetch initial resource data
  const { data: resource, error: resourceError} = await supabase
    .from('azure_resources')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', userData.org_id)
    .single()

  if (resourceError || !resource) {
    notFound()
  }

  // Fetch tenant information
  const { data: tenant } = await supabase
    .from('azure_tenants')
    .select('id, name')
    .eq('id', resource.tenant_id)
    .single()

  // Fetch subscription information
  const { data: subscription } = await supabase
    .from('azure_subscriptions')
    .select('subscription_id, name, display_name')
    .eq('tenant_id', resource.tenant_id)
    .eq('subscription_id', resource.subscription_id)
    .single()

  return (
    <ResourceDetailClient
      resourceId={params.id}
      initialResource={resource}
      tenant={tenant}
      subscription={subscription}
    />
  )
}
