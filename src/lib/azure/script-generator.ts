/**
 * Azure Service Principal Setup Script Generator
 *
 * Generates PowerShell scripts for creating Azure service principals
 * with read-only permissions for CloudHalo monitoring.
 *
 * PRD Reference: Lines 268-274 (FR-1.1: Service Principal Setup Script Generator)
 */

export interface ServicePrincipalScriptOptions {
  tenantName: string
  subscriptionIds?: string[]
  applicationName?: string
}

/**
 * Generates a PowerShell script for creating an Azure service principal
 * with Reader + Monitoring Reader roles across specified subscriptions.
 *
 * @param options - Script generation options
 * @returns PowerShell script as string
 */
export function generateServicePrincipalScript(
  options: ServicePrincipalScriptOptions
): string {
  const {
    tenantName,
    subscriptionIds = [],
    applicationName = `CloudHalo-${tenantName.replace(/[^a-zA-Z0-9-]/g, '-')}`
  } = options

  const subscriptionFilter = subscriptionIds.length > 0
    ? `$subscriptions = Get-AzSubscription | Where-Object { @(${subscriptionIds.map(id => `"${id}"`).join(', ')}) -contains $_.Id }`
    : `$subscriptions = Get-AzSubscription`

  return `# CloudHalo - Azure Service Principal Setup Script
# Tenant: ${tenantName}
# Generated: ${new Date().toISOString()}
#
# This script creates a service principal with READ-ONLY permissions
# to enable CloudHalo to monitor your Azure resources and costs.
#
# IMPORTANT: This script grants Reader + Monitoring Reader roles ONLY.
# CloudHalo CANNOT make changes to your Azure resources.

# ============================================
# Prerequisites Check
# ============================================
Write-Host "CloudHalo Service Principal Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if Az module is installed
if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
    Write-Host "ERROR: Azure PowerShell module not found!" -ForegroundColor Red
    Write-Host "Please install it first: Install-Module -Name Az -AllowClobber -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}

# Check if logged in to Azure
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$context = Get-AzContext -ErrorAction SilentlyContinue

if (-not $context) {
    Write-Host "Not logged in to Azure. Initiating login..." -ForegroundColor Yellow
    Connect-AzAccount
    $context = Get-AzContext
}

Write-Host "Logged in as: $($context.Account.Id)" -ForegroundColor Green
Write-Host "Tenant: $($context.Tenant.Id)" -ForegroundColor Green
Write-Host ""

# ============================================
# Create Service Principal
# ============================================
Write-Host "Creating service principal..." -ForegroundColor Yellow

$appName = "${applicationName}"
$startDate = Get-Date
$endDate = $startDate.AddYears(1)

# Create Azure AD Application
try {
    $app = New-AzADApplication -DisplayName $appName -ErrorAction Stop
    Write-Host "✓ Application created: $($app.DisplayName)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create application" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Create Service Principal
try {
    $sp = New-AzADServicePrincipal -ApplicationId $app.AppId -ErrorAction Stop
    Write-Host "✓ Service Principal created" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create service principal" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Create credential (password)
try {
    $credential = New-AzADAppCredential -ApplicationId $app.AppId -EndDate $endDate -ErrorAction Stop
    Write-Host "✓ Credentials generated (valid for 1 year)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create credentials" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# Assign Reader Role to Subscriptions
# ============================================
Write-Host "Assigning Reader role to subscriptions..." -ForegroundColor Yellow

# Get subscriptions
${subscriptionFilter}

if ($subscriptions.Count -eq 0) {
    Write-Host "ERROR: No subscriptions found or accessible" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($subscriptions.Count) subscription(s)" -ForegroundColor Cyan

foreach ($sub in $subscriptions) {
    Write-Host "  - $($sub.Name) ($($sub.Id))" -ForegroundColor Gray

    # Set subscription context
    Set-AzContext -SubscriptionId $sub.Id | Out-Null

    # Assign Reader role
    try {
        New-AzRoleAssignment -ObjectId $sp.Id \`
            -RoleDefinitionName "Reader" \`
            -Scope "/subscriptions/$($sub.Id)" \`
            -ErrorAction Stop | Out-Null
        Write-Host "    ✓ Reader role assigned" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*already exists*") {
            Write-Host "    ✓ Reader role already assigned" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Failed to assign Reader role: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Assign Monitoring Reader role
    try {
        New-AzRoleAssignment -ObjectId $sp.Id \`
            -RoleDefinitionName "Monitoring Reader" \`
            -Scope "/subscriptions/$($sub.Id)" \`
            -ErrorAction Stop | Out-Null
        Write-Host "    ✓ Monitoring Reader role assigned" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*already exists*") {
            Write-Host "    ✓ Monitoring Reader role already assigned" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Failed to assign Monitoring Reader role: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# ============================================
# Wait for propagation
# ============================================
Write-Host "Waiting 30 seconds for role assignments to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# ============================================
# Output Credentials
# ============================================
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  COPY THESE CREDENTIALS TO CLOUDHALO" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Application (Client) ID:" -ForegroundColor Yellow
Write-Host $app.AppId -ForegroundColor White
Write-Host ""
Write-Host "Directory (Tenant) ID:" -ForegroundColor Yellow
Write-Host $context.Tenant.Id -ForegroundColor White
Write-Host ""
Write-Host "Client Secret:" -ForegroundColor Yellow
Write-Host $credential.SecretText -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT NOTES:" -ForegroundColor Red
Write-Host "1. Save the Client Secret NOW - it cannot be retrieved later" -ForegroundColor Yellow
Write-Host "2. Credentials expire on: $($endDate.ToString('yyyy-MM-dd'))" -ForegroundColor Yellow
Write-Host "3. These credentials have READ-ONLY access" -ForegroundColor Yellow
Write-Host "4. Copy all three values to CloudHalo to complete setup" -ForegroundColor Yellow
Write-Host ""
Write-Host "Setup complete! ✓" -ForegroundColor Green
Write-Host ""

# ============================================
# Create JSON output (optional)
# ============================================
$output = @{
    applicationId = $app.AppId
    tenantId = $context.Tenant.Id
    clientSecret = $credential.SecretText
    displayName = $app.DisplayName
    expiresOn = $endDate.ToString('yyyy-MM-dd')
    subscriptionsConfigured = $subscriptions.Count
}

$jsonOutput = $output | ConvertTo-Json
$outputFile = "cloudhalo-credentials-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

Write-Host "Saving credentials to: $outputFile" -ForegroundColor Yellow
$jsonOutput | Out-File -FilePath $outputFile
Write-Host "✓ Credentials saved (remember to delete this file after copying to CloudHalo)" -ForegroundColor Green
Write-Host ""
`
}

