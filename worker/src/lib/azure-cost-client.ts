import { ClientSecretCredential } from '@azure/identity'
import { CostManagementClient } from '@azure/arm-costmanagement'
import { logger } from './logger'
import { CostQueryResult } from '../types'

interface AzureCredentials {
  tenantId: string
  clientId: string
  clientSecret: string
}

/**
 * Azure Cost Management API Client
 * Fetches cost data from Azure Cost Management API
 */
export class AzureCostClient {
  private credential: ClientSecretCredential
  private client: CostManagementClient

  constructor(credentials: AzureCredentials) {
    this.credential = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    )

    this.client = new CostManagementClient(this.credential)
  }

  /**
   * Fetch cost data for a subscription for the current month
   * Uses Azure Cost Management Query API
   */
  async fetchSubscriptionCosts(subscriptionId: string): Promise<CostQueryResult[]> {
    try {
      logger.debug('Fetching costs for subscription', { subscriptionId })

      const scope = `/subscriptions/${subscriptionId}`

      // Query for month-to-date costs with daily granularity
      const queryResult = await this.client.query.usage(scope, {
        type: 'Usage',
        timeframe: 'MonthToDate',
        dataset: {
          granularity: 'Daily',
          aggregation: {
            totalCost: {
              name: 'Cost',
              function: 'Sum'
            }
          },
          grouping: [
            { type: 'Dimension', name: 'ResourceId' },
            { type: 'Dimension', name: 'ResourceType' },
            { type: 'Dimension', name: 'ResourceGroupName' },
            { type: 'Dimension', name: 'ServiceName' },
            { type: 'Dimension', name: 'ResourceLocation' }
          ]
        }
      })

      const costs = this.parseQueryResults(queryResult, subscriptionId)
      logger.info(`Fetched ${costs.length} cost records for subscription ${subscriptionId}`)

      return costs
    } catch (error) {
      logger.error(`Failed to fetch costs for subscription ${subscriptionId}`, error)
      throw error
    }
  }

  /**
   * Parse Azure Cost Management query results into our format
   */
  private parseQueryResults(queryResult: any, subscriptionId: string): CostQueryResult[] {
    const results: CostQueryResult[] = []

    if (!queryResult.rows || queryResult.rows.length === 0) {
      logger.warn('No cost data returned from Azure API', { subscriptionId })
      return results
    }

    // Azure API returns data in columnar format
    // Columns: Cost, UsageDate, ResourceId, ResourceType, ResourceGroupName, ServiceName, ResourceLocation, Currency
    const columns = queryResult.columns || []
    const costIndex = columns.findIndex((c: any) => c.name === 'Cost')
    const dateIndex = columns.findIndex((c: any) => c.name === 'UsageDate')
    const resourceIdIndex = columns.findIndex((c: any) => c.name === 'ResourceId')
    const resourceTypeIndex = columns.findIndex((c: any) => c.name === 'ResourceType')
    const resourceGroupIndex = columns.findIndex((c: any) => c.name === 'ResourceGroupName')
    const serviceIndex = columns.findIndex((c: any) => c.name === 'ServiceName')
    const locationIndex = columns.findIndex((c: any) => c.name === 'ResourceLocation')
    const currencyIndex = columns.findIndex((c: any) => c.name === 'Currency')

    for (const row of queryResult.rows) {
      const cost = parseFloat(row[costIndex]) || 0

      // Skip zero-cost entries to reduce database bloat
      if (cost === 0) continue

      const resourceId = row[resourceIdIndex] || null
      const resourceName = resourceId ? this.extractResourceName(resourceId) : null
      const usageDate = row[dateIndex] ? this.formatDate(row[dateIndex]) : new Date().toISOString().split('T')[0]

      results.push({
        subscriptionId,
        resourceId,
        resourceName,
        resourceType: row[resourceTypeIndex] || null,
        resourceGroup: row[resourceGroupIndex] || null,
        serviceCategory: row[serviceIndex] || null,
        location: row[locationIndex] || null,
        cost,
        date: usageDate,
        currency: row[currencyIndex] || 'USD'
      })
    }

    return results
  }

  /**
   * Extract resource name from Azure resource ID
   * Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{type}/{name}
   */
  private extractResourceName(resourceId: string): string {
    const parts = resourceId.split('/')
    return parts[parts.length - 1] || resourceId
  }

  /**
   * Format Azure API date (YYYYMMDD) to YYYY-MM-DD
   */
  private formatDate(azureDate: number | string): string {
    const dateStr = azureDate.toString()
    if (dateStr.length === 8) {
      // Format: YYYYMMDD -> YYYY-MM-DD
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
    }
    // Fallback: return as-is or current date
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Convert non-USD currency to USD
   * Note: This is a simplified version. In production, use a currency exchange API
   */
  private convertToUSD(amount: number, currency: string): number {
    // For MVP, assume most costs are already in USD
    // Post-MVP: Integrate with exchange rate API (e.g., exchangerate-api.com)
    if (currency === 'USD') return amount

    // Simple fallback rates (should be replaced with real-time rates)
    const exchangeRates: Record<string, number> = {
      'EUR': 1.08,
      'GBP': 1.27,
      'CAD': 0.74,
      'AUD': 0.65,
      'INR': 0.012
    }

    const rate = exchangeRates[currency] || 1
    return amount * rate
  }
}
