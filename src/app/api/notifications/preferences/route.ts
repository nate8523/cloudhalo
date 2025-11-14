import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row']
type NotificationPreferencesInsert = Database['public']['Tables']['notification_preferences']['Insert']
type NotificationPreferencesUpdate = Database['public']['Tables']['notification_preferences']['Update']

/**
 * GET /api/notifications/preferences
 * Fetch notification preferences for the user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

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
      .single<{ org_id: string }>()

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch notification preferences
    const { data: preferences, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('org_id', userData.org_id)
      .single()

    // If no preferences exist yet, return defaults
    if (prefsError || !preferences) {
      const defaultPreferences = {
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '07:00:00',
        quiet_hours_timezone: 'UTC',
        digest_mode_enabled: false,
        digest_frequency: 'daily' as const,
        digest_delivery_time: '08:00:00',
        digest_delivery_day: null,
        digest_delivery_timezone: 'UTC',
        critical_alerts_bypass_quiet_hours: true,
        high_alerts_bypass_quiet_hours: false,
        include_resolved_alerts: false,
        include_recommendations: true,
        include_cost_summary: true,
      }

      return NextResponse.json({ data: defaultPreferences })
    }

    return NextResponse.json({ data: preferences })

  } catch (error: any) {
    console.error('Get notification preferences error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/preferences
 * Create or update notification preferences for the user's organization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

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
      .single<{ org_id: string }>()

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()

    // Validate required fields
    const validDigestFrequencies = ['daily', 'weekly', 'immediate']
    if (body.digest_frequency && !validDigestFrequencies.includes(body.digest_frequency)) {
      return NextResponse.json(
        { error: 'Invalid digest_frequency. Must be daily, weekly, or immediate' },
        { status: 400 }
      )
    }

    // Validate time formats (HH:MM:SS)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
    if (body.quiet_hours_start && !timeRegex.test(body.quiet_hours_start)) {
      return NextResponse.json(
        { error: 'Invalid quiet_hours_start format. Use HH:MM:SS' },
        { status: 400 }
      )
    }
    if (body.quiet_hours_end && !timeRegex.test(body.quiet_hours_end)) {
      return NextResponse.json(
        { error: 'Invalid quiet_hours_end format. Use HH:MM:SS' },
        { status: 400 }
      )
    }
    if (body.digest_delivery_time && !timeRegex.test(body.digest_delivery_time)) {
      return NextResponse.json(
        { error: 'Invalid digest_delivery_time format. Use HH:MM:SS' },
        { status: 400 }
      )
    }

    // Validate digest_delivery_day (0-6 for Sunday-Saturday)
    if (body.digest_delivery_day !== null && body.digest_delivery_day !== undefined) {
      if (body.digest_delivery_day < 0 || body.digest_delivery_day > 6) {
        return NextResponse.json(
          { error: 'Invalid digest_delivery_day. Must be 0-6 (0=Sunday, 6=Saturday)' },
          { status: 400 }
        )
      }
    }

    // Check if preferences already exist
    const { data: existingPrefs } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('org_id', userData.org_id)
      .single()

    let result

    if (existingPrefs) {
      // Update existing preferences
      const updateData: NotificationPreferencesUpdate = {
        quiet_hours_enabled: body.quiet_hours_enabled,
        quiet_hours_start: body.quiet_hours_start,
        quiet_hours_end: body.quiet_hours_end,
        quiet_hours_timezone: body.quiet_hours_timezone,
        digest_mode_enabled: body.digest_mode_enabled,
        digest_frequency: body.digest_frequency,
        digest_delivery_time: body.digest_delivery_time,
        digest_delivery_day: body.digest_delivery_day,
        digest_delivery_timezone: body.digest_delivery_timezone,
        critical_alerts_bypass_quiet_hours: body.critical_alerts_bypass_quiet_hours,
        high_alerts_bypass_quiet_hours: body.high_alerts_bypass_quiet_hours,
        include_resolved_alerts: body.include_resolved_alerts,
        include_recommendations: body.include_recommendations,
        include_cost_summary: body.include_cost_summary,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .update(updateData)
        .eq('org_id', userData.org_id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Insert new preferences
      const insertData: NotificationPreferencesInsert = {
        org_id: userData.org_id,
        quiet_hours_enabled: body.quiet_hours_enabled,
        quiet_hours_start: body.quiet_hours_start,
        quiet_hours_end: body.quiet_hours_end,
        quiet_hours_timezone: body.quiet_hours_timezone,
        digest_mode_enabled: body.digest_mode_enabled,
        digest_frequency: body.digest_frequency,
        digest_delivery_time: body.digest_delivery_time,
        digest_delivery_day: body.digest_delivery_day,
        digest_delivery_timezone: body.digest_delivery_timezone,
        critical_alerts_bypass_quiet_hours: body.critical_alerts_bypass_quiet_hours,
        high_alerts_bypass_quiet_hours: body.high_alerts_bypass_quiet_hours,
        include_resolved_alerts: body.include_resolved_alerts,
        include_recommendations: body.include_recommendations,
        include_cost_summary: body.include_cost_summary,
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Notification preferences saved successfully'
    })

  } catch (error: any) {
    console.error('Save notification preferences error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/preferences
 * Partially update notification preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

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
      .single<{ org_id: string }>()

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()

    // Build update object with only provided fields
    const updateData: NotificationPreferencesUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Add only fields that are present in the request
    const allowedFields = [
      'quiet_hours_enabled',
      'quiet_hours_start',
      'quiet_hours_end',
      'quiet_hours_timezone',
      'digest_mode_enabled',
      'digest_frequency',
      'digest_delivery_time',
      'digest_delivery_day',
      'digest_delivery_timezone',
      'critical_alerts_bypass_quiet_hours',
      'high_alerts_bypass_quiet_hours',
      'include_resolved_alerts',
      'include_recommendations',
      'include_cost_summary',
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field as keyof NotificationPreferencesUpdate] = body[field]
      }
    }

    // Update preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updateData)
      .eq('org_id', userData.org_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Notification preferences updated successfully'
    })

  } catch (error: any) {
    console.error('Update notification preferences error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
