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
 * Reserved Instance (RI) pricing estimates for common VM sizes
 * Savings percentages based on 1-year and 3-year commitments
 */
const RI_SAVINGS_DATA: Record<string, { oneYear: number; threeYear: number }> = {
  // B-Series (Burstable)
  'Standard_B1s': { oneYear: 0.31, threeYear: 0.49 },
  'Standard_B1ms': { oneYear: 0.31, threeYear: 0.49 },
  'Standard_B2s': { oneYear: 0.31, threeYear: 0.49 },
  'Standard_B2ms': { oneYear: 0.31, threeYear: 0.49 },
  'Standard_B4ms': { oneYear: 0.31, threeYear: 0.49 },

  // D-Series (General Purpose)
  'Standard_D2s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_D4s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_D8s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_D16s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_D32s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_D2_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_D4_v3': { oneYear: 0.38, threeYear: 0.62 },

  // D-Series v4 and v5
  'Standard_D2s_v4': { oneYear: 0.40, threeYear: 0.65 },
  'Standard_D4s_v4': { oneYear: 0.40, threeYear: 0.65 },
  'Standard_D8s_v4': { oneYear: 0.40, threeYear: 0.65 },
  'Standard_D2s_v5': { oneYear: 0.42, threeYear: 0.67 },
  'Standard_D4s_v5': { oneYear: 0.42, threeYear: 0.67 },

  // E-Series (Memory Optimized)
  'Standard_E2s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_E4s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_E8s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_E16s_v3': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_E32s_v3': { oneYear: 0.38, threeYear: 0.62 },

  // F-Series (Compute Optimized)
  'Standard_F2s_v2': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_F4s_v2': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_F8s_v2': { oneYear: 0.38, threeYear: 0.62 },
  'Standard_F16s_v2': { oneYear: 0.38, threeYear: 0.62 },

  // Default for unknown VM sizes
  'default': { oneYear: 0.35, threeYear: 0.60 },
}

/**
 * Detects VMs that would benefit from Reserved Instances
 * Criteria:
 * - VM has been running consistently (high uptime)
 * - VM has significant monthly costs
 * - VM is in a running/available state
 */
