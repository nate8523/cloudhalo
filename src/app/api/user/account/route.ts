import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export async function DELETE() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id, avatar_url')
      .eq('id', user.id)
      .single<Pick<Database['public']['Tables']['users']['Row'], 'org_id' | 'avatar_url'>>()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete avatar from storage if exists
    if (userData.avatar_url) {
      try {
        const url = new URL(userData.avatar_url)
        const pathParts = url.pathname.split('/')
        const filePath = pathParts.slice(pathParts.indexOf('avatars')).join('/')
        await supabase.storage.from('user-avatars').remove([filePath])
      } catch (error) {
        console.error('Error deleting avatar:', error)
        // Continue with account deletion even if avatar deletion fails
      }
    }

    // Delete related data (cascading deletes should handle most of this via RLS)
    // Note: Supabase RLS policies and foreign key constraints should handle cascading deletes
    // For azure_tenants, cost_snapshots, alert_rules - these should be org-scoped

    // Delete user from users table
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)

    if (deleteUserError) {
      console.error('Error deleting user:', deleteUserError)
      return NextResponse.json(
        { error: 'Failed to delete user data' },
        { status: 500 }
      )
    }

    // Delete from Supabase Auth
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
      user.id
    )

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      // User data already deleted, so we'll return success anyway
    }

    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/user/account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
