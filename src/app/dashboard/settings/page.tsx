'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { User, Mail, Lock, Trash2, Upload, Camera, Loader2, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NotificationChannelsForm } from '@/components/settings/notification-channels-form'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  org_id: string
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [accountDeleting, setAccountDeleting] = useState(false)

  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [avatarError, setAvatarError] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (!response.ok) {
        throw new Error('Failed to load profile')
      }

      const data: UserProfile = await response.json()
      setProfile(data)
      setName(data.full_name || '')
      setEmail(data.email || '')
      setAvatarUrl(data.avatar_url || '')
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfileError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          email: email,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      setProfileSuccess('Profile updated successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setProfileError(error.message || 'Failed to update profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    setPasswordSaving(true)

    try {
      const response = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to change password')
      }

      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (error: any) {
      console.error('Error changing password:', error)
      setPasswordError(error.message || 'Failed to change password')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setAccountDeleting(true)

    try {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }

      // Sign out and redirect to login
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error: any) {
      console.error('Error deleting account:', error)
      alert(error.message || 'Failed to delete account')
    } finally {
      setAccountDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('File size must be less than 2MB')
      return
    }

    setAvatarUploading(true)
    setAvatarError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload avatar')
      }

      const data = await response.json()
      setAvatarUrl(data.avatar_url)

      // Update profile state
      if (profile) {
        setProfile({ ...profile, avatar_url: data.avatar_url })
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      setAvatarError(error.message || 'Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true)
    setAvatarError('')

    try {
      const response = await fetch('/api/user/avatar', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove avatar')
      }

      setAvatarUrl('')

      // Update profile state
      if (profile) {
        setProfile({ ...profile, avatar_url: null })
      }
    } catch (error: any) {
      console.error('Error removing avatar:', error)
      setAvatarError(error.message || 'Failed to remove avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-display-sm font-bold text-foreground">Settings</h1>
        <p className="text-body text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-8">
          {/* Profile Section */}
          <Card variant="premium" className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-display-xs text-foreground">Profile</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            Update your personal information and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            {/* Success/Error Messages */}
            {profileSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-500">
                  {profileSuccess}
                </p>
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{profileError}</p>
              </div>
            )}

            {/* Avatar Upload */}
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-border shadow-lg">
                  <AvatarImage src={avatarUrl} alt={name} />
                  <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-primary/20 to-accent/20">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                {!avatarUploading && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </label>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={avatarUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload photo
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-body-sm text-muted-foreground">
                  JPG, PNG or GIF. Max 2MB.
                </p>
                {avatarError && (
                  <p className="text-body-sm text-destructive">{avatarError}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="max-w-md"
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="max-w-md"
              />
              <p className="text-body-sm text-muted-foreground">
                This is the email you use to sign in
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName(profile?.full_name || '')
                  setEmail(profile?.email || '')
                  setProfileError('')
                  setProfileSuccess('')
                }}
                disabled={profileSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card variant="premium" className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-body-lg text-foreground">Change Password</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Success/Error Messages */}
            {passwordSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-500">
                  {passwordSuccess}
                </p>
              </div>
            )}
            {passwordError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{passwordError}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Current Password
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="max-w-md"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="max-w-md"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="max-w-md"
                required
              />
            </div>

            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card
        variant="premium"
        className="border-2 border-red-500 dark:border-red-600 overflow-hidden"
      >
        <CardHeader>
          <CardTitle className="text-body-lg text-foreground">Danger Zone</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            Irreversible actions that will permanently affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Delete Account</h3>
              <p className="text-body-sm text-muted-foreground">
                Once you delete your account, there is no going back. This will permanently delete all your data,
                including all connected Azure tenants, cost data, and alerts.
              </p>
            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                  disabled={accountDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription className="space-y-3 pt-2">
                    <p>
                      This action cannot be undone. This will permanently delete your account and remove
                      all data from our servers.
                    </p>
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                      <p className="text-sm font-semibold text-destructive">
                        All of the following will be permanently deleted:
                      </p>
                      <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>All connected Azure tenants</li>
                        <li>Historical cost data and analytics</li>
                        <li>All configured alerts and notifications</li>
                        <li>Profile information and settings</li>
                      </ul>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={accountDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={accountDeleting}
                  >
                    {accountDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, delete my account'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card variant="premium" className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-display-xs text-foreground">Notification Channels</CardTitle>
              <CardDescription className="text-body-sm text-muted-foreground">
                Configure where you receive cost alerts. Email notifications are always enabled.
                Add Microsoft Teams or Slack to receive alerts in your team channels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationChannelsForm />
            </CardContent>
          </Card>

          <Card variant="premium" className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-body-lg text-foreground">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-body-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    When creating alert rules, you can choose which channels receive notifications
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    Test each webhook before saving to ensure notifications are working
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    Webhook URLs are encrypted and stored securely in the database
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    Notifications include cost details, top resources, and direct links to CloudHalo
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
