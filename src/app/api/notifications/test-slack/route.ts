import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testSlackWebhook } from '@/lib/notifications/slack'

/**
 * POST /api/notifications/test-slack
 *
 * Tests a Slack webhook URL by sending a test notification.
 * PRD Reference: Feature 6 (FR-6.2) - Slack Integration
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
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json(
        { error: 'Invalid Slack webhook URL format' },
        { status: 400 }
      )
    }

    // Test the webhook
    console.log(`[API] Testing Slack webhook for user ${user.id}`)
    const result = await testSlackWebhook(webhookUrl)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent successfully to Slack'
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
    console.error('[API] Error testing Slack webhook:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}
