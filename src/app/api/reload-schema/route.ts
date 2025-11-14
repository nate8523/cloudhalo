/**
 * Reload Supabase Schema Cache
 *
 * This endpoint triggers a schema cache reload in Supabase PostgREST
 * SECURITY: Requires authentication - only admins should access this
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // SECURITY FIX: Authenticate user before allowing schema reload
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get user's organization to verify they exist in the system
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!userData?.org_id) {
    return NextResponse.json(
      { error: 'User not found in organization' },
      { status: 403 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 500 })
  }

  try {
    // Call Supabase PostgREST schema cache reload endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Prefer': 'schema-reload'
      }
    })

    console.log('[Schema Reload] Response:', response.status)

    return NextResponse.json({
      success: true,
      message: 'Schema cache reload triggered',
      status: response.status
    })
  } catch (error: any) {
    console.error('[Schema Reload] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to reload schema cache'
    }, { status: 500 })
  }
}