/**
 * Generates a simpler script for Cloud Shell (no Az module check needed)
 */
export function generateCloudShellScript(options: ServicePrincipalScriptOptions): string {
  const {
    tenantName,
    applicationName = `CloudHalo-${tenantName.replace(/[^a-zA-Z0-9-]/g, '-')}`
  } = options

  return `# CloudHalo Service Principal Setup (Azure Cloud Shell)
# Tenant: ${tenantName}

$appName = "${applicationName}"
$endDate = (Get-Date).AddYears(1)

# Create Application and Service Principal
$app = New-AzADApplication -DisplayName $appName
$sp = New-AzADServicePrincipal -ApplicationId $app.AppId
$credential = New-AzADAppCredential -ApplicationId $app.AppId -EndDate $endDate

# Assign roles to all subscriptions
Get-AzSubscription | ForEach-Object {
    Set-AzContext -SubscriptionId $_.Id | Out-Null
    New-AzRoleAssignment -ObjectId $sp.Id -RoleDefinitionName "Reader" -Scope "/subscriptions/$($_.Id)" -ErrorAction SilentlyContinue | Out-Null
    New-AzRoleAssignment -ObjectId $sp.Id -RoleDefinitionName "Monitoring Reader" -Scope "/subscriptions/$($_.Id)" -ErrorAction SilentlyContinue | Out-Null
}

# Wait for propagation
Start-Sleep -Seconds 30

# Display credentials
Write-Host "Application ID: $($app.AppId)"
Write-Host "Tenant ID: $((Get-AzContext).Tenant.Id)"
Write-Host "Client Secret: $($credential.SecretText)"
`
}

/**
 * Formats the script for display in the UI with syntax highlighting hints
 */
export function formatScriptForDisplay(script: string): { lines: string[], highlights: string[] } {
  const lines = script.split('\n')
  const highlights = lines.map(line => {
    if (line.trim().startsWith('#')) return 'comment'
    if (line.includes('Write-Host') && line.includes('-ForegroundColor')) return 'output'
    if (line.includes('New-Az') || line.includes('Get-Az') || line.includes('Set-Az')) return 'command'
    if (line.includes('$')) return 'variable'
    return 'normal'
  })

  return { lines, highlights }
}

/**
 * Validates tenant name for script generation
 */
export function validateTenantName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Tenant name is required' }
  }

  if (name.length > 100) {
    return { valid: false, error: 'Tenant name must be less than 100 characters' }
  }

  return { valid: true }
}

/**
 * Parses PowerShell script output to extract credentials
 * (For testing purposes)
 */
export function parseScriptOutput(output: string): {
  applicationId?: string
  tenantId?: string
  clientSecret?: string
} {
  const result: any = {}

  const appIdMatch = output.match(/Application \(Client\) ID:\s*\n\s*([a-f0-9-]+)/i)
  if (appIdMatch) result.applicationId = appIdMatch[1]

  const tenantIdMatch = output.match(/Directory \(Tenant\) ID:\s*\n\s*([a-f0-9-]+)/i)
  if (tenantIdMatch) result.tenantId = tenantIdMatch[1]

  const secretMatch = output.match(/Client Secret:\s*\n\s*([^\s]+)/i)
  if (secretMatch) result.clientSecret = secretMatch[1]

  return result
}
