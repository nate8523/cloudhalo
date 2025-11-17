/**
 * HMAC-SHA256 Signature Utilities for Cron Job Authentication
 *
 * This module provides HMAC-based request signing to prevent replay attacks
 * and unauthorized access to cron endpoints. All signatures use HMAC-SHA256
 * and include timestamp validation to enforce a 5-minute validity window.
 *
 * Uses Web Crypto API for compatibility with Edge Runtime and Node.js.
 *
 * Security Features:
 * - HMAC-SHA256 signatures prevent tampering
 * - Timestamp validation prevents replay attacks
 * - Constant-time comparison prevents timing attacks
 * - Cryptographically secure signature generation
 *
 * @module security/hmac
 */

/**
 * Maximum age for request timestamps (5 minutes in milliseconds)
 * Requests with timestamps older than this will be rejected
 */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Generate HMAC-SHA256 signature for a request using Web Crypto API
 *
 * The signature is computed from:
 * - HTTP method (GET, POST, etc.)
 * - URL path (e.g., /api/cron/poll-costs)
 * - Timestamp (ISO 8601 format)
 * - Request body (if present, as JSON string)
 *
 * @param method - HTTP method (e.g., 'GET', 'POST')
 * @param path - URL path (e.g., '/api/cron/poll-costs')
 * @param timestamp - ISO 8601 timestamp
 * @param body - Optional request body as object (will be JSON.stringify'd)
 * @param secret - HMAC secret key (CRON_SECRET)
 * @returns Promise resolving to hex-encoded HMAC-SHA256 signature
 *
 * @example
 * const signature = await generateHmacSignature(
 *   'GET',
 *   '/api/cron/poll-costs',
 *   new Date().toISOString(),
 *   null,
 *   process.env.CRON_SECRET
 * )
 */
export async function generateHmacSignature(
  method: string,
  path: string,
  timestamp: string,
  body: any = null,
  secret: string
): Promise<string> {
  // Construct the message to sign
  // Format: METHOD:PATH:TIMESTAMP[:BODY_JSON]
  const bodyString = body ? JSON.stringify(body) : ''
  const message = `${method.toUpperCase()}:${path}:${timestamp}:${bodyString}`

  // Convert strings to Uint8Array
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  // Import the secret key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Generate HMAC-SHA256 signature
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)

  // Convert ArrayBuffer to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return signatureHex
}

/**
 * Verify HMAC-SHA256 signature for a request
 *
 * This function validates both the signature and the timestamp to ensure
 * the request is authentic and not a replay attack.
 *
 * Security checks:
 * 1. Timestamp is within 5-minute window (prevents replay attacks)
 * 2. Signature matches expected value (prevents tampering)
 * 3. Constant-time comparison (prevents timing attacks)
 *
 * @param method - HTTP method from request
 * @param path - URL path from request
 * @param timestamp - ISO 8601 timestamp from X-Cron-Timestamp header
 * @param providedSignature - Signature from X-Cron-Signature header
 * @param body - Optional request body
 * @param secret - HMAC secret key (CRON_SECRET)
 * @returns Promise resolving to object with success status and optional error message
 *
 * @example
 * const result = await verifyHmacSignature(
 *   'GET',
 *   '/api/cron/poll-costs',
 *   request.headers.get('X-Cron-Timestamp'),
 *   request.headers.get('X-Cron-Signature'),
 *   null,
 *   process.env.CRON_SECRET
 * )
 *
 * if (!result.success) {
 *   console.error('Signature verification failed:', result.error)
 * }
 */
export async function verifyHmacSignature(
  method: string,
  path: string,
  timestamp: string | null,
  providedSignature: string | null,
  body: any = null,
  secret: string
): Promise<{ success: boolean; error?: string }> {
  // Validate required parameters
  if (!timestamp) {
    return { success: false, error: 'Missing timestamp header' }
  }

  if (!providedSignature) {
    return { success: false, error: 'Missing signature header' }
  }

  if (!secret) {
    return { success: false, error: 'HMAC secret not configured' }
  }

  // Validate timestamp format and freshness
  let requestTime: Date
  try {
    requestTime = new Date(timestamp)

    // Check if timestamp is valid
    if (isNaN(requestTime.getTime())) {
      return { success: false, error: 'Invalid timestamp format' }
    }
  } catch (error) {
    return { success: false, error: 'Invalid timestamp format' }
  }

  // Check timestamp age (fail fast before signature verification)
  const now = new Date()
  const age = now.getTime() - requestTime.getTime()

  if (age < 0) {
    // Request timestamp is in the future
    return { success: false, error: 'Timestamp is in the future' }
  }

  if (age > MAX_TIMESTAMP_AGE_MS) {
    // Request is too old (replay attack prevention)
    const ageMinutes = Math.floor(age / 60000)
    return { success: false, error: `Request expired (${ageMinutes} minutes old, max 5 minutes)` }
  }

  // Generate expected signature
  const expectedSignature = await generateHmacSignature(
    method,
    path,
    timestamp,
    body,
    secret
  )

  // Verify signature using constant-time comparison
  if (!constantTimeCompare(providedSignature, expectedSignature)) {
    return { success: false, error: 'Invalid signature' }
  }

  // All checks passed
  return { success: true }
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * Uses manual constant-time comparison implementation compatible with
 * both Node.js and Edge Runtime.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
  // Early length check (safe because length is public information)
  if (a.length !== b.length) {
    return false
  }

  // Manual constant-time comparison
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Extract HMAC headers from a request
 *
 * Helper function to extract the X-Cron-Timestamp and X-Cron-Signature
 * headers from a Next.js request object.
 *
 * @param headers - Request headers object
 * @returns Object with timestamp and signature, or null if headers missing
 *
 * @example
 * const hmacHeaders = extractHmacHeaders(request.headers)
 * if (!hmacHeaders) {
 *   return NextResponse.json({ error: 'Missing HMAC headers' }, { status: 401 })
 * }
 */
export function extractHmacHeaders(
  headers: Headers
): { timestamp: string; signature: string } | null {
  const timestamp = headers.get('X-Cron-Timestamp')
  const signature = headers.get('X-Cron-Signature')

  if (!timestamp || !signature) {
    return null
  }

  return { timestamp, signature }
}
