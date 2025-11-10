/**
 * Application-Level Encryption Utilities
 *
 * Provides encryption/decryption for sensitive credentials using Node.js crypto.
 * PRD Reference: Line 300 - "Store credentials encrypted (AES-256)"
 *
 * Uses AES-256-GCM with authenticated encryption.
 * Fallback solution since Supabase Vault is not available on all plans.
 *
 * Note: This delegates to the crypto module for actual encryption/decryption.
 */

import {
  encryptSecret as cryptoEncrypt,
  decryptSecret as cryptoDecrypt,
  isEncrypted
} from './crypto'

/**
 * Encrypts a secret value using application-level encryption
 *
 * @param secret - The plaintext secret to encrypt (e.g., Azure client secret)
 * @param name - Optional name/identifier for the secret (for audit trail, not used in this implementation)
 * @returns The encrypted secret in format: iv:authTag:ciphertext
 */
export async function encryptSecret(secret: string, name?: string): Promise<string> {
  try {
    return cryptoEncrypt(secret)
  } catch (error: any) {
    console.error('Failed to encrypt secret:', error)
    throw error
  }
}

/**
 * Decrypts an encrypted secret
 *
 * @param encryptedData - The encrypted secret (format: iv:authTag:ciphertext)
 * @returns The decrypted plaintext secret
 */
export async function decryptSecret(encryptedData: string): Promise<string> {
  try {
    return cryptoDecrypt(encryptedData)
  } catch (error: any) {
    console.error('Failed to decrypt secret:', error)
    throw error
  }
}

/**
 * Updates an existing secret (re-encrypts with new value)
 *
 * @param oldEncryptedData - The old encrypted secret (not used, provided for API compatibility)
 * @param newSecret - The new plaintext secret value
 * @returns The newly encrypted secret
 */
export async function updateSecret(oldEncryptedData: string, newSecret: string): Promise<string> {
  try {
    return cryptoEncrypt(newSecret)
  } catch (error: any) {
    console.error('Failed to update secret:', error)
    throw error
  }
}

/**
 * Deletes a secret (no-op for application-level encryption)
 *
 * @param encryptedData - The encrypted secret to delete
 * @returns True (always succeeds)
 */
export async function deleteSecret(encryptedData: string): Promise<boolean> {
  // No action needed for application-level encryption
  // Secret is stored in database, deletion happens there
  return true
}

/**
 * Helper function to encrypt Azure tenant credentials
 *
 * @param clientSecret - The Azure client secret to encrypt
 * @param tenantName - Name of the tenant (for audit trail, not used in this implementation)
 * @returns The encrypted secret in format: iv:authTag:ciphertext
 */
export async function encryptAzureClientSecret(
  clientSecret: string,
  tenantName?: string
): Promise<string> {
  return encryptSecret(clientSecret, tenantName)
}

/**
 * Helper function to decrypt Azure tenant credentials
 *
 * @param encryptedData - The encrypted secret stored in azure_tenants.azure_client_secret
 * @returns The decrypted Azure client secret
 */
export async function decryptAzureClientSecret(encryptedData: string): Promise<string> {
  return decryptSecret(encryptedData)
}

/**
 * Validates if a string is encrypted (has the format iv:authTag:ciphertext)
 *
 * @param value - String to check
 * @returns True if value appears to be encrypted
 */
export function isVaultSecretId(value: string): boolean {
  return isEncrypted(value)
}

/**
 * Migration helper: Encrypts existing plaintext secrets in database
 * Use this to migrate from plaintext to encrypted storage
 *
 * @param plaintextSecret - Existing plaintext secret from database
 * @param tenantName - Tenant name for audit trail
 * @returns Encrypted secret to replace plaintext value
 */
export async function migrateToVault(
  plaintextSecret: string,
  tenantName: string
): Promise<string> {
  // Check if already encrypted
  if (isEncrypted(plaintextSecret)) {
    console.log(`Secret for ${tenantName} already encrypted`)
    return plaintextSecret
  }

  // Encrypt plaintext secret
  console.log(`Migrating ${tenantName} secret to encrypted format`)
  return encryptAzureClientSecret(plaintextSecret, tenantName)
}
