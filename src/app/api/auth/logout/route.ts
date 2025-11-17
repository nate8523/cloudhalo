/**
 * Logout API endpoint
 *
 * Handles user logout with proper session termination:
 * 1. Authenticates the user
 * 2. Terminates session in database
 * 3. Signs out from Supabase
 * 4. Clears session cookies
 * 5. Logs logout event for audit trail
 *
 * Security:
 * - Requires authentication
 * - Rate limited (5 attempts per 15 minutes)
 * - Comprehensive audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, rateLimiters } from '@/lib/rate-limit'
import {
  getSessionMetadata,
  terminateDatabaseSession,
  logSessionTimeoutEvent,
} from '@/lib/security/session-timeout'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, rateLimiters.auth, 'ip')
    if (rateLimitResult) return rateLimitResult

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get session metadata
    const sessionMetadata = getSessionMetadata(request)

    // Terminate database session if exists
    if (sessionMetadata) {
      await terminateDatabaseSession(sessionMetadata.sessionId, 'manual_logout')

      // Log logout event
      logSessionTimeoutEvent('manual_logout', user.id, {
        ip: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        sessionId: sessionMetadata.sessionId,
      })
    }

    // Sign out from Supabase
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      console.error('[AUTH] Error signing out:', signOutError)
      return NextResponse.json(
        { error: 'Failed to sign out' },
        { status: 500 }
      )
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    console.error('[AUTH] Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}
