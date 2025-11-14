import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateAlertRules } from '@/lib/alerts/evaluate'
import { rateLimiters, applyRateLimit, constantTimeCompare, verifyCronIPWhitelist, verifyCronHmacSignature } from '@/lib/rate-limit'

/**
 * Vercel Cron Job: Evaluate Alert Rules
 * Runs every hour (configured in vercel.json)
 *
 * This endpoint evaluates all active alert rules against the latest cost data
 * and triggers notifications when thresholds are exceeded.
 */
export async function GET(request: NextRequest) {
  try {
    // Defense-in-depth security layers for cron endpoints:

    // 1. Verify IP whitelist first (optional but recommended)
    const ipCheckResult = await verifyCronIPWhitelist(request)
    if (ipCheckResult) return ipCheckResult

    // 2. Apply IP-based rate limiting (10 attempts per hour per IP)
    const rateLimitResult = await applyRateLimit(request, rateLimiters.cron, 'ip')
    if (rateLimitResult) {
      console.error('[CRON] Rate limit exceeded for IP:', request.headers.get('x-forwarded-for'))
      return rateLimitResult
    }

    // 3. Verify HMAC signature (prevents replay attacks)
    const hmacCheckResult = await verifyCronHmacSignature(request)
    if (hmacCheckResult) return hmacCheckResult

    // 4. Verify Bearer token (defense in depth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not set')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    // Use constant-time comparison to prevent timing attacks
    const expectedAuth = `Bearer ${cronSecret}`
    if (!constantTimeCompare(authHeader || '', expectedAuth)) {
      // Log suspicious activity for monitoring
      console.error('[CRON] Unauthorized cron request:', {
        ip: request.headers.get('x-forwarded-for'),
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
      })

      // Add delay before responding to slow down brute force attempts
      await new Promise(resolve => setTimeout(resolve, 1000))

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[CRON] Starting alert evaluation job...')

    // Create Supabase client with service role for background job
    const supabase = await createClient()

    // Run alert evaluation logic
    const results = await evaluateAlertRules(supabase)

    console.log('[CRON] Alert evaluation job completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Alert evaluation completed',
      evaluated: results.evaluated,
      triggered: results.triggered,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[CRON] Alert evaluation job failed:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
