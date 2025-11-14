/**
 * Secure Error Handling for API Routes
 *
 * This module provides secure error handling utilities that prevent information
 * leakage while maintaining useful server-side logging for debugging.
 *
 * Security Principles:
 * 1. Never expose sensitive data in HTTP responses (user IDs, emails, stack traces)
 * 2. Log detailed error information server-side only
 * 3. Return generic, user-friendly error messages to clients
 * 4. Sanitize all error objects before sending to clients
 *
 * Usage:
 * ```typescript
 * import { logSecureError, createSecureErrorResponse } from '@/lib/security/error-handler'
 *
 * try {
 *   // ... code that may throw
 * } catch (error) {
 *   logSecureError('UserProfile', error, { userId: user.id })
 *   return createSecureErrorResponse('Failed to update profile', 500)
 * }
 * ```
 */

import { NextResponse } from 'next/server'

/**
 * Error context for server-side logging only
 */
interface ErrorContext {
  userId?: string
  orgId?: string
  tenantId?: string
  endpoint?: string
  [key: string]: string | number | boolean | undefined
}

/**
 * Safely extracts error information for server-side logging
 * NEVER include this in HTTP responses
 */
function extractErrorDetails(error: unknown): {
  message: string
  code?: string
  stack?: string
  name?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: (error as any).code,
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  if (error && typeof error === 'object') {
    return {
      message: (error as any).message || 'Unknown error',
      code: (error as any).code,
      name: (error as any).name,
    }
  }

  return { message: 'Unknown error' }
}

/**
 * Sanitizes context object to remove sensitive information
 */
