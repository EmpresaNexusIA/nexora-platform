import { IdempotencyRepository } from '../repositories/idempotency.repository.js';
import { OutboxEvent } from '../types/outbox.types.js';

export class IdempotencyService {
  constructor(private readonly repository: IdempotencyRepository) {}

  /**
   * Evalúa de forma atómica si el handler ya procesó este evento.
   */
  async isUniqueAndRegister(event: OutboxEvent, handlerName: string): Promise<boolean> {
    return await this.repository.tryRegister(event.id, event.requestId, handlerName);
  }
}
