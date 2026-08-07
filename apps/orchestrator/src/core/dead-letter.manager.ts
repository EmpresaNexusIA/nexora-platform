import { DeadLetterRepository } from '../repositories/dead-letter.repository.interface.js';
import { MetricsCollector } from './metrics.collector.js';
import { OutboxEvent } from '../types/outbox.types.js';
import { ErrorCategory } from '../types/resilience.types.js';

/**
 * Logger mínimo que el Manager necesita — tipado real (deuda saldada:
 * `logger: any` cumplida el 2026-08-06). El logger del core se enchufa
 * acá cuando se arme el motor de eventos.
 */
interface LoggerLike {
  error(message: string, meta?: unknown): void;
}

export class DeadLetterManager {

  constructor(
    private readonly repository: DeadLetterRepository,
    private readonly metrics: MetricsCollector,
    private readonly logger: LoggerLike
  ) {}

  async move(event: OutboxEvent, category: ErrorCategory, errorLog: string): Promise<void> {
    this.logger.error('Moving event to DLQ', { eventId: event.id, category });
    await this.repository.move(event, category, errorLog);
    this.metrics.recordDeadLetter();
  }

}
