/**
 * Cron Task Scheduler Configuration
 *
 * This module defines all scheduled tasks and their execution schedules.
 * The orchestrator uses this configuration to determine which tasks to run.
 *
 * Benefits:
 * - Single source of truth for all cron schedules
 * - Centralized task management
 * - Easy to add new tasks or modify schedules
 * - Type-safe task definitions
 */

export interface CronTask {
  /** Unique identifier for the task */
  id: string
  /** Human-readable name */
  name: string
  /** Description of what the task does */
  description: string
  /** Cron expression defining when task should run */
  schedule: string
  /** Internal API endpoint to call (e.g., /api/cron/poll-costs) */
  endpoint: string
  /** HTTP method for the endpoint */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Enabled status */
  enabled: boolean
  /** Maximum execution time in seconds (optional) */
  maxDuration?: number
}

/**
 * All scheduled tasks configuration
 *
 * Cron Expression Format: "minute hour day month weekday"
 * - minute: 0-59
 * - hour: 0-23 (UTC)
 * - day: 1-31
 * - month: 1-12
 * - weekday: 0-7 (0 and 7 = Sunday)
 *
 * Special characters:
 * - asterisk (*) = any value
 * - asterisk slash n = every n units
 * - n,m = specific values
 * - n-m = range
 */
export const CRON_TASKS: CronTask[] = [
  {
    id: 'poll-costs',
    name: 'Poll Azure Costs',
    description: 'Syncs cost data for all active Azure tenants',
    schedule: '0 2 * * *', // Daily at 2 AM UTC
    endpoint: '/api/cron/poll-costs',
    method: 'GET',
    enabled: true,
    maxDuration: 300, // 5 minutes
  },
  {
    id: 'poll-resources',
    name: 'Poll Azure Resources',
    description: 'Syncs resource inventory for all active Azure tenants',
    schedule: '0 3 * * *', // Daily at 3 AM UTC
    endpoint: '/api/cron/poll-resources',
    method: 'GET',
    enabled: true,
    maxDuration: 300, // 5 minutes
  },
  {
    id: 'evaluate-alerts',
    name: 'Evaluate Alert Rules',
    description: 'Evaluates alert rules against current cost data and triggers notifications',
    schedule: '0 4 * * *', // Daily at 4 AM UTC (changed from hourly to daily)
    endpoint: '/api/cron/evaluate-alerts',
    method: 'GET',
    enabled: true,
    maxDuration: 180, // 3 minutes
  },
  {
    id: 'send-reports',
    name: 'Send Scheduled Reports',
    description: 'Processes and sends scheduled cost reports and alert digests',
    schedule: '0 8 * * 1', // Weekly on Mondays at 8 AM UTC
    endpoint: '/api/cron/send-reports',
    method: 'POST',
    enabled: true,
    maxDuration: 300, // 5 minutes
  },
]

/**
 * Parse a cron expression into individual components
 */
export interface CronComponents {
  minute: string
  hour: string
  day: string
  month: string
  weekday: string
}

export function parseCronExpression(expression: string): CronComponents {
  const parts = expression.trim().split(/\s+/)

  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${expression}. Expected 5 components.`)
  }

  return {
    minute: parts[0],
    hour: parts[1],
    day: parts[2],
    month: parts[3],
    weekday: parts[4],
  }
}

/**
 * Check if a cron component matches the current time value
 */
function matchesCronComponent(component: string, value: number): boolean {
  // Handle wildcard
  if (component === '*') return true

  // Handle lists (e.g., "1,3,5")
  if (component.includes(',')) {
    const values = component.split(',').map(v => parseInt(v.trim(), 10))
    return values.includes(value)
  }

  // Handle ranges (e.g., "1-5")
  if (component.includes('-')) {
    const [start, end] = component.split('-').map(v => parseInt(v.trim(), 10))
    return value >= start && value <= end
  }

  // Handle steps (e.g., "*/5")
  if (component.includes('/')) {
    const [base, step] = component.split('/')
    const stepValue = parseInt(step, 10)

    if (base === '*') {
      return value % stepValue === 0
    }

    const baseValue = parseInt(base, 10)
    return value % stepValue === baseValue % stepValue
  }

  // Handle exact match
  return parseInt(component, 10) === value
}

/**
 * Determine if a task should run based on its schedule and current time
 *
 * @param task - The cron task to check
 * @param now - Optional date to check against (defaults to current time)
 * @returns true if the task should run now
 */
export function shouldTaskRun(task: CronTask, now: Date = new Date()): boolean {
  if (!task.enabled) {
    return false
  }

  const cron = parseCronExpression(task.schedule)
  const utcNow = new Date(now.toISOString())

  const minute = utcNow.getUTCMinutes()
  const hour = utcNow.getUTCHours()
  const day = utcNow.getUTCDate()
  const month = utcNow.getUTCMonth() + 1 // 0-indexed to 1-indexed
  const weekday = utcNow.getUTCDay()

  return (
    matchesCronComponent(cron.minute, minute) &&
    matchesCronComponent(cron.hour, hour) &&
    matchesCronComponent(cron.day, day) &&
    matchesCronComponent(cron.month, month) &&
    matchesCronComponent(cron.weekday, weekday)
  )
}

/**
 * Get all tasks that should run at the current time
 *
 * @param now - Optional date to check against (defaults to current time)
 * @returns Array of tasks that should run
 */
export function getTasksToRun(now: Date = new Date()): CronTask[] {
  return CRON_TASKS.filter(task => shouldTaskRun(task, now))
}

/**
 * Get a task by ID
 *
 * @param taskId - The task ID to find
 * @returns The task or undefined if not found
 */
export function getTaskById(taskId: string): CronTask | undefined {
  return CRON_TASKS.find(task => task.id === taskId)
}

/**
 * Format task execution result for logging
 */
export interface TaskExecutionResult {
  taskId: string
  taskName: string
  success: boolean
  startTime: Date
  endTime: Date
  duration: number
  error?: string
  response?: any
}

export function formatTaskResult(result: TaskExecutionResult): string {
  const status = result.success ? '✓' : '✗'
  const duration = `${result.duration}ms`

  return `[${status}] ${result.taskName} (${duration})`
}
