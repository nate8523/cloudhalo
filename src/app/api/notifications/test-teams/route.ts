import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testTeamsWebhook } from '@/lib/notifications/teams'
import { logSecureError, createSecureErrorResponse } from '@/lib/security/error-handler'

/**
 * POST /api/notifications/test-teams
 *
 * Tests a Microsoft Teams webhook URL by sending a test notification.
 * PRD Reference: Feature 6 (FR-6.1) - Microsoft Teams Integration
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { webhookUrl } = body

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      )
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Webhook URL must start with https://' },
        { status: 400 }
      )
    }

    // Test the webhook
    console.log(`[API] Testing Teams webhook for user ${user.id}`)
    const result = await testTeamsWebhook(webhookUrl)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent successfully to Teams'
      })
    } else {
      return NextResponse.json(
        {
          error: 'Failed to send test notification',
          details: result.error
        },
        { status: 400 }
      )
    }

  } catch (error: any) {
    logSecureError('TestTeamsWebhook', error, {
      endpoint: 'POST /api/notifications/test-teams'
    })
    return createSecureErrorResponse('Internal server error', 500)
  }
}