export function detectReservedInstanceOpportunities(
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
    // Only recommend RI for running VMs
    const powerState = vm.power_state?.toLowerCase() || ''
    const isRunning = powerState.includes('running') || powerState === 'powerstate/running'

    if (!isRunning) {
      continue // Skip stopped/deallocated VMs
    }

    // Calculate costs for this VM
    const resourceCosts = costData.filter(
      (c) => c.resource_id === vm.resource_id
    )

    const last30DaysCost = calculateLast30DaysCost(resourceCosts)
    const last90DaysCost = calculateLast90DaysCost(resourceCosts)

    // Calculate average daily cost to determine uptime consistency
    const last30DaysCount = Math.min(30, costData.filter(c => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return c.resource_id === vm.resource_id && new Date(c.date) >= thirtyDaysAgo
    }).length)

    const avgDailyCost = last30DaysCount > 0 ? last30DaysCost / last30DaysCount : 0

    // Estimate uptime percentage based on cost consistency
    // If daily costs are consistent, uptime is high
    const costVariance = calculateCostVariance(resourceCosts)
    const estimatedUptimePercent = costVariance < 0.3 ? 95 : costVariance < 0.5 ? 75 : 50

    // Only recommend RI if:
    // 1. Monthly cost is at least $20 (makes RI worthwhile)
    // 2. Uptime is consistently high (>70%)
    // 3. Has at least 30 days of cost history
    const monthlyEstimate = last30DaysCost > 0 ? last30DaysCost : 0

    if (monthlyEstimate < 20 || estimatedUptimePercent < 70 || last30DaysCount < 15) {
      continue
    }

    // Get VM size/SKU for RI savings calculation
    const vmSize = vm.sku || 'default'
    const riSavings = RI_SAVINGS_DATA[vmSize] || RI_SAVINGS_DATA['default']

    // Calculate potential savings
    // 1-year RI is recommended as the sweet spot for most customers
    const oneYearSavingsPercent = riSavings.oneYear
    const threeYearSavingsPercent = riSavings.threeYear

    const oneYearMonthlySavings = monthlyEstimate * oneYearSavingsPercent
    const threeYearMonthlySavings = monthlyEstimate * threeYearSavingsPercent

    // Calculate payback period (months to recoup upfront cost)
    // RI typically requires upfront or partial upfront payment
    const estimatedUpfrontCost = monthlyEstimate * 12 * (1 - oneYearSavingsPercent)
    const monthsToPayback = estimatedUpfrontCost / oneYearMonthlySavings

    recommendations.push({
      recommendation_type: 'reserved_instance',
      severity: determineSeverity(oneYearMonthlySavings),
      title: `Reserved Instance Opportunity: ${vm.resource_name}`,
      description: `This VM has been running consistently with ${estimatedUptimePercent}% uptime and costs approximately $${monthlyEstimate.toFixed(2)}/month. Purchasing a 1-year Reserved Instance could save ${(oneYearSavingsPercent * 100).toFixed(0)}% ($${oneYearMonthlySavings.toFixed(2)}/month), or a 3-year RI could save ${(threeYearSavingsPercent * 100).toFixed(0)}% ($${threeYearMonthlySavings.toFixed(2)}/month).`,
      resource_id: vm.resource_id,
      resource_name: vm.resource_name,
      resource_type: vm.resource_type,
      resource_group: vm.resource_group,
      location: vm.location,
      current_monthly_cost_usd: monthlyEstimate,
      potential_monthly_savings_usd: oneYearMonthlySavings, // Use 1-year as default
      potential_annual_savings_usd: oneYearMonthlySavings * 12,
      metrics: {
        vm_size: vmSize,
        power_state: vm.power_state,
        estimated_uptime_percent: estimatedUptimePercent,
        last_30_days_cost: last30DaysCost,
        last_90_days_cost: last90DaysCost,
        one_year_savings_percent: oneYearSavingsPercent * 100,
        three_year_savings_percent: threeYearSavingsPercent * 100,
        one_year_monthly_savings: oneYearMonthlySavings,
        three_year_monthly_savings: threeYearMonthlySavings,
        one_year_annual_savings: oneYearMonthlySavings * 12,
        three_year_annual_savings: threeYearMonthlySavings * 12,
        estimated_payback_months: Math.ceil(monthsToPayback),
        cost_variance: costVariance,
      },
      suggested_action: `Purchase a 1-year Reserved Instance for this ${vmSize} VM in ${vm.location || 'the current region'}. This will lock in savings of approximately $${oneYearMonthlySavings.toFixed(2)}/month (${(oneYearSavingsPercent * 100).toFixed(0)}% off pay-as-you-go). For longer-term commitments, consider a 3-year RI for ${(threeYearSavingsPercent * 100).toFixed(0)}% savings.`,
      implementation_effort: 'medium', // Requires purchasing and monitoring commitment
    })
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
  allRecommendations.push(...detectReservedInstanceOpportunities(resources, costData))
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
 * Helper: Calculate cost for last 90 days
 */
function calculateLast90DaysCost(costSnapshots: CostSnapshot[]): number {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const recentCosts = costSnapshots.filter(
    (c) => new Date(c.date) >= ninetyDaysAgo
  )

  return recentCosts.reduce((sum, c) => sum + c.cost_usd, 0)
}

/**
 * Helper: Calculate cost variance (coefficient of variation)
 * Used to determine consistency of resource usage
 * Lower variance = more consistent usage = better RI candidate
 */
function calculateCostVariance(costSnapshots: CostSnapshot[]): number {
  if (costSnapshots.length < 7) return 1.0 // Not enough data, assume high variance

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentCosts = costSnapshots
    .filter((c) => new Date(c.date) >= thirtyDaysAgo)
    .map((c) => c.cost_usd)

  if (recentCosts.length === 0) return 1.0

  // Calculate mean
  const mean = recentCosts.reduce((sum, cost) => sum + cost, 0) / recentCosts.length

  if (mean === 0) return 1.0

  // Calculate standard deviation
  const squaredDiffs = recentCosts.map((cost) => Math.pow(cost - mean, 2))
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / recentCosts.length
  const stdDev = Math.sqrt(variance)

  // Coefficient of variation (CV) = stdDev / mean
  // CV < 0.3 = low variance (consistent)
  // CV 0.3-0.5 = medium variance
  // CV > 0.5 = high variance (inconsistent)
  return stdDev / mean
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
