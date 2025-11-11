import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Manual cost sync endpoint
 * Called by "Sync Now" buttons in the UI
 * No authentication required (internal API route)
 */

export async function POST() {
  console.log('[SYNC] Manual cost sync triggered')

  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to the cron endpoint logic
    // (We'll import the logic as a shared function)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-me'

    const response = await fetch(`${baseUrl}/api/cron/poll-costs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    })

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[SYNC] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
