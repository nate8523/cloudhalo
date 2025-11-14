import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimiters, applyRateLimit } from '@/lib/rate-limit'

// Password validation constants
const PASSWORD_MIN_LENGTH = 12
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    }
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)',
    }
  }

  // Check against common passwords
  const commonPasswords = [
    'password', 'Password123!', 'Admin123!', 'Welcome123!',
    'Passw0rd!', 'P@ssw0rd', 'P@ssword123', 'Welcome1!',
  ]
  if (commonPasswords.includes(password)) {
    return { valid: false, error: 'Password is too common. Please choose a stronger password.' }
  }

  return { valid: true }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting (3 attempts per 15 minutes per user)
    const rateLimitResult = await applyRateLimit(
      request,
      rateLimiters.password,
      'user',
      user.id
    )
    if (rateLimitResult) return rateLimitResult

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      )
    }

    // Add constant-time delay to prevent timing attacks
    const startTime = Date.now()

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    // Ensure minimum response time of 200ms to prevent timing analysis
    const elapsedTime = Date.now() - startTime
    const remainingDelay = Math.max(0, 200 - elapsedTime)
    await new Promise(resolve => setTimeout(resolve, remainingDelay))

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Error in PATCH /api/user/password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
