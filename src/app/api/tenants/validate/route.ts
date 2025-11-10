import { NextRequest, NextResponse } from 'next/server'
import { ClientSecretCredential } from '@azure/identity'

/**
 * POST /api/tenants/validate
 *
 * Validates Azure service principal credentials by attempting to list subscriptions.
 * This endpoint is called before storing credentials to ensure they work.
 *
 * PRD Reference: Lines 277-281 (FR-1.2: Tenant Connection Flow)
 *
 * Request Body:
 * {
 *   "tenantId": "azure-tenant-id",
 *   "clientId": "service-principal-app-id",
 *   "clientSecret": "service-principal-secret"
 * }
 *
 * Response (Success):
 * {
 *   "valid": true,
 *   "subscriptionCount": 3,
 *   "message": "Credentials validated successfully"
 * }
 *
 * Response (Error):
 * {
 *   "valid": false,
 *   "error": "Invalid credentials or insufficient permissions"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, clientId, clientSecret } = body

    // Validate input
    if (!tenantId || !clientId || !clientSecret) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Missing required fields: tenantId, clientId, or clientSecret'
        },
        { status: 400 }
      )
    }

    // Create credential object
    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    )

    // Get access token for Azure Management API
    const token = await credential.getToken('https://management.azure.com/.default')

    // Set timeout for Azure API call (10 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Azure API timeout')), 10000)
    })

    // Call Azure REST API directly to list subscriptions
    const subscriptionsPromise = (async () => {
      const response = await fetch(
        'https://management.azure.com/subscriptions?api-version=2022-12-01',
        {
          headers: {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Azure API returned ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data.value || []
    })()

    // Race between API call and timeout
    const subscriptions = await Promise.race([
      subscriptionsPromise,
      timeoutPromise
    ]) as any[]

    // Success - credentials are valid
    return NextResponse.json({
      valid: true,
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions.map((sub: any) => ({
        id: sub.subscriptionId || sub.id || '',
        name: sub.displayName || sub.name || 'Unnamed Subscription'
      })),
      message: 'Credentials validated successfully'
    })

  } catch (error: any) {
    console.error('Azure credential validation error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    })

    // Parse Azure-specific errors
    let errorMessage = 'Invalid credentials or insufficient permissions'
    let errorHint = ''

    if (error.message?.includes('AADSTS')) {
      // Azure AD authentication errors
      if (error.message.includes('AADSTS700016')) {
        errorMessage = 'Invalid application (client) ID'
        errorHint = 'Check that your Application (client) ID is correct in Azure Portal > App registrations'
      } else if (error.message.includes('AADSTS7000215')) {
        errorMessage = 'Invalid client secret'
        errorHint = 'The client secret may be expired or incorrect. Generate a new one in Azure Portal'
      } else if (error.message.includes('AADSTS90002')) {
        errorMessage = 'Invalid tenant ID'
        errorHint = 'Check that your Directory (tenant) ID is correct in Azure Portal'
      } else if (error.message.includes('AADSTS50057')) {
        errorMessage = 'Account is disabled or deleted'
        errorHint = 'The service principal may have been disabled in Azure AD'
      } else {
        errorMessage = 'Azure AD authentication failed'
        errorHint = 'Please verify your credentials in Azure Portal > App registrations'
      }
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Azure API timeout. Please try again.'
      errorHint = 'The connection to Azure timed out. Check your internet connection.'
    } else if (error.statusCode === 403 || error.code === 'AuthorizationFailed') {
      errorMessage = 'Insufficient permissions'
      errorHint = 'Service principal needs Reader role at subscription level. Add in Azure Portal > Subscriptions > Access control (IAM)'
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Network error connecting to Azure'
      errorHint = 'Check your internet connection and firewall settings'
    }

    return NextResponse.json(
      {
        valid: false,
        error: errorMessage,
        hint: errorHint,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode
        } : undefined
      },
      { status: 401 }
    )
  }
}
