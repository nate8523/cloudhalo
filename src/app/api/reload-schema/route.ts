/**
 * Reload Supabase Schema Cache
 *
 * This endpoint triggers a schema cache reload in Supabase PostgREST
 */

import { NextResponse } from 'next/server'

export async function POST() {
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
      error: error.message
    }, { status: 500 })
  }
}
