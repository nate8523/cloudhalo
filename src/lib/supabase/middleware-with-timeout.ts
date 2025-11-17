/**
 * Enhanced Supabase middleware with session and idle timeout enforcement
 *
 * This module extends the standard Supabase middleware with comprehensive
 * session management including:
 * - Absolute session timeout (maximum session lifetime)
 * - Idle timeout (automatic logout on inactivity)
 * - Database-backed session tracking for audit trail
 * - Secure cookie-based timeout metadata
 *
 * Security features:
 * - Constant-time timestamp comparisons
 * - httpOnly secure cookies
 * - Comprehensive audit logging
 * - Defense-in-depth validation
 */

import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import {
  getSessionMetadata,
  validateSessionTimeout,
  updateSessionActivity,
  createSessionCookie,
  deleteSessionCookie,
  createSessionMetadata,
  logSessionTimeoutEvent,
  terminateDatabaseSession,
  createOrUpdateDatabaseSession,
  getTimeoutMessage,
} from '@/lib/security/session-timeout'

/**
 * Update session with timeout validation
 *
 * This function:
 * 1. Creates Supabase client and refreshes auth token
 * 2. Validates session timeout (absolute and idle)
 * 3. Updates activity timestamp if session valid
 * 4. Terminates session if timeout exceeded
 * 5. Manages database session records for audit
 *
 * @param request - Next.js request object
 * @returns Next.js response (redirect if timeout, normal response otherwise)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get authenticated user (refreshes auth token)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If no user, ensure session cookie is cleared
  if (!user) {
    deleteSessionCookie(supabaseResponse)

    // Redirect to login if accessing protected route
    if (
      !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/signup') &&
      request.nextUrl.pathname.startsWith('/dashboard')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // User is authenticated - validate session timeout
  const sessionMetadata = getSessionMetadata(request)

  // If no session metadata exists, create it (first request after login)
  if (!sessionMetadata) {
    // Get user's org_id for database session tracking
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    // Get session token from Supabase (for database tracking)
    const { data: { session } } = await supabase.auth.getSession()
    const sessionToken = session?.access_token || user.id

    // Create new session metadata
    const newMetadata = createSessionMetadata(sessionToken)
    createSessionCookie(newMetadata, supabaseResponse)

    // Create database session record
    if (userData?.org_id) {
      await createOrUpdateDatabaseSession(
        request,
        user.id,
        userData.org_id,
        sessionToken
      )
    }

    // Continue with normal flow
    return handleProtectedRoutes(request, supabaseResponse, user)
  }

  // Validate session timeout
  const validationResult = validateSessionTimeout(sessionMetadata)

  // If session has timed out, terminate and redirect to login
  if (!validationResult.valid) {
    // Log timeout event
    logSessionTimeoutEvent(
      validationResult.reason!,
      user.id,
      {
        ip: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        sessionId: sessionMetadata.sessionId,
        remainingTime: validationResult.remainingSessionTime || validationResult.remainingIdleTime,
      }
    )

    // Terminate database session
    await terminateDatabaseSession(
      sessionMetadata.sessionId,
      validationResult.reason as 'session_timeout' | 'idle_timeout'
    )

    // Sign out user
    await supabase.auth.signOut()

    // Delete session cookie
    deleteSessionCookie(supabaseResponse)

    // Redirect to login with timeout message
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('timeout', validationResult.reason!)

    const redirectResponse = NextResponse.redirect(url)
    deleteSessionCookie(redirectResponse)

    return redirectResponse
  }

  // Session is valid - update activity timestamp
  const updatedMetadata = updateSessionActivity(sessionMetadata)
  createSessionCookie(updatedMetadata, supabaseResponse)

  // Update database session activity (async, don't block request)
  // Only update database every 60 seconds to reduce load
  const timeSinceLastUpdate = Date.now() - sessionMetadata.lastActivityAt
  if (timeSinceLastUpdate > 60000) {
    // Fire and forget - don't await, but handle errors
    const rpcCall = supabase.rpc('update_session_activity', {
      p_session_token: sessionMetadata.sessionId,
    } as any)
    // @ts-ignore - Type issue with Supabase RPC promise chain
    void rpcCall.then().catch((error: any) => {
      console.error('[SESSION_TIMEOUT] Failed to update session activity:', error)
    })
  }

  // Handle protected routes and redirects
  return handleProtectedRoutes(request, supabaseResponse, user)
}

/**
 * Handle protected route access and authentication redirects
 */
function handleProtectedRoutes(
  request: NextRequest,
  response: NextResponse,
  user: any
): NextResponse {
  // Protect dashboard routes
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/signup'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}
