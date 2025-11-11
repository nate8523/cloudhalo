import * as crypto from 'crypto'

const ENCRYPTION_KEY = process.env.AZURE_CREDENTIAL_ENCRYPTION_KEY

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('AZURE_CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string')
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Decrypt Azure client secret
 * Format: iv:authTag:ciphertext (all hex-encoded)
 */
export function decryptAzureClientSecret(encrypted: string): string {
  try {
    const parts = encrypted.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format')
    }

    const [ivHex, authTagHex, cipherHex] = parts
    const key = Buffer.from(ENCRYPTION_KEY!, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const ciphertext = Buffer.from(cipherHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    throw new Error(`Failed to decrypt Azure client secret: ${error}`)
  }
}

/**
 * Encrypt Azure client secret
 * Returns format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encryptAzureClientSecret(plaintext: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY!, 'hex')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ])

    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
  } catch (error) {
    throw new Error(`Failed to encrypt Azure client secret: ${error}`)
  }
}
