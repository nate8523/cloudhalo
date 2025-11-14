import { Resend } from 'resend'

// Use a placeholder during build time if API key is not set
const apiKey = process.env.RESEND_API_KEY || 're_placeholder_for_build'

export const resend = new Resend(apiKey)

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'CloudHalo <alerts@cloudhalo.app>'
