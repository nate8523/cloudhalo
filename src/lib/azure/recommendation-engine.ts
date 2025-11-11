/**
 * Azure Resource Optimization Recommendation Engine
 * Analyzes Azure resources to identify cost optimization opportunities
 */

import { ClientSecretCredential } from '@azure/identity'
import { Database } from '@/types/database'

// Recommendation types
export type RecommendationType =
  | 'idle_vm'
  | 'oversized_resource'
  | 'unused_disk'
  | 'reserved_instance'
  | 'untagged_resource'

export type RecommendationSeverity = 'low' | 'medium' | 'high'

export type ImplementationEffort = 'low' | 'medium' | 'high'

export interface ResourceRecommendation {
  recommendation_type: RecommendationType
  severity: RecommendationSeverity
  title: string
  description: string
  resource_id: string
  resource_name: string
  resource_type: string
  resource_group: string
  location: string | null
  current_monthly_cost_usd: number
  potential_monthly_savings_usd: number
  potential_annual_savings_usd: number
  metrics: Record<string, any>
  suggested_action: string
  implementation_effort: ImplementationEffort
}

type AzureResource = Database['public']['Tables']['azure_resources']['Row']
type CostSnapshot = Database['public']['Tables']['cost_snapshots']['Row']

/**
 * Detects idle virtual machines
 * Criteria: VM is deallocated/stopped for extended period
 */
export function detectIdleVMs(
  resources: AzureResource[],
  costData: CostSnapshot[]
): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = []

  const vms = resources.filter(
    (r) =>
      r.resource_type === 'Microsoft.Compute/virtualMachines' ||
      r.resource_type === 'microsoft.compute/virtualmachines'
  )

  for (const vm of vms) {
    // Check if VM is deallocated or stopped
    const powerState = vm.power_state?.toLowerCase() || ''
    const provisioningState = vm.provisioning_state?.toLowerCase() || ''

    const isIdle =
      powerState.includes('deallocated') ||
      powerState.includes('stopped') ||
      provisioningState === 'deallocated'

    if (isIdle) {
      // Calculate cost for this resource
      const resourceCosts = costData.filter(
        (c) => c.resource_id === vm.resource_id
      )

      const last30DaysCost = calculateLast30DaysCost(resourceCosts)
      const monthlyEstimate = last30DaysCost > 0 ? last30DaysCost : 50 // Default estimate

      // Idle VMs still incur storage costs, so savings is ~90% of compute
      const potentialSavings = monthlyEstimate * 0.9

      recommendations.push({
        recommendation_type: 'idle_vm',
        severity: determineSeverity(potentialSavings),
        title: `Idle Virtual Machine: ${vm.resource_name}`,
        description: `This virtual machine has been deallocated or stopped. It continues to incur storage costs of approximately $${(
          monthlyEstimate * 0.1
        ).toFixed(
          2
        )}/month. Consider deleting it if no longer needed, or keep it stopped if required for future use.`,
        resource_id: vm.resource_id,
        resource_name: vm.resource_name,
        resource_type: vm.resource_type,
        resource_group: vm.resource_group,
        location: vm.location,
        current_monthly_cost_usd: monthlyEstimate,
        potential_monthly_savings_usd: potentialSavings,
        potential_annual_savings_usd: potentialSavings * 12,
        metrics: {
          power_state: vm.power_state,
          provisioning_state: vm.provisioning_state,
          sku: vm.sku,
          last_synced_at: vm.last_synced_at,
        },
        suggested_action:
          'Delete the VM if no longer needed, or ensure it is properly deallocated to minimize costs.',
        implementation_effort: 'low',
      })
    }
  }

  return recommendations
}

/**
 * Detects unattached/orphaned managed disks
 * Criteria: Disk exists but is not attached to any VM
 */
export function detectUnusedDisks(
  resources: AzureResource[],
  costData: CostSnapshot[]
): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = []

  const disks = resources.filter(
    (r) =>
      r.resource_type === 'Microsoft.Compute/disks' ||
      r.resource_type === 'microsoft.compute/disks'
  )

  for (const disk of disks) {
    // Check if disk is unattached
    const properties = disk.properties as any
    const diskState = properties?.diskState?.toLowerCase() || ''
    const managedBy = properties?.managedBy || null

    const isUnattached =
      diskState === 'unattached' || (!managedBy && diskState !== 'attached')

    if (isUnattached) {
      const resourceCosts = costData.filter(
        (c) => c.resource_id === disk.resource_id
      )

      const last30DaysCost = calculateLast30DaysCost(resourceCosts)
      const monthlyEstimate = last30DaysCost > 0 ? last30DaysCost : 10 // Default estimate

      // 100% savings by deleting unused disk
      const potentialSavings = monthlyEstimate

      recommendations.push({
        recommendation_type: 'unused_disk',
        severity: determineSeverity(potentialSavings),
        title: `Unattached Disk: ${disk.resource_name}`,
        description: `This managed disk is not attached to any virtual machine and is incurring unnecessary storage costs. Review and delete if no longer needed.`,
        resource_id: disk.resource_id,
        resource_name: disk.resource_name,
        resource_type: disk.resource_type,
        resource_group: disk.resource_group,
        location: disk.location,
        current_monthly_cost_usd: monthlyEstimate,
        potential_monthly_savings_usd: potentialSavings,
        potential_annual_savings_usd: potentialSavings * 12,
        metrics: {
          disk_state: diskState,
          managed_by: managedBy,
          sku: disk.sku,
          disk_size_gb: properties?.diskSizeGB || 'unknown',
        },
        suggested_action:
          'Create a snapshot for backup if needed, then delete the unattached disk.',
        implementation_effort: 'low',
      })
    }
  }

  return recommendations
}

