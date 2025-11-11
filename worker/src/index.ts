import 'dotenv/config'
import { CronJob } from 'cron'
import * as http from 'http'
import { logger } from './lib/logger'
import { pollAzureCosts } from './tasks/poll-costs'

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AZURE_CREDENTIAL_ENCRYPTION_KEY'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}

// Configuration
const COST_POLLING_INTERVAL_HOURS = parseInt(process.env.COST_POLLING_INTERVAL_HOURS || '4')
const HEALTH_CHECK_PORT = parseInt(process.env.PORT || '3001') // Render uses 10000, Railway auto-assigns

// Job status tracking
let lastCostPollingRun: Date | null = null
let lastCostPollingStatus: 'success' | 'failed' | 'running' = 'success'
let isShuttingDown = false

/**
 * Cost polling job - runs every N hours (default: 4 hours)
 * Aligned with Azure Cost Management API refresh rate
 */
const costPollingJob = new CronJob(
  `0 */${COST_POLLING_INTERVAL_HOURS} * * *`, // Every N hours at minute 0
  async () => {
    if (isShuttingDown) {
      logger.warn('Skipping cost polling - worker is shutting down')
      return
    }

    logger.info('Cost polling cron job triggered')
    lastCostPollingStatus = 'running'

    try {
      await pollAzureCosts()
      lastCostPollingRun = new Date()
      lastCostPollingStatus = 'success'
      logger.info('Cost polling cron job completed successfully')
    } catch (error) {
      lastCostPollingStatus = 'failed'
      logger.error('Cost polling cron job failed', error)
    }
  },
  null, // onComplete callback
  false, // don't start immediately
  'UTC' // timezone
)

/**
 * Health check endpoint
 * Responds with worker status and last job execution times
 */
const healthCheckServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    const uptime = process.uptime()
    const memoryUsage = process.memoryUsage()

    const health = {
      status: 'healthy',
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      uptimeSeconds: Math.floor(uptime),
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      jobs: {
        costPolling: {
          lastRun: lastCostPollingRun?.toISOString() || 'never',
          status: lastCostPollingStatus,
          scheduleHours: COST_POLLING_INTERVAL_HOURS
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      },
      timestamp: new Date().toISOString()
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health, null, 2))
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('CloudHalo Background Worker v1.0.0\n')
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found\n')
  }
})

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal} signal. Starting graceful shutdown...`)
  isShuttingDown = true

  // Stop accepting new cron jobs
  costPollingJob.stop()
  logger.info('Stopped cron jobs')

  // Close health check server
  healthCheckServer.close(() => {
    logger.info('Closed health check server')
  })

  // Give running jobs 30 seconds to complete
  setTimeout(() => {
    logger.info('Graceful shutdown complete. Exiting.')
    process.exit(0)
  }, 30000)
}

/**
 * Main application startup
 */
async function main() {
  try {
    logger.info('CloudHalo Background Worker starting...')
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
    logger.info(`Cost polling interval: Every ${COST_POLLING_INTERVAL_HOURS} hours`)

    // Start health check server
    healthCheckServer.listen(HEALTH_CHECK_PORT, () => {
      logger.info(`Health check server listening on port ${HEALTH_CHECK_PORT}`)
      logger.info(`Health endpoint: http://localhost:${HEALTH_CHECK_PORT}/health`)
    })

    // Start cron jobs
    costPollingJob.start()
    logger.info('Started cost polling cron job')

    // Run cost polling immediately on startup (don't wait for first cron trigger)
    logger.info('Running initial cost polling on startup...')
    try {
      await pollAzureCosts()
      lastCostPollingRun = new Date()
      lastCostPollingStatus = 'success'
      logger.info('Initial cost polling completed successfully')
    } catch (error) {
      lastCostPollingStatus = 'failed'
      logger.error('Initial cost polling failed', error)
    }

    logger.info('CloudHalo Background Worker started successfully')
    logger.info(`Next cost polling run: ${costPollingJob.nextDate().toISO()}`)

    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  } catch (error) {
    logger.error('Failed to start CloudHalo Background Worker', error)
    process.exit(1)
  }
}

// Catch unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise })
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error)
  process.exit(1)
})

// Start the worker
main()
