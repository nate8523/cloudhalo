import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClientSecretCredential } from '@azure/identity'
import { rateLimiters, applyRateLimit } from '@/lib/rate-limit'
import { logSecureError, handleAzureError } from '@/lib/security/error-handler'

/**
 * POST /api/tenants/validate
 *
 * Validates Azure service principal credentials by attempting to list subscriptions.
 * This endpoint is called before storing credentials to ensure they work.
 *
 * SECURITY:
 * - Requires authentication to prevent abuse of Azure credential testing
 * - Rate limited to 5 validations per hour per user to prevent brute force
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
    // SECURITY FIX: Authenticate user before allowing credential validation
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Apply rate limiting (5 validations per hour per user)
    const rateLimitResult = await applyRateLimit(
      request,
      rateLimiters.credentialValidation,
      'user',
      user.id
    )
    if (rateLimitResult) return rateLimitResult

    // Verify user has an organization
    const { data: userData } = await (supabase
      .from('users') as any)
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData?.org_id) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

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
    const response = handleAzureError('TenantValidate', error, {
      endpoint: 'POST /api/tenants/validate'
    })

    // Convert to validation response format
    const responseBody = await response.json()
    return NextResponse.json(
      {
        valid: false,
        error: responseBody.error,
        hint: responseBody.hint
      },
      { status: response.status }
    )
  }
}
