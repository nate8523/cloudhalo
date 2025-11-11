type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info'

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[LOG_LEVEL]
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta))
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta))
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta))
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      const meta = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
      console.error(this.formatMessage('error', message, meta))
    }
  }
}

export const logger = new Logger()
