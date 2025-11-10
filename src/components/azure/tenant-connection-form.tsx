'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

// Validation schema based on MVP PRD requirements
const credentialSchema = z.object({
  appId: z.string().uuid('Invalid Application ID format. Must be a valid UUID.'),
  tenantId: z.string().uuid('Invalid Tenant ID format. Must be a valid UUID.'),
  clientSecret: z.string().min(1, 'Client Secret is required').min(20, 'Client Secret appears to be invalid'),
})

type CredentialFormData = z.infer<typeof credentialSchema>

export interface TenantConnectionFormProps {
  tenantName: string
  onValidationComplete: (credentials: CredentialFormData & { valid: boolean }) => void
}

export function TenantConnectionForm({ tenantName, onValidationComplete }: TenantConnectionFormProps) {
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    status: 'idle' | 'success' | 'error' | 'warning'
    message?: string
    subscriptions?: Array<{ id: string; name: string }>
  }>({ status: 'idle' })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialFormData>({
    resolver: zodResolver(credentialSchema),
  })

  const onSubmit = async (data: CredentialFormData) => {
    setIsValidating(true)
    setValidationResult({ status: 'idle' })

    try {
      // Call validation API endpoint
      const response = await fetch('/api/tenants/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: data.appId,
          tenantId: data.tenantId,
          clientSecret: data.clientSecret,
        }),
      })

      const result = await response.json()

      if (response.ok && result.valid) {
        setValidationResult({
          status: 'success',
          message: `Successfully validated! Found ${result.subscriptions?.length || 0} subscription(s).`,
          subscriptions: result.subscriptions,
        })
        onValidationComplete({ ...data, valid: true })
      } else {
        setValidationResult({
          status: 'error',
          message: result.error || 'Failed to validate credentials. Please check and try again.',
        })
        onValidationComplete({ ...data, valid: false })
      }
    } catch (error) {
      setValidationResult({
        status: 'error',
        message: 'Network error. Please check your connection and try again.',
      })
      onValidationComplete({ ...data, valid: false })
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Card variant="premium">
      <CardHeader>
        <CardTitle className="text-foreground">Step 3: Enter Credentials</CardTitle>
        <CardDescription className="text-muted-foreground">
          Paste the credentials from the PowerShell output for {tenantName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Application (Client) ID */}
          <div className="space-y-2">
            <Label htmlFor="appId" className="text-foreground">
              Application (Client) ID *
            </Label>
            <Input
              id="appId"
              placeholder="00000000-0000-0000-0000-000000000000"
              {...register('appId')}
              className={errors.appId ? 'border-destructive focus-visible:ring-destructive' : ''}
              disabled={isValidating}
            />
            {errors.appId && (
              <p className="text-sm text-destructive">{errors.appId.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in PowerShell output under &quot;Application (Client) ID&quot;
            </p>
          </div>

          {/* Directory (Tenant) ID */}
          <div className="space-y-2">
            <Label htmlFor="tenantId" className="text-foreground">
              Directory (Tenant) ID *
            </Label>
            <Input
              id="tenantId"
              placeholder="00000000-0000-0000-0000-000000000000"
              {...register('tenantId')}
              className={errors.tenantId ? 'border-destructive focus-visible:ring-destructive' : ''}
              disabled={isValidating}
            />
            {errors.tenantId && (
              <p className="text-sm text-destructive">{errors.tenantId.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in PowerShell output under &quot;Directory (Tenant) ID&quot;
            </p>
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="clientSecret" className="text-foreground">
              Client Secret *
            </Label>
            <Input
              id="clientSecret"
              type="password"
              placeholder="Enter the client secret value"
              {...register('clientSecret')}
              className={errors.clientSecret ? 'border-destructive focus-visible:ring-destructive' : ''}
              disabled={isValidating}
            />
            {errors.clientSecret && (
              <p className="text-sm text-destructive">{errors.clientSecret.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in PowerShell output under &quot;Client Secret (Value)&quot;
            </p>
          </div>

          {/* Validation Result Alert */}
          {validationResult.status !== 'idle' && (
            <Alert
              className={
                validationResult.status === 'success'
                  ? 'border-success/30 dark:border-success/20 bg-success/10 dark:bg-success/5'
                  : validationResult.status === 'error'
                  ? 'border-destructive/30 dark:border-destructive/20 bg-destructive/10 dark:bg-destructive/5'
                  : 'border-warning/30 dark:border-warning/20 bg-warning/10 dark:bg-warning/5'
              }
            >
              {validationResult.status === 'success' && (
                <CheckCircle className="h-4 w-4 text-success" />
              )}
              {validationResult.status === 'error' && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {validationResult.status === 'warning' && (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
              <AlertDescription className="text-foreground/90 dark:text-foreground/80">
                {validationResult.message}
                {validationResult.subscriptions && validationResult.subscriptions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="font-semibold text-sm">Discovered subscriptions:</p>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {validationResult.subscriptions.map((sub) => (
                        <li key={sub.id}>{sub.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isValidating}
              className="flex-1"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating Credentials...
                </>
              ) : (
                'Validate & Connect'
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your credentials are encrypted and stored securely using Supabase Vault.
            CloudHalo only has read-only access to your Azure resources.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
