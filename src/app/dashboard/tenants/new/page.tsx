'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScriptDisplay } from '@/components/azure/script-display'
import { TenantConnectionForm } from '@/components/azure/tenant-connection-form'
import { generateServicePrincipalScript } from '@/lib/azure/generate-script'
import { Info, Loader2, CheckCircle2 } from 'lucide-react'

type ConnectionStep = 'name' | 'script' | 'credentials' | 'connecting'

export default function NewTenantPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<ConnectionStep>('name')
  const [tenantName, setTenantName] = useState('')
  const [generatedScript, setGeneratedScript] = useState('')
  const [credentials, setCredentials] = useState<{
    appId: string
    tenantId: string
    clientSecret: string
    valid: boolean
  } | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tenantName.trim().length < 2) {
      return
    }

    // Generate PowerShell script for this tenant
    const script = generateServicePrincipalScript({ tenantName })
    setGeneratedScript(script)
    setCurrentStep('script')
  }

  const handleScriptContinue = () => {
    setCurrentStep('credentials')
  }

  const handleValidationComplete = async (validatedCredentials: {
    appId: string
    tenantId: string
    clientSecret: string
    valid: boolean
  }) => {
    setCredentials(validatedCredentials)

    if (validatedCredentials.valid) {
      // Automatically proceed to connection
      await handleFinalConnection(validatedCredentials)
    }
  }

  const handleFinalConnection = async (creds: {
    appId: string
    tenantId: string
    clientSecret: string
  }) => {
    setIsConnecting(true)
    setConnectionError(null)
    setCurrentStep('connecting')

    try {
      const response = await fetch('/api/tenants/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenantName,
          azureAppId: creds.appId,
          azureTenantId: creds.tenantId,
          azureClientSecret: creds.clientSecret,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Success - redirect to tenants page
        router.push('/dashboard/tenants?success=true')
      } else {
        setConnectionError(result.error || 'Failed to connect tenant')
        setCurrentStep('credentials')
      }
    } catch (error) {
      setConnectionError('Network error. Please try again.')
      setCurrentStep('credentials')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-display-sm font-bold text-foreground">Connect Azure Tenant</h1>
        <p className="text-body text-muted-foreground">
          Follow these steps to securely connect your Azure tenant to CloudHalo
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border dark:border-border/40">
        <div className="flex items-center space-x-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 'name'
                ? 'bg-primary text-primary-foreground'
                : 'bg-success text-success-foreground'
            }`}
          >
            {currentStep !== 'name' ? '✓' : '1'}
          </div>
          <span className="text-sm font-medium text-foreground">Name Tenant</span>
        </div>
        <div className="h-px flex-1 mx-2 bg-border dark:bg-border/40"></div>
        <div className="flex items-center space-x-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 'script' || currentStep === 'credentials' || currentStep === 'connecting'
                ? currentStep === 'script'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-success text-success-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep === 'credentials' || currentStep === 'connecting' ? '✓' : '2'}
          </div>
          <span className="text-sm font-medium text-foreground">Run Script</span>
        </div>
        <div className="h-px flex-1 mx-2 bg-border dark:bg-border/40"></div>
        <div className="flex items-center space-x-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 'credentials' || currentStep === 'connecting'
                ? currentStep === 'connecting'
                  ? 'bg-success text-success-foreground'
                  : 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep === 'connecting' ? '✓' : '3'}
          </div>
          <span className="text-sm font-medium text-foreground">Connect</span>
        </div>
      </div>

      {/* Time Estimate Alert */}
      <Alert className="border-info/30 dark:border-info/20 bg-info/10 dark:bg-info/5">
        <Info className="h-4 w-4 text-info dark:text-info" />
        <AlertDescription className="text-foreground/90 dark:text-foreground/80">
          This process takes approximately 5 minutes. You&apos;ll need Azure subscription owner or contributor access.
        </AlertDescription>
      </Alert>

      {/* Step 1: Tenant Name */}
      {currentStep === 'name' && (
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="text-foreground">Step 1: Tenant Information</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter a friendly name for this Azure tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenantName" className="text-foreground">
                  Tenant Name *
                </Label>
                <Input
                  id="tenantName"
                  placeholder="e.g., Acme Corp - Production"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="text-base"
                  autoFocus
                  required
                  minLength={2}
                />
                <p className="text-xs text-muted-foreground">
                  This name helps you identify the tenant in your dashboard. You can change it later.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={tenantName.trim().length < 2}>
                Generate Setup Script →
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: PowerShell Script */}
      {currentStep === 'script' && generatedScript && (
        <>
          <ScriptDisplay
            script={generatedScript}
            title="Step 2: Generate Service Principal Script"
            description="Copy and run this PowerShell script in Azure Cloud Shell"
            fileName={`cloudhalo-${tenantName.replace(/\s+/g, '-').toLowerCase()}.ps1`}
          />

          <div className="flex justify-end">
            <Button onClick={handleScriptContinue} size="lg">
              I&apos;ve Run the Script - Continue →
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Credentials Entry */}
      {currentStep === 'credentials' && (
        <>
          {connectionError && (
            <Alert className="border-destructive/30 dark:border-destructive/20 bg-destructive/10 dark:bg-destructive/5">
              <AlertDescription className="text-destructive">
                <strong>Connection Failed:</strong> {connectionError}
              </AlertDescription>
            </Alert>
          )}

          <TenantConnectionForm
            tenantName={tenantName}
            onValidationComplete={handleValidationComplete}
          />
        </>
      )}

      {/* Step 4: Connecting State */}
      {currentStep === 'connecting' && (
        <Card variant="premium" className="border-primary/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-foreground">Connecting to Azure...</CardTitle>
            <CardDescription className="text-muted-foreground">
              Validating credentials and discovering subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Authenticating with Azure
              </p>
              <p className="flex items-center justify-center gap-2 opacity-50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Discovering subscriptions
              </p>
              <p className="flex items-center justify-center gap-2 opacity-50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating permissions
              </p>
              <p className="flex items-center justify-center gap-2 opacity-50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Storing credentials securely
              </p>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              This may take up to 30 seconds...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Back Button */}
      {currentStep !== 'connecting' && (
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentStep === 'script') {
                setCurrentStep('name')
              } else if (currentStep === 'credentials') {
                setCurrentStep('script')
              }
            }}
          >
            ← Back
          </Button>
        </div>
      )}
    </div>
  )
}
