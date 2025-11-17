/**
 * Cron job endpoint to clean up expired sessions
 *
 * This endpoint:
 * 1. Terminates sessions that exceeded absolute timeout
 * 2. Cleans up old terminated sessions (older than 90 days)
 * 3. Logs cleanup statistics
 *
 * Security: Protected by 4-layer defense-in-depth security
 * - IP whitelisting (optional)
 * - Rate limiting (10 per hour per IP)
 * - HMAC signature verification
 * - Bearer token authentication
 *
 * Schedule: Hourly via Vercel Cron (orchestrator pattern)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  verifyCronIPWhitelist,
  applyRateLimit,
  rateLimiters,
  verifyCronHmacSignature,
  constantTimeCompare,
} from '@/lib/rate-limit'
import type { Database } from '@/types/database'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Defense-in-depth security layers for cron endpoints:

  // 1. Verify IP whitelist first (optional but recommended)
  const ipCheckResult = await verifyCronIPWhitelist(request)
  if (ipCheckResult) return ipCheckResult

  // 2. Apply rate limiting (10 attempts per hour per IP)
  const rateLimitResult = await applyRateLimit(request, rateLimiters.cron, 'ip')
  if (rateLimitResult) return rateLimitResult

  // 3. Verify HMAC signature (prevents replay attacks)
  const hmacCheckResult = await verifyCronHmacSignature(request)
  if (hmacCheckResult) return hmacCheckResult

  // 4. Verify Bearer token (defense in depth)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const expectedAuth = `Bearer ${cronSecret}`

  if (!constantTimeCompare(authHeader || '', expectedAuth)) {
    console.error('[CRON] Unauthorized session cleanup request:', {
      ip: request.headers.get('x-forwarded-for'),
      timestamp: new Date().toISOString(),
    })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Create Supabase client (service role for admin access)
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // No-op for server-side only
          },
        },
      }
    )

    // Terminate expired sessions (absolute timeout)
    const { error: terminateError } = await supabase.rpc('terminate_expired_sessions')

    if (terminateError) {
      console.error('[CRON] Error terminating expired sessions:', terminateError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to terminate expired sessions',
          duration: Date.now() - startTime,
        },
        { status: 500 }
      )
    }

    // Clean up old terminated sessions (older than 90 days)
    const { error: cleanupError } = await supabase.rpc('cleanup_old_sessions')

    if (cleanupError) {
      console.error('[CRON] Error cleaning up old sessions:', cleanupError)
      // Don't fail the whole job if cleanup fails
    }

    // Get session statistics
    const { count: activeSessionCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .is('terminated_at', null)

    const { count: terminatedTodayCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('terminated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const duration = Date.now() - startTime

    console.log('[CRON] Session cleanup completed:', {
      activeSessions: activeSessionCount,
      terminatedLast24h: terminatedTodayCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      stats: {
        activeSessions: activeSessionCount,
        terminatedLast24h: terminatedTodayCount,
      },
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Session cleanup error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Session cleanup failed',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
