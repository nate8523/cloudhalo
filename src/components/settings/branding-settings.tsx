'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

interface Branding {
  logo_url: string | null
  primary_color: string | null
  company_name: string | null
}

export function BrandingSettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState<Branding>({
    logo_url: null,
    primary_color: '#0078D4',
    company_name: null,
  })

  useEffect(() => {
    fetchBranding()
  }, [])

  const fetchBranding = async () => {
    try {
      const response = await fetch('/api/branding')
      if (!response.ok) {
        throw new Error('Failed to fetch branding')
      }
      const data = await response.json()
      if (data.branding) {
        setFormData({
          logo_url: data.branding.logo_url || null,
          primary_color: data.branding.primary_color || '#0078D4',
          company_name: data.branding.company_name || null,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branding')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update branding')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update branding')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Branding</CardTitle>
        <CardDescription>
          Customize the appearance of your exported PDF reports with your company branding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={formData.company_name || ''}
              onChange={(e) =>
                setFormData({ ...formData, company_name: e.target.value || null })
              }
              placeholder="Your Company Name"
            />
            <p className="text-sm text-muted-foreground">
              This will appear in the header of your reports.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="primary-color"
                type="color"
                value={formData.primary_color || '#0078D4'}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={formData.primary_color || '#0078D4'}
                onChange={(e) => {
                  const value = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    setFormData({ ...formData, primary_color: value })
                  }
                }}
                placeholder="#0078D4"
                className="flex-1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Used for headers and accents in your reports.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              type="url"
              value={formData.logo_url || ''}
              onChange={(e) =>
                setFormData({ ...formData, logo_url: e.target.value || null })
              }
              placeholder="https://example.com/logo.png"
            />
            <p className="text-sm text-muted-foreground">
              Provide a publicly accessible URL to your company logo. Recommended size: 200x60px.
            </p>
          </div>

          {formData.logo_url && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <Label className="mb-2 block">Logo Preview</Label>
              <img
                src={formData.logo_url}
                alt="Logo preview"
                className="max-h-16 object-contain"
                onError={() => {
                  setError('Failed to load logo image. Please check the URL.')
                }}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>Branding settings saved successfully!</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Branding'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
