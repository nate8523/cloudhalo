import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Redis client
// Note: Upstash automatically reads from UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
let redis: Redis | null = null

try {
  redis = Redis.fromEnv()
} catch (error) {
  console.warn('Rate limiting disabled: Upstash Redis environment variables not configured')
}

/**
 * Rate limit tiers for different endpoint types
 */
export const rateLimiters = {
  // Strict limits for authentication endpoints (prevent brute force)
  auth: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
    analytics: true,
    prefix: 'ratelimit:auth',
  }) : null,

  // Very strict limits for password operations
  password: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '15 m'), // 3 attempts per 15 minutes
    analytics: true,
    prefix: 'ratelimit:password',
  }) : null,

  // Strict limits for credential validation (expensive Azure API calls)
  credentialValidation: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 validations per hour
    analytics: true,
    prefix: 'ratelimit:credential',
  }) : null,

  // Moderate limits for expensive sync operations
  expensiveOperations: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '5 m'), // 10 operations per 5 minutes
    analytics: true,
    prefix: 'ratelimit:expensive',
  }) : null,

  // Lenient limits for regular API endpoints
  api: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
  }) : null,

  // Very strict IP-based limits for cron endpoints (defense in depth)
  cron: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 attempts per hour per IP
    analytics: true,
    prefix: 'ratelimit:cron',
  }) : null,

  // Moderate limits for webhook configuration
  webhook: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '5 m'), // 10 updates per 5 minutes
    analytics: true,
    prefix: 'ratelimit:webhook',
  }) : null,
}

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }

  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() :
             request.headers.get('x-real-ip') ||
             'unknown'

  return `ip:${ip}`
}

/**
 * Apply rate limiting to a request
 * Returns rate limit response if exceeded, null if allowed
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  // If rate limiting is not configured (no Redis), allow the request
  if (!limiter) {
    console.warn('Rate limiting check skipped: Redis not configured')
    return null
  }

  const { success, limit, reset, remaining } = await limiter.limit(identifier)

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)

    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': retryAfter.toString(),
        },
      }
    )
  }

  return null
}

/**
 * Middleware helper to apply rate limiting with proper error handling
 * Usage in API route:
 *
 * const rateLimitResult = await applyRateLimit(request, rateLimiters.auth, 'ip')
 * if (rateLimitResult) return rateLimitResult
 */
export async function applyRateLimit(
  request: NextRequest,
  limiter: Ratelimit | null,
  identifierType: 'ip' | 'user' = 'ip',
  userId?: string
): Promise<NextResponse | null> {
  try {
    const identifier = identifierType === 'user' && userId
      ? getClientIdentifier(request, userId)
      : getClientIdentifier(request)

    return await checkRateLimit(limiter, identifier)
  } catch (error) {
    console.error('Rate limiting error:', error)
    // On error, allow request to proceed (fail open for availability)
    // In production, you might want to fail closed for critical endpoints
    return null
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Verify request comes from whitelisted Vercel Cron IPs
 *
 * Usage:
 * const ipCheckResult = await verifyCronIPWhitelist(request)
 * if (ipCheckResult) return ipCheckResult
 *
 * Environment variable format (comma-separated):
 * VERCEL_CRON_IPS=76.76.21.21,76.76.21.22,76.76.21.23
 */
export async function verifyCronIPWhitelist(
  request: NextRequest
): Promise<NextResponse | null> {
  // Get whitelisted IPs from environment variable
  const vercelCronIPs = process.env.VERCEL_CRON_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) || []

  // If no whitelist configured, skip IP validation (for development)
  if (vercelCronIPs.length === 0) {
    console.warn('[CRON] IP whitelisting disabled: VERCEL_CRON_IPS not configured')
    return null
  }

  // Get request IP from headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const requestIP = forwardedFor ? forwardedFor.split(',')[0].trim() :
                    request.headers.get('x-real-ip') ||
                    'unknown'

  // Verify IP is in whitelist
  if (!vercelCronIPs.includes(requestIP)) {
    console.error('[CRON] Forbidden: Request from non-whitelisted IP:', {
      requestIP,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
    })

    // Add delay before responding to slow down scanning
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  // IP is whitelisted
  return null
}

/**
 * Verify HMAC signature for cron job requests
 *
 * This function implements HMAC-SHA256 request signing to prevent replay attacks
 * and unauthorized access to cron endpoints. It validates:
 * 1. Presence of X-Cron-Signature and X-Cron-Timestamp headers
 * 2. Timestamp is within 5-minute window (prevents replay attacks)
 * 3. HMAC signature matches expected value (prevents tampering)
 *
 * Security features:
 * - Constant-time signature comparison (prevents timing attacks)
 * - Timestamp validation (prevents replay attacks)
 * - Fail-fast on missing/invalid headers
 * - Comprehensive logging of suspicious activity
 *
 * Usage:
 * const hmacCheckResult = await verifyCronHmacSignature(request)
 * if (hmacCheckResult) return hmacCheckResult
 *
 * Required headers:
 * - X-Cron-Signature: HMAC-SHA256 signature (hex-encoded)
 * - X-Cron-Timestamp: ISO 8601 timestamp
 *
 * Signature is computed from: METHOD:PATH:TIMESTAMP:BODY
 *
 * @param request - Next.js request object
 * @returns NextResponse with 401 if verification fails, null if success
 */
export async function verifyCronHmacSignature(
  request: NextRequest
): Promise<NextResponse | null> {
  // Import HMAC utilities (dynamic to avoid circular dependencies)
  const { verifyHmacSignature, extractHmacHeaders } = await import('@/lib/security/hmac')

  // Check if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[CRON] HMAC verification skipped: CRON_SECRET not configured')
    // In production, you might want to fail closed here
    return null
  }

  // Extract HMAC headers
  const hmacHeaders = extractHmacHeaders(request.headers)

  // If no HMAC headers present, allow for backward compatibility during deployment
  // TODO: Remove this after all clients are updated to send HMAC headers
  if (!hmacHeaders) {
    console.warn('[CRON] HMAC headers missing - backward compatibility mode')
    return null
  }

  // Extract request details
  const method = request.method
  const url = new URL(request.url)
  const path = url.pathname

  // Get request body if present (for POST requests)
  let body = null
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    try {
      // Clone request to avoid consuming the body
      const clonedRequest = request.clone()
      const text = await clonedRequest.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch (error) {
      // If body parsing fails, treat as no body
      body = null
    }
  }

  // Verify HMAC signature
  const verificationResult = verifyHmacSignature(
    method,
    path,
    hmacHeaders.timestamp,
    hmacHeaders.signature,
    body,
    cronSecret
  )

  // Handle verification failure
  if (!verificationResult.success) {
    // Log suspicious activity for monitoring
    console.error('[CRON] HMAC verification failed:', {
      error: verificationResult.error,
      ip: request.headers.get('x-forwarded-for'),
      timestamp: hmacHeaders.timestamp,
      path,
      method,
      userAgent: request.headers.get('user-agent'),
    })

    // Add delay before responding to slow down brute force attempts
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: verificationResult.error
      },
      { status: 401 }
    )
  }

  // HMAC verification successful
  console.log('[CRON] HMAC signature verified successfully')
  return null
}
