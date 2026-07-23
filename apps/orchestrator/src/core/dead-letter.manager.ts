import { DeadLetterRepository } from '../repositories/dead-letter.repository.interface.js';
import { MetricsCollector } from './metrics.collector.js';
import { OutboxEvent } from '../types/outbox.types.js';
import { ErrorCategory } from '../types/resilience.types.js';

export class DeadLetterManager {
  constructor(
    private readonly repository: DeadLetterRepository,
    private readonly metrics: MetricsCollector,
    private readonly logger: any // Ajustar al tipo real de tu sistema de logs
  ) {}

  async move(event: OutboxEvent, category: ErrorCategory, errorLog: string): Promise<void> {
    this.logger.error('Moving event to DLQ', { eventId: event.id, category });
    await this.repository.move(event, category, errorLog);
    // Ajustar el nombre del método según tu implementación real en MetricsCollector
    this.metrics.recordDeadLetter(); 
  }
}
