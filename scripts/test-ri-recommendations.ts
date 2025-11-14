/**
 * Test script for Reserved Instance recommendations
 * Run with: npx tsx scripts/test-ri-recommendations.ts
 */

import { detectReservedInstanceOpportunities } from '../src/lib/azure/recommendation-engine'

// Mock Azure resources - running VMs with different SKUs
const mockResources = [
  {
    id: '1',
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    subscription_id: 'sub-1',
    resource_id: '/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/prod-web-vm',
    resource_name: 'prod-web-vm',
    resource_type: 'Microsoft.Compute/virtualMachines',
    resource_group: 'rg-prod',
    location: 'eastus',
    sku: 'Standard_D4s_v3',
    kind: null,
    tags: {},
    provisioning_state: 'Succeeded',
    power_state: 'PowerState/running',
    properties: {},
    discovered_at: '2025-01-01T00:00:00Z',
    last_synced_at: '2025-01-14T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-14T00:00:00Z',
  },
  {
    id: '2',
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    subscription_id: 'sub-1',
    resource_id: '/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/prod-db-vm',
    resource_name: 'prod-db-vm',
    resource_type: 'Microsoft.Compute/virtualMachines',
    resource_group: 'rg-prod',
    location: 'eastus',
    sku: 'Standard_E8s_v3',
    kind: null,
    tags: {},
    provisioning_state: 'Succeeded',
    power_state: 'PowerState/running',
    properties: {},
    discovered_at: '2025-01-01T00:00:00Z',
    last_synced_at: '2025-01-14T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-14T00:00:00Z',
  },
  {
    id: '3',
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    subscription_id: 'sub-1',
    resource_id: '/subscriptions/sub-1/resourceGroups/rg-dev/providers/Microsoft.Compute/virtualMachines/dev-vm',
    resource_name: 'dev-vm',
    resource_type: 'Microsoft.Compute/virtualMachines',
    resource_group: 'rg-dev',
    location: 'westus',
    sku: 'Standard_B2ms',
    kind: null,
    tags: {},
    provisioning_state: 'Succeeded',
    power_state: 'PowerState/deallocated', // This one is stopped - should NOT get RI recommendation
    properties: {},
    discovered_at: '2025-01-01T00:00:00Z',
    last_synced_at: '2025-01-14T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-14T00:00:00Z',
  },
]

// Mock cost data - consistent daily costs for running VMs
const mockCostData = []
const today = new Date() // Use actual current date
const startDate = new Date(today)
startDate.setDate(startDate.getDate() - 90) // 90 days ago

// Generate 90 days of cost history
for (let i = 0; i < 90; i++) {
  const date = new Date(startDate)
  date.setDate(date.getDate() + i)
  const dateStr = date.toISOString().split('T')[0]

  // prod-web-vm: ~$150/month = ~$5/day (consistent usage - good RI candidate)
  mockCostData.push({
    id: `cost-1-${i}`,
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    subscription_id: 'sub-1',
    resource_id: '/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/prod-web-vm',
    resource_name: 'prod-web-vm',
    resource_type: 'Microsoft.Compute/virtualMachines',
    resource_group: 'rg-prod',
    service_category: 'Compute',
    location: 'eastus',
    cost_usd: 5.0 + (Math.random() * 0.2 - 0.1), // ~$5/day with small variance
    date: dateStr,
    created_at: date.toISOString(),
  })

  // prod-db-vm: ~$300/month = ~$10/day (consistent usage - excellent RI candidate)
  mockCostData.push({
    id: `cost-2-${i}`,
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    subscription_id: 'sub-1',
    resource_id: '/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/prod-db-vm',
    resource_name: 'prod-db-vm',
    resource_type: 'Microsoft.Compute/virtualMachines',
    resource_group: 'rg-prod',
    service_category: 'Compute',
    location: 'eastus',
    cost_usd: 10.0 + (Math.random() * 0.3 - 0.15), // ~$10/day with small variance
    date: dateStr,
    created_at: date.toISOString(),
  })

  // dev-vm: Small cost even when stopped (storage only)
  mockCostData.push({
    id: `cost-3-${i}`,
    org_id: 'org-1',
    tenant_id: 'tenant-1',
    subscription_id: 'sub-1',
    resource_id: '/subscriptions/sub-1/resourceGroups/rg-dev/providers/Microsoft.Compute/virtualMachines/dev-vm',
    resource_name: 'dev-vm',
    resource_type: 'Microsoft.Compute/virtualMachines',
    resource_group: 'rg-dev',
    service_category: 'Compute',
    location: 'westus',
    cost_usd: 0.5, // Storage only
    date: dateStr,
    created_at: date.toISOString(),
  })
}

