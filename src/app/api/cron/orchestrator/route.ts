import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters, applyRateLimit, constantTimeCompare, verifyCronIPWhitelist, verifyCronHmacSignature } from '@/lib/rate-limit'
import { getTasksToRun, formatTaskResult, type TaskExecutionResult, type CronTask } from '@/lib/cron/task-scheduler'
import { generateHmacSignature } from '@/lib/security/hmac'

/**
 * Cron Orchestrator Endpoint
 *
 * This is the central orchestrator for all scheduled background tasks.
 * Instead of having separate Vercel Cron jobs for each task, we have a single
 * orchestrator that runs frequently and determines which tasks to execute based
 * on their configured schedules.
 *
 * Benefits:
 * - Single cron job configuration in Vercel
 * - Centralized scheduling logic
 * - Easier to manage and monitor
 * - Better control over task execution order and dependencies
 * - Reduced number of cron endpoints
 *
 * Security:
 * - IP whitelisting (optional via VERCEL_CRON_IPS)
 * - Rate limiting (10 attempts per hour per IP)
 * - HMAC-SHA256 request signing (prevents replay attacks)
 * - Bearer token authentication (defense in depth)
 *
 * Schedule: Runs every hour (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  const startTime = new Date()

  try {
    // Defense-in-depth security layers for cron endpoints:

    // 1. Verify IP whitelist first (optional but recommended)
    const ipCheckResult = await verifyCronIPWhitelist(request)
    if (ipCheckResult) return ipCheckResult

    // 2. Apply IP-based rate limiting (10 attempts per hour per IP)
    const rateLimitResult = await applyRateLimit(request, rateLimiters.cron, 'ip')
    if (rateLimitResult) {
      console.error('[ORCHESTRATOR] Rate limit exceeded for IP:', request.headers.get('x-forwarded-for'))
      return rateLimitResult
    }

    // 3. Verify HMAC signature (prevents replay attacks)
    const hmacCheckResult = await verifyCronHmacSignature(request)
    if (hmacCheckResult) return hmacCheckResult

    // 4. Verify Bearer token (defense in depth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[ORCHESTRATOR] CRON_SECRET environment variable not set')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    // Use constant-time comparison to prevent timing attacks
    const expectedAuth = `Bearer ${cronSecret}`
    if (!constantTimeCompare(authHeader || '', expectedAuth)) {
      // Log suspicious activity for monitoring
      console.error('[ORCHESTRATOR] Unauthorized cron request:', {
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

    const now = new Date()
    console.log('[ORCHESTRATOR] Starting orchestrator run at', now.toISOString())

    // Determine which tasks should run now
    const tasksToRun = getTasksToRun(now)

    console.log(`[ORCHESTRATOR] Found ${tasksToRun.length} task(s) to run`)

    if (tasksToRun.length === 0) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      return NextResponse.json({
        success: true,
        message: 'No tasks scheduled to run at this time',
        timestamp: now.toISOString(),
        tasksEvaluated: 0,
        tasksExecuted: 0,
        duration,
      })
    }

    // Execute each task
    const results: TaskExecutionResult[] = []

    for (const task of tasksToRun) {
      const taskResult = await executeTask(task, cronSecret)
      results.push(taskResult)

      // Log result
      console.log(`[ORCHESTRATOR] ${formatTaskResult(taskResult)}`)

      if (!taskResult.success) {
        console.error(`[ORCHESTRATOR] Task ${task.id} failed:`, taskResult.error)
      }
    }

    const endTime = new Date()
    const totalDuration = endTime.getTime() - startTime.getTime()

    // Count successes and failures
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`[ORCHESTRATOR] Completed. Success: ${successful}, Failed: ${failed}, Total Duration: ${totalDuration}ms`)

    return NextResponse.json({
      success: true,
      message: 'Orchestrator run completed',
      timestamp: now.toISOString(),
      tasksEvaluated: tasksToRun.length,
      tasksExecuted: results.length,
      tasksSuccessful: successful,
      tasksFailed: failed,
      duration: totalDuration,
      results: results.map(r => ({
        taskId: r.taskId,
        taskName: r.taskName,
        success: r.success,
        duration: r.duration,
        error: r.error,
        // Include limited response data (not full response to avoid large payloads)
        summary: r.response ? extractResponseSummary(r.response) : undefined,
      })),
    })

  } catch (error: any) {
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    console.error('[ORCHESTRATOR] Fatal error:', error)

    return NextResponse.json(
      {
        error: 'Orchestrator failed',
        message: error.message || 'Internal server error',
        duration,
      },
      { status: 500 }
    )
  }
}

/**
 * Execute a single cron task by calling its endpoint
 *
 * @param task - The task to execute
 * @param cronSecret - The CRON_SECRET for authentication
 * @returns Task execution result
 */
async function executeTask(task: CronTask, cronSecret: string): Promise<TaskExecutionResult> {
  const startTime = new Date()

  try {
    console.log(`[ORCHESTRATOR] Executing task: ${task.name} (${task.id})`)

    // Build the full URL for the internal API call
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    const url = `${baseUrl}${task.endpoint}`

    // Generate HMAC signature for the request
    const timestamp = new Date().toISOString()
    const body = task.method === 'POST' || task.method === 'PUT' ? '' : null
    const signature = generateHmacSignature(
      task.method,
      task.endpoint,
      timestamp,
      body,
      cronSecret
    )

    // Make internal API call with full authentication
    const response = await fetch(url, {
      method: task.method,
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'X-Cron-Timestamp': timestamp,
        'X-Cron-Signature': signature,
        'Content-Type': 'application/json',
      },
      // Set timeout based on task's max duration
      signal: task.maxDuration ? AbortSignal.timeout(task.maxDuration * 1000) : undefined,
    })

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    // Parse response
    let responseData
    try {
      responseData = await response.json()
    } catch (e) {
      responseData = { error: 'Failed to parse response JSON' }
    }

    if (!response.ok) {
      return {
        taskId: task.id,
        taskName: task.name,
        success: false,
        startTime,
        endTime,
        duration,
        error: `HTTP ${response.status}: ${responseData.error || 'Unknown error'}`,
        response: responseData,
      }
    }

    return {
      taskId: task.id,
      taskName: task.name,
      success: true,
      startTime,
      endTime,
      duration,
      response: responseData,
    }

  } catch (error: any) {
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    return {
      taskId: task.id,
      taskName: task.name,
      success: false,
      startTime,
      endTime,
      duration,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Extract a summary from a task response to avoid large payloads
 *
 * @param response - The full response object
 * @returns A summarized version with key metrics
 */
function extractResponseSummary(response: any): any {
  if (!response) return null

  // Common fields to extract
  const summary: any = {}

  // Copy over common success indicators and counts
  const fieldsToInclude = [
    'success',
    'message',
    'total',
    'successful',
    'failed',
    'evaluated',
    'triggered',
    'processed',
    'sent',
    'skipped',
    'tenantsProcessed',
    'totalCostsIngested',
    'totalResourcesIngested',
  ]

  for (const field of fieldsToInclude) {
    if (field in response) {
      summary[field] = response[field]
    }
  }

  // Include error counts if present
  if (response.errors && Array.isArray(response.errors)) {
    summary.errorCount = response.errors.length
    // Include first few errors for context
    summary.sampleErrors = response.errors.slice(0, 3)
  }

  return summary
}
