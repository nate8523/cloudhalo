import { createClient } from '@/lib/supabase/server'
import { CostsPageClient } from './costs-page-client'

interface CostsPageProps {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
    tenantId?: string
    serviceCategory?: string
  }>
}

export default async function CostsPage({ searchParams }: CostsPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single() as { data: { org_id: string } | null }

  if (!userData?.org_id) {
    return <div>Organization not found</div>
  }

  // Set default date range (last 30 days)
  const endDate = params.endDate || new Date().toISOString().split('T')[0]
  const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Build query for cost data
  let query = supabase
    .from('cost_snapshots')
    .select('*')
    .eq('org_id', userData.org_id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  // Apply filters
  if (params.tenantId) {
    query = query.eq('tenant_id', params.tenantId)
  }
  if (params.serviceCategory) {
    query = query.eq('service_category', params.serviceCategory)
  }

  const { data: costData } = await query

  // Fetch tenants for filter dropdown
  const { data: tenants } = await supabase
    .from('azure_tenants')
    .select('id, name')
    .eq('org_id', userData.org_id)
    .order('name')

  // Calculate summary statistics
  const totalCost = costData?.reduce((sum, record) => sum + Number(record.cost_usd || 0), 0) || 0
  const avgDailyCost = costData && costData.length > 0
    ? totalCost / new Set(costData.map(r => r.date)).size
    : 0

  // Get previous period for comparison
  const dateRangeMs = new Date(endDate).getTime() - new Date(startDate).getTime()
  const prevStartDate = new Date(new Date(startDate).getTime() - dateRangeMs).toISOString().split('T')[0]
  const prevEndDate = new Date(new Date(endDate).getTime() - dateRangeMs).toISOString().split('T')[0]

  const { data: prevCostData } = await supabase
    .from('cost_snapshots')
    .select('cost_usd')
    .eq('org_id', userData.org_id)
    .gte('date', prevStartDate)
    .lte('date', prevEndDate)

  const prevTotalCost = prevCostData?.reduce((sum, record) => sum + Number(record.cost_usd || 0), 0) || 0
  const costChange = prevTotalCost > 0
    ? ((totalCost - prevTotalCost) / prevTotalCost) * 100
    : 0

  // Get unique service categories for filtering
  const serviceCategories = Array.from(
    new Set(costData?.map(r => r.service_category).filter(Boolean) || [])
  ).sort()

  return (
    <CostsPageClient
      costData={costData || []}
      tenants={tenants || []}
      serviceCategories={serviceCategories}
      currentFilters={{
        startDate,
        endDate,
        tenantId: params.tenantId,
        serviceCategory: params.serviceCategory
      }}
      totalCost={totalCost}
      avgDailyCost={avgDailyCost}
      costChange={costChange}
    />
  )
}