console.log('Testing Reserved Instance Recommendations...\n')
console.log(`Mock Data:`)
console.log(`- Resources: ${mockResources.length} VMs`)
console.log(`- Cost Snapshots: ${mockCostData.length} days of data`)
console.log(`- Date Range: ${startDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}\n`)

// Run the RI detection
const recommendations = detectReservedInstanceOpportunities(
  mockResources as any,
  mockCostData as any
)

console.log(`\n===== RESERVED INSTANCE RECOMMENDATIONS =====\n`)
console.log(`Total Recommendations: ${recommendations.length}\n`)

if (recommendations.length === 0) {
  console.log('No RI opportunities found.')
} else {
  recommendations.forEach((rec, index) => {
    console.log(`[${index + 1}] ${rec.title}`)
    console.log(`    Resource: ${rec.resource_name} (${rec.metrics.vm_size})`)
    console.log(`    Location: ${rec.location}`)
    console.log(`    Severity: ${rec.severity.toUpperCase()}`)
    console.log(`    Current Monthly Cost: $${rec.current_monthly_cost_usd.toFixed(2)}`)
    console.log(`    Estimated Uptime: ${rec.metrics.estimated_uptime_percent}%`)
    console.log(`    Cost Variance: ${rec.metrics.cost_variance.toFixed(3)}`)
    console.log(`\n    1-Year RI Savings:`)
    console.log(`      - Percent: ${rec.metrics.one_year_savings_percent.toFixed(0)}%`)
    console.log(`      - Monthly: $${rec.metrics.one_year_monthly_savings.toFixed(2)}`)
    console.log(`      - Annual: $${rec.metrics.one_year_annual_savings.toFixed(2)}`)
    console.log(`\n    3-Year RI Savings:`)
    console.log(`      - Percent: ${rec.metrics.three_year_savings_percent.toFixed(0)}%`)
    console.log(`      - Monthly: $${rec.metrics.three_year_monthly_savings.toFixed(2)}`)
    console.log(`      - Annual: $${rec.metrics.three_year_annual_savings.toFixed(2)}`)
    console.log(`\n    Payback Period: ${rec.metrics.estimated_payback_months} months`)
    console.log(`    Implementation Effort: ${rec.implementation_effort}`)
    console.log(`\n    Suggested Action:`)
    console.log(`    ${rec.suggested_action}`)
    console.log(`\n    Description:`)
    console.log(`    ${rec.description}`)
    console.log(`\n${'='.repeat(60)}\n`)
  })
}

console.log(`\n===== SUMMARY =====\n`)
const totalMonthlySavings = recommendations.reduce((sum, r) => sum + r.potential_monthly_savings_usd, 0)
const totalAnnualSavings = recommendations.reduce((sum, r) => sum + r.potential_annual_savings_usd, 0)
console.log(`Total Potential Monthly Savings (1-year RI): $${totalMonthlySavings.toFixed(2)}`)
console.log(`Total Potential Annual Savings (1-year RI): $${totalAnnualSavings.toFixed(2)}`)
console.log(`\nRecommendations by Severity:`)
console.log(`  - High: ${recommendations.filter(r => r.severity === 'high').length}`)
console.log(`  - Medium: ${recommendations.filter(r => r.severity === 'medium').length}`)
console.log(`  - Low: ${recommendations.filter(r => r.severity === 'low').length}`)
