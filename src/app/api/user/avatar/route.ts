import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 2MB' },
        { status: 400 }
      )
    }

    // Create a unique file name
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload avatar' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath)

    const avatarUrl = urlData.publicUrl

    // Update user profile with avatar URL
    const { error: updateError } = await (supabase
      .from('users') as any)
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating avatar URL:', updateError)
      return NextResponse.json(
        { error: 'Failed to update avatar URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ avatar_url: avatarUrl })
  } catch (error) {
    console.error('Error in POST /api/user/avatar:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current avatar URL
    const { data: profile, error: profileError } = await (supabase
      .from('users') as any)
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    if (profile?.avatar_url) {
      // Extract file path from URL
      const url = new URL(profile.avatar_url)
      const pathParts = url.pathname.split('/')
      const filePath = pathParts.slice(pathParts.indexOf('avatars')).join('/')

      // Delete from storage
      await supabase.storage.from('user-avatars').remove([filePath])
    }

    // Remove avatar URL from user profile
    const { error: updateError } = await (supabase
      .from('users') as any)
      .update({ avatar_url: null })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error removing avatar URL:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove avatar' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Avatar removed successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/user/avatar:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
