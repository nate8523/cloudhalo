/**
 * Application-level encryption for Azure credentials
 * Uses Node.js crypto module with AES-256-GCM
 *
 * This is a simpler alternative to Supabase Vault that works on any plan
 */

import crypto from 'crypto'

// Get encryption key from environment variable
// IMPORTANT: This must be a 32-byte (256-bit) hex string
const ENCRYPTION_KEY = process.env.AZURE_CREDENTIAL_ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  console.warn('WARNING: AZURE_CREDENTIAL_ENCRYPTION_KEY not set. Credentials will not be encrypted!')
}

/**
 * Encrypts a plaintext secret using AES-256-GCM
 * Returns: base64-encoded encrypted data in format: iv:authTag:ciphertext
 */
export function encryptSecret(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured')
  }

  // Convert hex key to buffer
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')

  // Generate random IV (initialization vector)
  const iv = crypto.randomBytes(16)

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Get auth tag for authenticated encryption
  const authTag = cipher.getAuthTag()

  // Combine: iv:authTag:encrypted (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypts an encrypted secret
 * Input format: iv:authTag:ciphertext (all base64)
 */
export function decryptSecret(encryptedData: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured')
  }

  // Convert hex key to buffer
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')

  // Split encrypted data
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivBase64, authTagBase64, encrypted] = parts

  // Convert from base64
  const iv = Buffer.from(ivBase64, 'base64')
  const authTag = Buffer.from(authTagBase64, 'base64')

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  // Decrypt
  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generates a new random encryption key (256-bit)
 * Run this once and store in AZURE_CREDENTIAL_ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Helper to encrypt Azure client secret
 */
export function encryptAzureClientSecret(clientSecret: string): string {
  return encryptSecret(clientSecret)
}

/**
 * Helper to decrypt Azure client secret
 */
export function decryptAzureClientSecret(encryptedSecret: string): string {
  return decryptSecret(encryptedSecret)
}

/**
 * Check if a string appears to be encrypted (has the format iv:authTag:ciphertext)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every(part => {
    try {
      Buffer.from(part, 'base64')
      return true
    } catch {
      return false
    }
  })
}
