import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret, decryptSecret } from '@/lib/encryption/vault'

/**
 * GET /api/notifications/channels
 *
 * Retrieves notification channel configuration for the user's organization.
 * PRD Reference: Feature 6 - Multi-Channel Notifications
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient() as any

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get notification channels for the organization
    const { data: channels, error: channelsError } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('org_id', userData.org_id)
      .single()

    if (channelsError && channelsError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected for first time)
      console.error('[API] Error fetching notification channels:', channelsError)
      return NextResponse.json(
        { error: 'Failed to fetch notification channels' },
        { status: 500 }
      )
    }

    // If no channels exist yet, return defaults
    if (!channels) {
      return NextResponse.json({
        data: {
          teams_enabled: false,
          teams_webhook_url: null,
          slack_enabled: false,
          slack_webhook_url: null
        }
      })
    }

    // Decrypt webhook URLs before returning
    const decryptedChannels = {
      ...channels,
      teams_webhook_url: channels.teams_webhook_url
        ? await decryptSecret(channels.teams_webhook_url)
        : null,
      slack_webhook_url: channels.slack_webhook_url
        ? await decryptSecret(channels.slack_webhook_url)
        : null
    }

    return NextResponse.json({ data: decryptedChannels })

  } catch (error: any) {
    console.error('[API] Error in GET /api/notifications/channels:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/channels
 *
 * Updates notification channel configuration for the user's organization.
 * Webhook URLs are encrypted before storage.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient() as any

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      teams_enabled,
      teams_webhook_url,
      slack_enabled,
      slack_webhook_url
    } = body

    // Validate Teams webhook URL if enabled
    if (teams_enabled && teams_webhook_url) {
      if (!teams_webhook_url.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Teams webhook URL must start with https://' },
          { status: 400 }
        )
      }
    }

    // Validate Slack webhook URL if enabled
    if (slack_enabled && slack_webhook_url) {
      if (!slack_webhook_url.startsWith('https://hooks.slack.com/')) {
        return NextResponse.json(
          { error: 'Invalid Slack webhook URL format' },
          { status: 400 }
        )
      }
    }

    // Encrypt webhook URLs before storage
    const encryptedTeamsUrl = teams_webhook_url
      ? await encryptSecret(teams_webhook_url)
      : null
    const encryptedSlackUrl = slack_webhook_url
      ? await encryptSecret(slack_webhook_url)
      : null

    // Check if channels config already exists
    const { data: existing } = await supabase
      .from('notification_channels')
      .select('id')
      .eq('org_id', userData.org_id)
      .single()

    let result

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('notification_channels')
        .update({
          teams_enabled: teams_enabled || false,
          teams_webhook_url: encryptedTeamsUrl,
          slack_enabled: slack_enabled || false,
          slack_webhook_url: encryptedSlackUrl,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', userData.org_id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('notification_channels')
        .insert({
          org_id: userData.org_id,
          teams_enabled: teams_enabled || false,
          teams_webhook_url: encryptedTeamsUrl,
          slack_enabled: slack_enabled || false,
          slack_webhook_url: encryptedSlackUrl
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('[API] Error saving notification channels:', result.error)
      return NextResponse.json(
        { error: 'Failed to save notification channels' },
        { status: 500 }
      )
    }

    console.log(`[API] Notification channels updated for org ${userData.org_id}`)
    return NextResponse.json({
      success: true,
      message: 'Notification channels updated successfully'
    })

  } catch (error: any) {
    console.error('[API] Error in PUT /api/notifications/channels:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
