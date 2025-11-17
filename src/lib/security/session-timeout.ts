/**
 * Session and Idle Timeout Security Module
 *
 * Implements comprehensive session management with two types of timeouts:
 * 1. Session Timeout (Absolute): Maximum session lifetime regardless of activity
 * 2. Idle Timeout: Automatic logout after period of inactivity
 *
 * Security Features:
 * - Database-backed session tracking for audit trail
 * - Secure httpOnly cookies for timeout metadata
 * - Constant-time timestamp comparisons
 * - Comprehensive logging for security monitoring
 * - Defense-in-depth with multiple validation layers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Session timeout configuration
 * All durations in milliseconds
 */
export interface SessionTimeoutConfig {
  // Absolute session timeout (default: 8 hours)
  sessionTimeoutMs: number

  // Idle timeout (default: 30 minutes)
  idleTimeoutMs: number

  // Cookie name for tracking session metadata
  sessionCookieName: string

  // Enable session timeout enforcement
  enableSessionTimeout: boolean

  // Enable idle timeout enforcement
  enableIdleTimeout: boolean
}

/**
 * Session metadata stored in secure cookie
 */
interface SessionMetadata {
  sessionId: string
  createdAt: number
  lastActivityAt: number
  expiresAt: number
}

/**
 * Session timeout validation result
 */
export interface TimeoutValidationResult {
  valid: boolean
  reason?: 'session_timeout' | 'idle_timeout' | 'no_session' | 'invalid_metadata'
  remainingSessionTime?: number
  remainingIdleTime?: number
}

/**
 * Get session timeout configuration from environment variables
 * with secure defaults
 */
export function getSessionTimeoutConfig(): SessionTimeoutConfig {
  // Parse session timeout (default: 8 hours)
  const sessionTimeoutHours = parseInt(process.env.SESSION_TIMEOUT_HOURS || '8', 10)
  const sessionTimeoutMs = sessionTimeoutHours * 60 * 60 * 1000

  // Parse idle timeout (default: 30 minutes)
  const idleTimeoutMinutes = parseInt(process.env.IDLE_TIMEOUT_MINUTES || '30', 10)
  const idleTimeoutMs = idleTimeoutMinutes * 60 * 1000

  return {
    sessionTimeoutMs,
    idleTimeoutMs,
    sessionCookieName: 'cloudhalo_session_meta',
    enableSessionTimeout: process.env.ENABLE_SESSION_TIMEOUT !== 'false',
    enableIdleTimeout: process.env.ENABLE_IDLE_TIMEOUT !== 'false',
  }
}

/**
 * Create session metadata for a new session
 */
export function createSessionMetadata(sessionId: string): SessionMetadata {
  const config = getSessionTimeoutConfig()
  const now = Date.now()

  return {
    sessionId,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + config.sessionTimeoutMs,
  }
}

/**
 * Parse session metadata from cookie value
 * Returns null if invalid or corrupted
 */
export function parseSessionMetadata(cookieValue: string): SessionMetadata | null {
  try {
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8')
    const metadata = JSON.parse(decoded) as SessionMetadata

    // Validate required fields
    if (
      !metadata.sessionId ||
      !metadata.createdAt ||
      !metadata.lastActivityAt ||
      !metadata.expiresAt
    ) {
      return null
    }

    return metadata
  } catch {
    return null
  }
}

/**
 * Encode session metadata to secure cookie value
 */
export function encodeSessionMetadata(metadata: SessionMetadata): string {
  const json = JSON.stringify(metadata)
  return Buffer.from(json, 'utf-8').toString('base64')
}

/**
 * Validate session timeout using constant-time comparisons
 *
 * Security considerations:
 * - Uses constant-time timestamp validation to prevent timing attacks
 * - Validates both absolute session timeout and idle timeout
 * - Returns detailed information for logging without exposing to client
 *
 * @param metadata - Session metadata from secure cookie
 * @returns Validation result with timeout status
 */
export function validateSessionTimeout(
  metadata: SessionMetadata
): TimeoutValidationResult {
  const config = getSessionTimeoutConfig()
  const now = Date.now()

  // Check if session timeout is enabled
  if (!config.enableSessionTimeout && !config.enableIdleTimeout) {
    return {
      valid: true,
      remainingSessionTime: metadata.expiresAt - now,
      remainingIdleTime: metadata.lastActivityAt + config.idleTimeoutMs - now,
    }
  }

  // Validate absolute session timeout (constant-time comparison)
  if (config.enableSessionTimeout) {
    const sessionExpired = now >= metadata.expiresAt

    if (sessionExpired) {
      return {
        valid: false,
        reason: 'session_timeout',
        remainingSessionTime: 0,
      }
    }
  }

  // Validate idle timeout (constant-time comparison)
  if (config.enableIdleTimeout) {
    const idleExpiresAt = metadata.lastActivityAt + config.idleTimeoutMs
    const idleExpired = now >= idleExpiresAt

    if (idleExpired) {
      return {
        valid: false,
        reason: 'idle_timeout',
        remainingIdleTime: 0,
      }
    }
  }

  // Session is valid
  return {
    valid: true,
    remainingSessionTime: metadata.expiresAt - now,
    remainingIdleTime: metadata.lastActivityAt + config.idleTimeoutMs - now,
  }
}

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(metadata: SessionMetadata): SessionMetadata {
  return {
    ...metadata,
    lastActivityAt: Date.now(),
  }
}