function sanitizeContext(context: ErrorContext): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(context)) {
    // Skip undefined values
    if (value === undefined) continue

    // Redact email addresses
    if (key.toLowerCase().includes('email') && typeof value === 'string') {
      sanitized[key] = '[REDACTED]'
      continue
    }

    // Redact passwords, secrets, tokens
    if (
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('key')
    ) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    // Include safe values
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Logs detailed error information to server console ONLY
 * This is safe because logs are never exposed to clients
 *
 * @param component - Component/feature name for log identification
 * @param error - The error object
 * @param context - Additional context (may contain sensitive data - will be sanitized for display)
 */
export function logSecureError(
  component: string,
  error: unknown,
  context?: ErrorContext
): void {
  const errorDetails = extractErrorDetails(error)
  const sanitizedContext = context ? sanitizeContext(context) : {}

  console.error(`[${component}] Error occurred:`, {
    error: errorDetails.message,
    code: errorDetails.code,
    name: errorDetails.name,
    context: sanitizedContext,
    timestamp: new Date().toISOString(),
  })

  // Log stack trace separately for better readability
  if (errorDetails.stack) {
    console.error(`[${component}] Stack trace:`, errorDetails.stack)
  }
}

/**
 * Creates a secure error response for API routes
 * Returns generic error message to client while logging details server-side
 *
 * @param message - User-friendly error message (safe to expose)
 * @param status - HTTP status code
 * @param hint - Optional user-facing hint for resolution (safe to expose)
 * @returns NextResponse with sanitized error
 */
export function createSecureErrorResponse(
  message: string,
  status: number = 500,
  hint?: string
): NextResponse {
  const response: { error: string; hint?: string } = { error: message }

  if (hint) {
    response.hint = hint
  }

  return NextResponse.json(response, { status })
}

/**
 * Handles database errors with appropriate error messages
 * Prevents leakage of database schema, query details, or RLS policy information
 *
 * @param component - Component name for logging
 * @param error - Database error object
 * @param context - Error context for logging
 * @returns Secure error response
 */
export function handleDatabaseError(
  component: string,
  error: unknown,
  context?: ErrorContext
): NextResponse {
  logSecureError(component, error, context)

  const errorDetails = extractErrorDetails(error)
  const errorCode = errorDetails.code?.toUpperCase()

  // Handle specific PostgreSQL error codes
  if (errorCode === '23505') {
    return createSecureErrorResponse('A record with this information already exists', 409)
  }

  if (errorCode === '23503') {
    return createSecureErrorResponse('Related record not found', 404)
  }

  if (errorCode === 'PGRST116') {
    return createSecureErrorResponse('Record not found', 404)
  }

  if (errorCode === '42501' || errorDetails.message?.includes('permission denied')) {
    return createSecureErrorResponse('Access denied', 403)
  }

  // Generic database error
  return createSecureErrorResponse('A database error occurred. Please try again.', 500)
}

/**
 * Handles Azure API errors with user-friendly messages
 * Prevents leakage of credentials, tenant IDs, or internal Azure configuration
 *
 * @param component - Component name for logging
 * @param error - Azure error object
 * @param context - Error context for logging
 * @returns Secure error response
 */
export function handleAzureError(
  component: string,
  error: unknown,
  context?: ErrorContext
): NextResponse {
  logSecureError(component, error, context)

  const errorDetails = extractErrorDetails(error)
  const message = errorDetails.message || ''

  // Parse Azure-specific errors (AADSTS error codes)
  if (message.includes('AADSTS700016')) {
    return createSecureErrorResponse(
      'Invalid application (client) ID',
      401,
      'Check that your Application (client) ID is correct in Azure Portal'
    )
  }

  if (message.includes('AADSTS7000215')) {
    return createSecureErrorResponse(
      'Invalid client secret',
      401,
      'The client secret may be expired. Generate a new one in Azure Portal'
    )
  }

  if (message.includes('AADSTS90002')) {
    return createSecureErrorResponse(
      'Invalid tenant ID',
      401,
      'Check that your Directory (tenant) ID is correct in Azure Portal'
    )
  }

  if (message.includes('AADSTS50057')) {
    return createSecureErrorResponse(
      'Service principal is disabled or deleted',
      401,
      'The service principal may have been disabled in Azure AD'
    )
  }

  if (message.includes('AADSTS')) {
    return createSecureErrorResponse(
      'Azure authentication failed',
      401,
      'Please verify your credentials in Azure Portal'
    )
  }

  if (message.includes('timeout')) {
    return createSecureErrorResponse(
      'Azure API timeout',
      504,
      'The connection to Azure timed out. Please try again.'
    )
  }

  if (errorDetails.code === 'AuthorizationFailed' || message.includes('403')) {
    return createSecureErrorResponse(
      'Insufficient permissions',
      403,
      'Service principal needs Reader role at subscription level'
    )
  }

  if (errorDetails.code === 'ENOTFOUND' || errorDetails.code === 'ECONNREFUSED') {
    return createSecureErrorResponse(
      'Network error connecting to Azure',
      503,
      'Check your internet connection and firewall settings'
    )
  }

  // Generic Azure error
  return createSecureErrorResponse(
    'Failed to communicate with Azure',
    500,
    'Please verify your Azure credentials and permissions'
  )
}

/**
 * Handles authentication errors
 * Prevents user enumeration and credential leakage
 *
 * @param component - Component name for logging
 * @param error - Auth error object
 * @param context - Error context for logging (NEVER include passwords)
 * @returns Secure error response
 */
export function handleAuthError(
  component: string,
  error: unknown,
  context?: ErrorContext
): NextResponse {
  // Sanitize context to ensure no passwords are logged
  const sanitizedContext = context ? { ...context } as ErrorContext : undefined
  if (sanitizedContext) {
    delete sanitizedContext.password
    delete sanitizedContext.currentPassword
    delete sanitizedContext.newPassword
  }

  logSecureError(component, error, sanitizedContext)

  const errorDetails = extractErrorDetails(error)
  const message = errorDetails.message?.toLowerCase() || ''

  // Generic messages to prevent user enumeration
  if (message.includes('user') || message.includes('email') || message.includes('password')) {
    return createSecureErrorResponse('Invalid credentials', 401)
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return createSecureErrorResponse('Too many attempts. Please try again later.', 429)
  }

  // Generic auth error
  return createSecureErrorResponse('Authentication failed', 401)
}

/**
 * Validates that error responses don't contain sensitive information
 * Use this in development/testing to catch accidental information leakage
 *
 * @param response - The response object to validate
 * @returns true if response is safe, false otherwise
 */
export function validateErrorResponseSafety(response: any): boolean {
  const responseString = JSON.stringify(response).toLowerCase()

  const dangerousPatterns = [
    'user_id',
    'userid',
    '@', // email addresses
    'stack trace',
    'at file://',
    'at /users/',
    'at /home/',
    'at c:',
    'password',
    'secret',
    'token',
    'bearer',
    'authorization',
    'cookie',
    'session',
    '.ts:', // file paths
    '.js:',
  ]

  for (const pattern of dangerousPatterns) {
    if (responseString.includes(pattern)) {
      console.error(`[Security] Dangerous pattern detected in response: ${pattern}`)
      return false
    }
  }

  return true
}
