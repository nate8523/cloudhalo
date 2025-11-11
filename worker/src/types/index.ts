export interface AzureTenant {
  id: string
  org_id: string
  name: string
  azure_tenant_id: string
  azure_app_id: string
  azure_client_secret: string // Encrypted
  connection_status: 'connected' | 'disconnected' | 'failed' | 'expired'
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface AzureSubscription {
  id: string
  tenant_id: string
  subscription_id: string
  name: string | null
  status: string | null
  created_at: string
}

export interface CostSnapshot {
  id?: string
  org_id: string
  tenant_id: string
  subscription_id: string
  resource_id: string | null
  resource_name: string | null
  resource_type: string | null
  resource_group: string | null
  service_category: string | null
  location: string | null
  cost_usd: number
  date: string // YYYY-MM-DD format
  created_at?: string
}

export interface CostQueryResult {
  subscriptionId: string
  resourceId: string | null
  resourceName: string | null
  resourceType: string | null
  resourceGroup: string | null
  serviceCategory: string | null
  location: string | null
  cost: number
  date: string
  currency: string
}
