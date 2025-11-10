/**
 * Generate PowerShell script for creating Azure Service Principal
 * Based on MVP PRD requirements (FR-1.1: Service Principal Setup Script Generator)
 *
 * This script creates a service principal with read-only permissions:
 * - Reader role (read resource data)
 * - Monitoring Reader role (read metrics)
 */

export interface ServicePrincipalConfig {
  tenantName: string
  subscriptionIds?: string[]
}

export function generateServicePrincipalScript(config: ServicePrincipalConfig): string {
  const { tenantName } = config
  const appName = `CloudHalo-${tenantName.replace(/\s+/g, '-')}`

  return `# CloudHalo Azure Service Principal Setup Script
# This script creates a read-only service principal for CloudHalo monitoring

# Configuration
$AppName = "${appName}"
$RequiredRoles = @("Reader", "Monitoring Reader")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CloudHalo Service Principal Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get current Azure context
Write-Host "Step 1: Validating Azure connection..." -ForegroundColor Yellow
try {
    $context = Get-AzContext
    if (-not $context) {
        Write-Host "Not connected to Azure. Please run 'Connect-AzAccount' first." -ForegroundColor Red
        Write-Host ""
        Write-Host "Script stopped. Your Cloud Shell session remains open." -ForegroundColor Yellow
        return
    }
    Write-Host "✓ Connected to Azure" -ForegroundColor Green
    Write-Host "  Subscription: $($context.Subscription.Name)" -ForegroundColor Gray
    Write-Host "  Tenant: $($context.Tenant.Id)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "Error: Unable to get Azure context. Please ensure Azure PowerShell is installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Script stopped. Your Cloud Shell session remains open." -ForegroundColor Yellow
    return
}

# Step 2: Create Service Principal
Write-Host "Step 2: Creating service principal..." -ForegroundColor Yellow
try {
    # Create service principal with 2-year expiration
    $sp = New-AzADServicePrincipal -DisplayName $AppName -EndDate (Get-Date).AddYears(2)
    Write-Host "✓ Service principal created successfully" -ForegroundColor Green
    Write-Host "  Application ID: $($sp.AppId)" -ForegroundColor Gray
    Write-Host ""

    # Wait for service principal propagation
    Write-Host "Waiting 15 seconds for service principal to propagate..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
} catch {
    Write-Host "Error creating service principal: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Script stopped. Your Cloud Shell session remains open." -ForegroundColor Yellow
    return
}

# Step 3: Assign required roles at subscription scope
Write-Host "Step 3: Assigning read-only roles..." -ForegroundColor Yellow
$subscriptionId = $context.Subscription.Id

foreach ($role in $RequiredRoles) {
    try {
        $assignment = New-AzRoleAssignment \`
            -ApplicationId $sp.AppId \`
            -RoleDefinitionName $role \`
            -Scope "/subscriptions/$subscriptionId" \`
            -ErrorAction Stop
        Write-Host "✓ Assigned '$role' role" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*already exists*") {
            Write-Host "ℹ '$role' role already assigned" -ForegroundColor Yellow
        } else {
            Write-Host "Warning: Failed to assign '$role' role: $_" -ForegroundColor Red
        }
    }
}
Write-Host ""

# Step 4: Get client secret from service principal
Write-Host "Step 4: Retrieving credentials..." -ForegroundColor Yellow
$clientSecret = $sp.PasswordCredentials[0].SecretText
Write-Host "✓ Credentials retrieved" -ForegroundColor Green
Write-Host ""

# Step 5: Display credentials (IMPORTANT - user must copy these)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT: Copy these credentials now!" -ForegroundColor Cyan
Write-Host "They will NOT be shown again." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Application (Client) ID:" -ForegroundColor Yellow
Write-Host $sp.AppId -ForegroundColor White
Write-Host ""
Write-Host "Directory (Tenant) ID:" -ForegroundColor Yellow
Write-Host $context.Tenant.Id -ForegroundColor White
Write-Host ""
Write-Host "Client Secret (Value):" -ForegroundColor Yellow
Write-Host $clientSecret -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 6: Validate permissions
Write-Host "Step 6: Validating permissions..." -ForegroundColor Yellow
$roleAssignments = Get-AzRoleAssignment -ApplicationId $sp.AppId
$assignedRoles = $roleAssignments | Select-Object -ExpandProperty RoleDefinitionName
$allRolesAssigned = $true

foreach ($role in $RequiredRoles) {
    if ($assignedRoles -contains $role) {
        Write-Host "✓ $role permission confirmed" -ForegroundColor Green
    } else {
        Write-Host "✗ $role permission missing" -ForegroundColor Red
        $allRolesAssigned = $false
    }
}
Write-Host ""

if ($allRolesAssigned) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Setup completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Copy the credentials above" -ForegroundColor White
    Write-Host "2. Return to CloudHalo" -ForegroundColor White
    Write-Host "3. Paste the credentials in Step 3" -ForegroundColor White
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "Setup completed with warnings" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Some roles were not assigned. You may need to:" -ForegroundColor Yellow
    Write-Host "- Contact your Azure administrator" -ForegroundColor White
    Write-Host "- Verify you have sufficient permissions" -ForegroundColor White
}
`
}

/**
 * Generate a simplified version for copying credentials only
 */
export function generateCredentialTemplate(): string {
  return `Application (Client) ID: [Paste from PowerShell output]
Directory (Tenant) ID: [Paste from PowerShell output]
Client Secret: [Paste from PowerShell output]`
}
