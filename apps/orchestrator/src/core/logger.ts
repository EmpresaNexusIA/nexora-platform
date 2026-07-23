export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  eventId?: string;
  traceId?: string;
  tenantId?: string;
  handler?: string;
  durationMs?: number;
  [key: string]: any;
}

export class Logger {
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const logEntry = {
      level,
      message,
      service: 'orchestrator',
      timestamp: new Date().toISOString(),
      ...context,
    };
    return JSON.stringify(logEntry);
  }

  info(message: string, context?: LogContext): void {
    process.stdout.write(this.format('info', message, context) + '\n');
  }

  warn(message: string, context?: LogContext): void {
    process.stdout.write(this.format('warn', message, context) + '\n');
  }

  error(message: string, error: Error, context?: LogContext): void {
    const errorContext = { ...context, stack: error.stack, errorName: error.name };
    process.stdout.write(this.format('error', error.message, errorContext) + '\n');
  }
}