/**
 * Detects resources without proper tagging
 * Criteria: Resource lacks required tags for cost allocation
 */
export function detectUntaggedResources(
  resources: AzureResource[],
  requiredTags: string[] = ['Environment', 'Owner', 'CostCenter']
): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = []

  // Only check billable resources
  const billableResourceTypes = [
    'Microsoft.Compute/virtualMachines',
    'Microsoft.Storage/storageAccounts',
    'Microsoft.Sql/servers',
    'Microsoft.DBforPostgreSQL/servers',
    'Microsoft.DBforMySQL/servers',
    'Microsoft.Web/sites',
    'Microsoft.ContainerService/managedClusters',
  ]

  const billableResources = resources.filter((r) =>
    billableResourceTypes.some((type) =>
      r.resource_type.toLowerCase().includes(type.toLowerCase())
    )
  )

  for (const resource of billableResources) {
    const tags = (resource.tags as Record<string, string>) || {}
    const missingTags = requiredTags.filter((tag) => !(tag in tags))

    if (missingTags.length > 0) {
      recommendations.push({
        recommendation_type: 'untagged_resource',
        severity: 'low',
        title: `Missing Tags: ${resource.resource_name}`,
        description: `This resource is missing required tags: ${missingTags.join(
          ', '
        )}. Proper tagging is essential for cost allocation and resource management.`,
        resource_id: resource.resource_id,
        resource_name: resource.resource_name,
        resource_type: resource.resource_type,
        resource_group: resource.resource_group,
        location: resource.location,
        current_monthly_cost_usd: 0, // No direct cost impact
        potential_monthly_savings_usd: 0, // Indirect savings through better cost tracking
        potential_annual_savings_usd: 0,
        metrics: {
          existing_tags: Object.keys(tags),
          missing_tags: missingTags,
          required_tags: requiredTags,
        },
        suggested_action: `Add missing tags: ${missingTags.join(', ')}`,
        implementation_effort: 'low',
      })
    }
  }

  return recommendations
}

/**
 * Detects public IP addresses that are not associated with resources
 * Criteria: Public IP exists but is not attached to any resource
 */
export function detectUnusedPublicIPs(
  resources: AzureResource[],
  costData: CostSnapshot[]
): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = []

  const publicIPs = resources.filter(
    (r) =>
      r.resource_type === 'Microsoft.Network/publicIPAddresses' ||
      r.resource_type === 'microsoft.network/publicipaddresses'
  )

  for (const pip of publicIPs) {
    const properties = pip.properties as any
    const ipConfiguration = properties?.ipConfiguration || null

    if (!ipConfiguration) {
      const resourceCosts = costData.filter(
        (c) => c.resource_id === pip.resource_id
      )

      const last30DaysCost = calculateLast30DaysCost(resourceCosts)
      const monthlyEstimate = last30DaysCost > 0 ? last30DaysCost : 4 // ~$3-5/month

      const potentialSavings = monthlyEstimate

      recommendations.push({
        recommendation_type: 'unused_disk', // Using generic unused category
        severity: determineSeverity(potentialSavings),
        title: `Unused Public IP: ${pip.resource_name}`,
        description: `This public IP address is not associated with any resource and is incurring unnecessary costs.`,
        resource_id: pip.resource_id,
        resource_name: pip.resource_name,
        resource_type: pip.resource_type,
        resource_group: pip.resource_group,
        location: pip.location,
        current_monthly_cost_usd: monthlyEstimate,
        potential_monthly_savings_usd: potentialSavings,
        potential_annual_savings_usd: potentialSavings * 12,
        metrics: {
          ip_address: properties?.ipAddress || 'not assigned',
          allocation_method: properties?.publicIPAllocationMethod || 'unknown',
          sku: pip.sku,
        },
        suggested_action:
          'Delete the public IP address if not needed for future use.',
        implementation_effort: 'low',
      })
    }
  }

  return recommendations
}

/**
 * Main recommendation engine - generates all recommendations
 */
export function generateRecommendations(
  resources: AzureResource[],
  costData: CostSnapshot[]
): ResourceRecommendation[] {
  const allRecommendations: ResourceRecommendation[] = []

  // Run all detection algorithms
  allRecommendations.push(...detectIdleVMs(resources, costData))
  allRecommendations.push(...detectUnusedDisks(resources, costData))
  allRecommendations.push(...detectUnusedPublicIPs(resources, costData))
  allRecommendations.push(...detectUntaggedResources(resources))

  // Sort by potential savings (highest first)
  return allRecommendations.sort(
    (a, b) =>
      b.potential_monthly_savings_usd - a.potential_monthly_savings_usd
  )
}

/**
 * Helper: Calculate cost for last 30 days
 */
function calculateLast30DaysCost(costSnapshots: CostSnapshot[]): number {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentCosts = costSnapshots.filter(
    (c) => new Date(c.date) >= thirtyDaysAgo
  )

  return recentCosts.reduce((sum, c) => sum + c.cost_usd, 0)
}

/**
 * Helper: Determine severity based on potential savings
 */
function determineSeverity(
  monthlySavings: number
): RecommendationSeverity {
  if (monthlySavings >= 100) return 'high'
  if (monthlySavings >= 20) return 'medium'
  return 'low'
}
