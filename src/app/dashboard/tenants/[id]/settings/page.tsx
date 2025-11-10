'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Loader2, Eye, EyeOff } from 'lucide-react'

interface TenantSettingsPageProps {
  params: {
    id: string
  }
}

export default function TenantSettingsPage({ params }: TenantSettingsPageProps) {
  const router = useRouter()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    azure_tenant_id: '',
    azure_app_id: '',
    azure_client_secret: '',
    credentials_expire_at: ''
  })

  useEffect(() => {
    if (params?.id) {
      setTenantId(params.id)
      loadTenantData(params.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const loadTenantData = async (id: string) => {
    try {
      const response = await fetch(`/api/tenants/${id}`)

      if (!response.ok) {
        throw new Error('Failed to load tenant')
      }

      const tenant = await response.json()

      setFormData({
        name: tenant.name || '',
        azure_tenant_id: tenant.azure_tenant_id || '',
        azure_app_id: tenant.azure_app_id || '',
        azure_client_secret: tenant.azure_client_secret || '',
        credentials_expire_at: tenant.credentials_expire_at
          ? new Date(tenant.credentials_expire_at).toISOString().split('T')[0]
          : ''
      })

      setLoading(false)
    } catch (err) {
      console.error('Error loading tenant:', err)
      setError('Failed to load tenant data')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          azure_tenant_id: formData.azure_tenant_id,
          azure_app_id: formData.azure_app_id,
          azure_client_secret: formData.azure_client_secret,
          credentials_expire_at: formData.credentials_expire_at || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update tenant')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/dashboard/tenants/${tenantId}`)
      }, 1500)
    } catch (err: any) {
      console.error('Error updating tenant:', err)
      setError(err.message || 'Failed to update tenant')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !formData.name) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tenants">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
        <Card variant="premium">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/tenants/${tenantId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Details
            </Button>
          </Link>
        </div>
      </div>

      {/* Settings Form */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-display-xs">Tenant Settings</CardTitle>
          <CardDescription>
            Update your Azure tenant connection details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-500">
                  Settings saved successfully! Redirecting...
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Tenant Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Tenant Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Acme Corp - Production"
                required
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this tenant
              </p>
            </div>

            {/* Azure Tenant ID */}
            <div className="space-y-2">
              <Label htmlFor="azure_tenant_id">
                Azure Tenant ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="azure_tenant_id"
                value={formData.azure_tenant_id}
                onChange={(e) => handleChange('azure_tenant_id', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The Azure AD Directory (Tenant) ID
              </p>
            </div>

            {/* Azure Application ID */}
            <div className="space-y-2">
              <Label htmlFor="azure_app_id">
                Application (Client) ID{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="azure_app_id"
                value={formData.azure_app_id}
                onChange={(e) => handleChange('azure_app_id', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The Service Principal Application (Client) ID
              </p>
            </div>

            {/* Azure Client Secret */}
            <div className="space-y-2">
              <Label htmlFor="azure_client_secret">
                Client Secret <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="azure_client_secret"
                  type={showSecret ? 'text' : 'password'}
                  value={formData.azure_client_secret}
                  onChange={(e) =>
                    handleChange('azure_client_secret', e.target.value)
                  }
                  placeholder="Enter client secret"
                  required
                  className="font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                The Service Principal Client Secret value
              </p>
            </div>

            {/* Credentials Expiry Date */}
            <div className="space-y-2">
              <Label htmlFor="credentials_expire_at">
                Credentials Expiry Date (Optional)
              </Label>
              <Input
                id="credentials_expire_at"
                type="date"
                value={formData.credentials_expire_at}
                onChange={(e) =>
                  handleChange('credentials_expire_at', e.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                When the service principal credentials expire (for tracking
                purposes)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving} className="min-w-[120px]">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Link href={`/dashboard/tenants/${tenantId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Warning Card */}
      <Card
        variant="glassmorphism"
        className="border-yellow-500/20 bg-yellow-500/5"
      >
        <CardHeader>
          <CardTitle className="text-sm">Important Security Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • Ensure the service principal has only <strong>Reader</strong> and{' '}
            <strong>Monitoring Reader</strong> roles (read-only access)
          </p>
          <p>
            • Never share these credentials or commit them to version control
          </p>
          <p>• Rotate credentials regularly (recommended every 90 days)</p>
          <p>
            • Changes to credentials will trigger a new connection test on the
            next sync
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
