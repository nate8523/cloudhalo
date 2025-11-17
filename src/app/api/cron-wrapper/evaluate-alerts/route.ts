/**
 * Vercel Cron Wrapper for evaluate-alerts
 *
 * This wrapper is called by Vercel Cron (which doesn't support custom headers).
 * It generates HMAC signatures internally and forwards the request to the actual endpoint.
 *
 * SECURITY: Only Vercel Cron IPs can call this endpoint (IP whitelist enforced).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronIPWhitelist } from '@/lib/rate-limit'
import { generateHmacSignature } from '@/lib/security/hmac'
import { logSecureError, createSecureErrorResponse } from '@/lib/security/error-handler'

export async function GET(request: NextRequest) {
  // 1. Verify request is from Vercel Cron IP (if configured)
  const ipCheckResult = await verifyCronIPWhitelist(request)
  if (ipCheckResult) return ipCheckResult

  // 2. Generate HMAC signature for internal request
  const timestamp = new Date().toISOString()
  const method = 'GET'
  const path = '/api/cron/evaluate-alerts'
  const body = ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron Wrapper] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const signature = await generateHmacSignature(method, path, timestamp, body, cronSecret)

  // 3. Forward request to actual cron endpoint with HMAC headers
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'X-Cron-Timestamp': timestamp,
        'X-Cron-Signature': signature,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Cron Wrapper] Endpoint error:', data)
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    logSecureError('CronWrapper:EvaluateAlerts', error, {
      endpoint: 'GET /api/cron-wrapper/evaluate-alerts'
    })
    return createSecureErrorResponse('Failed to execute cron job', 500)
  }
}
