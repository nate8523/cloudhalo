/**
 * Azure Resource Graph API Integration
 *
 * This module provides functions to query Azure Resource Graph API for discovering
 * and inventorying Azure resources across subscriptions.
 *
 * PRD Reference: Resource Discovery & Inventory (P0)
 */

import { ClientSecretCredential } from '@azure/identity'
import { ResourceGraphClient } from '@azure/arm-resourcegraph'

export interface AzureResourceGraphQuery {
  query: string
  subscriptions?: string[]
  options?: {
    top?: number
    skip?: number
  }
}

export interface AzureResource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup: string
  subscriptionId: string
  tags?: Record<string, string>
  sku?: {
    name?: string
    tier?: string
  }
  kind?: string
  properties?: any
  provisioningState?: string
  powerState?: string
}

/**
 * Query Azure Resource Graph to discover resources
 *
 * @param credential - Azure ClientSecretCredential for authentication
 * @param subscriptions - Array of subscription IDs to query
 * @param customQuery - Optional custom Kusto query (defaults to all resources)
 * @returns Array of discovered Azure resources
 */
export async function discoverResources(
  credential: ClientSecretCredential,
  subscriptions: string[],
  customQuery?: string
): Promise<AzureResource[]> {
  const client = new ResourceGraphClient(credential)

  // Default query to get all resources with comprehensive details
  const query = customQuery || `
    Resources
    | project
      id,
      name,
      type,
      location,
      resourceGroup,
      subscriptionId,
      tags,
      sku,
      kind,
      properties,
      provisioningState = tostring(properties.provisioningState)
    | order by type asc, name asc
  `

  try {
    const result = await client.resources({
      query,
      subscriptions,
      options: {
        resultFormat: 'objectArray'
      }
    })

    if (!result.data || !Array.isArray(result.data)) {
      console.warn('[Resource Graph] No data returned from query')
      return []
    }

    // Map the results to our AzureResource interface
    const resources: AzureResource[] = result.data.map((resource: any) => ({
      id: resource.id || '',
      name: resource.name || '',
      type: resource.type || '',
      location: resource.location || '',
      resourceGroup: resource.resourceGroup || '',
      subscriptionId: resource.subscriptionId || '',
      tags: resource.tags || {},
      sku: resource.sku,
      kind: resource.kind,
      properties: resource.properties,
      provisioningState: resource.provisioningState || resource.properties?.provisioningState,
      powerState: extractPowerState(resource)
    }))

    return resources
  } catch (error: any) {
    console.error('[Resource Graph] Error querying resources:', error)
    throw new Error(`Failed to query Azure Resource Graph: ${error.message}`)
  }
}

/**
 * Query resources by type
 *
 * @param credential - Azure ClientSecretCredential
 * @param subscriptions - Array of subscription IDs
 * @param resourceType - Azure resource type (e.g., 'Microsoft.Compute/virtualMachines')
 * @returns Array of resources matching the specified type
 */
export async function discoverResourcesByType(
  credential: ClientSecretCredential,
  subscriptions: string[],
  resourceType: string
): Promise<AzureResource[]> {
  const query = `
    Resources
    | where type =~ '${resourceType}'
    | project
      id,
      name,
      type,
      location,
      resourceGroup,
      subscriptionId,
      tags,
      sku,
      kind,
      properties,
      provisioningState = tostring(properties.provisioningState)
    | order by name asc
  `

  return discoverResources(credential, subscriptions, query)
}

/**
 * Query resources by resource group
 *
 * @param credential - Azure ClientSecretCredential
 * @param subscriptions - Array of subscription IDs
 * @param resourceGroup - Resource group name
 * @returns Array of resources in the specified resource group
 */
export async function discoverResourcesByResourceGroup(
  credential: ClientSecretCredential,
  subscriptions: string[],
  resourceGroup: string
): Promise<AzureResource[]> {
  const query = `
    Resources
    | where resourceGroup =~ '${resourceGroup}'
    | project
      id,
      name,
      type,
      location,
      resourceGroup,
      subscriptionId,
      tags,
      sku,
      kind,
      properties,
      provisioningState = tostring(properties.provisioningState)
    | order by type asc, name asc
  `

  return discoverResources(credential, subscriptions, query)
}

/**
 * Get resource counts by type
 *
 * @param credential - Azure ClientSecretCredential
 * @param subscriptions - Array of subscription IDs
 * @returns Object mapping resource types to counts
 */