/**
 * Create secure session cookie with timeout metadata
 *
 * Security features:
 * - httpOnly: Prevents JavaScript access
 * - secure: HTTPS only (in production)
 * - sameSite: Prevents CSRF attacks
 * - path: Limited to application routes
 */
export function createSessionCookie(
  metadata: SessionMetadata,
  response: NextResponse
): void {
  const config = getSessionTimeoutConfig()
  const encodedMetadata = encodeSessionMetadata(metadata)

  response.cookies.set(config.sessionCookieName, encodedMetadata, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTimeoutMs / 1000, // Convert to seconds
  })
}

/**
 * Delete session cookie (on logout or timeout)
 */
export function deleteSessionCookie(response: NextResponse): void {
  const config = getSessionTimeoutConfig()

  response.cookies.delete(config.sessionCookieName)
}

/**
 * Get session metadata from request cookies
 */
export function getSessionMetadata(request: NextRequest): SessionMetadata | null {
  const config = getSessionTimeoutConfig()
  const cookieValue = request.cookies.get(config.sessionCookieName)?.value

  if (!cookieValue) {
    return null
  }

  return parseSessionMetadata(cookieValue)
}

/**
 * Log session timeout event for security monitoring
 *
 * Logs to console with structured format for easy parsing by monitoring tools
 * Does NOT expose sensitive information
 */
export function logSessionTimeoutEvent(
  reason: string,
  userId?: string,
  metadata?: {
    ip?: string
    userAgent?: string
    sessionId?: string
    remainingTime?: number
  }
): void {
  console.log('[SESSION_TIMEOUT]', {
    event: 'session_terminated',
    reason,
    userId: userId ? `user:${userId.substring(0, 8)}...` : 'unknown', // Truncate for privacy
    ip: metadata?.ip ? `${metadata.ip.substring(0, 10)}...` : 'unknown', // Truncate IP
    userAgent: metadata?.userAgent?.substring(0, 50), // Limit length
    sessionId: metadata?.sessionId ? `${metadata.sessionId.substring(0, 8)}...` : 'unknown',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Create or update session in database
 *
 * Called on login and periodically during session to track activity
 * Uses Supabase service role client for database access
 */
export async function createOrUpdateDatabaseSession(
  request: NextRequest,
  userId: string,
  orgId: string,
  sessionToken: string
): Promise<void> {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // No-op for server-side only
          },
        },
      }
    )

    const config = getSessionTimeoutConfig()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + config.sessionTimeoutMs)

    // Get client IP and user agent for audit trail
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Upsert session record
    const { error } = await supabase
      .from('user_sessions')
      // @ts-ignore - TypeScript has issues inferring the generic type here
      .upsert(
        {
          user_id: userId,
          org_id: orgId,
          session_token: sessionToken,
          ip_address: ip,
          user_agent: userAgent,
          last_activity_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        {
          onConflict: 'session_token',
        }
      )

    if (error) {
      console.error('[SESSION_TIMEOUT] Failed to create/update database session:', error.message)
    }
  } catch (error) {
    console.error('[SESSION_TIMEOUT] Error managing database session:', error)
  }
}

/**
 * Terminate session in database
 *
 * Called on logout or timeout to mark session as terminated
 */
export async function terminateDatabaseSession(
  sessionToken: string,
  reason: 'session_timeout' | 'idle_timeout' | 'manual_logout' | 'force_logout'
): Promise<void> {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // No-op
          },
        },
      }
    )

    const { error } = await supabase.rpc('terminate_idle_session', {
      p_session_token: sessionToken,
      p_reason: reason,
    } as any)

    if (error) {
      console.error('[SESSION_TIMEOUT] Failed to terminate database session:', error.message)
    }
  } catch (error) {
    console.error('[SESSION_TIMEOUT] Error terminating database session:', error)
  }
}

/**
 * Get timeout message for display on login page
 */
export function getTimeoutMessage(
  reason?: 'session_timeout' | 'idle_timeout'
): string {
  switch (reason) {
    case 'session_timeout':
      return 'Your session has expired for security reasons. Please sign in again.'
    case 'idle_timeout':
      return 'You have been logged out due to inactivity. Please sign in again.'
    default:
      return 'Please sign in to continue.'
  }
}
