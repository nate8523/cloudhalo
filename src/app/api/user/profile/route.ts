import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await (supabase
      .from('users') as any)
      .select('id, email, full_name, avatar_url, role, org_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in GET /api/user/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { full_name, email } = body

    // Update user profile in database
    const { data: updatedProfile, error: updateError } = await (supabase
      .from('users') as any)
      .update({
        full_name,
        email,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // If email changed, update auth email
    if (email && email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({
        email,
      })

      if (emailError) {
        console.error('Error updating email:', emailError)
        return NextResponse.json(
          { error: 'Failed to update email. Please check your email for confirmation.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(updatedProfile)
  } catch (error) {
    console.error('Error in PATCH /api/user/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