export async function getResourceCountsByType(
  credential: ClientSecretCredential,
  subscriptions: string[]
): Promise<Record<string, number>> {
  const client = new ResourceGraphClient(credential)

  const query = `
    Resources
    | summarize count() by type
    | order by count_ desc
  `

  try {
    const result = await client.resources({
      query,
      subscriptions,
      options: {
        resultFormat: 'objectArray'
      }
    })

    if (!result.data || !Array.isArray(result.data)) {
      return {}
    }

    const counts: Record<string, number> = {}
    result.data.forEach((item: any) => {
      if (item.type && item.count_) {
        counts[item.type] = item.count_
      }
    })

    return counts
  } catch (error: any) {
    console.error('[Resource Graph] Error getting resource counts:', error)
    throw new Error(`Failed to get resource counts: ${error.message}`)
  }
}

/**
 * Get resources with specific tags
 *
 * @param credential - Azure ClientSecretCredential
 * @param subscriptions - Array of subscription IDs
 * @param tagKey - Tag key to filter by
 * @param tagValue - Optional tag value to filter by
 * @returns Array of resources with the specified tag
 */
export async function discoverResourcesByTag(
  credential: ClientSecretCredential,
  subscriptions: string[],
  tagKey: string,
  tagValue?: string
): Promise<AzureResource[]> {
  const tagFilter = tagValue
    ? `tags['${tagKey}'] =~ '${tagValue}'`
    : `isnotempty(tags['${tagKey}'])`

  const query = `
    Resources
    | where ${tagFilter}
    | project
      id,
      name,
      type,
      location,
      resourceGroup,
      subscriptionId,
      tags,
      sku,
      kind,
      properties,
      provisioningState = tostring(properties.provisioningState)
    | order by type asc, name asc
  `

  return discoverResources(credential, subscriptions, query)
}

/**
 * Extract power state from resource properties
 * Currently supports Virtual Machines
 *
 * @param resource - Raw resource object from Azure
 * @returns Power state string or undefined
 */
function extractPowerState(resource: any): string | undefined {
  // For Virtual Machines, power state is in extended properties
  if (resource.type === 'Microsoft.Compute/virtualMachines') {
    // Power state is typically in properties.extended.instanceView.powerState
    // or we need to make a separate API call to get instance view
    // For now, we'll return undefined and handle this in a separate sync
    return resource.properties?.extended?.instanceView?.powerState?.code
  }

  return undefined
}

/**
 * Batch query resources in chunks to handle large result sets
 *
 * @param credential - Azure ClientSecretCredential
 * @param subscriptions - Array of subscription IDs
 * @param batchSize - Number of results per batch (default 1000)
 * @returns Array of all discovered resources
 */
export async function discoverResourcesPaginated(
  credential: ClientSecretCredential,
  subscriptions: string[],
  batchSize: number = 1000
): Promise<AzureResource[]> {
  const client = new ResourceGraphClient(credential)
  let allResources: AzureResource[] = []
  let skip = 0
  let hasMore = true

  const baseQuery = `
    Resources
    | project
      id,
      name,
      type,
      location,
      resourceGroup,
      subscriptionId,
      tags,
      sku,
      kind,
      properties,
      provisioningState = tostring(properties.provisioningState)
    | order by type asc, name asc
  `

  while (hasMore) {
    try {
      const result = await client.resources({
        query: baseQuery,
        subscriptions,
        options: {
          top: batchSize,
          skip,
          resultFormat: 'objectArray'
        }
      })

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        hasMore = false
        break
      }

      const resources: AzureResource[] = result.data.map((resource: any) => ({
        id: resource.id || '',
        name: resource.name || '',
        type: resource.type || '',
        location: resource.location || '',
        resourceGroup: resource.resourceGroup || '',
        subscriptionId: resource.subscriptionId || '',
        tags: resource.tags || {},
        sku: resource.sku,
        kind: resource.kind,
        properties: resource.properties,
        provisioningState: resource.provisioningState || resource.properties?.provisioningState,
        powerState: extractPowerState(resource)
      }))

      allResources = allResources.concat(resources)

      // Check if there are more results
      if (result.data.length < batchSize) {
        hasMore = false
      } else {
        skip += batchSize
      }

      console.log(`[Resource Graph] Fetched ${allResources.length} resources so far...`)
    } catch (error: any) {
      console.error('[Resource Graph] Error in paginated query:', error)
      throw new Error(`Failed to query resources (batch starting at ${skip}): ${error.message}`)
    }
  }

  console.log(`[Resource Graph] Total resources discovered: ${allResources.length}`)
  return allResources
}
