import { EventSource } from './event-source.interface.js';
import { OutboxRepository } from '../repositories/outbox.repository.js';
import { OutboxEvent, OutboxStatus } from '../types/outbox.types.js';

export class PollingEventSource implements EventSource {
  constructor(private readonly repository: OutboxRepository) {}

  async fetchPendingEvents(batchSize: number): Promise<OutboxEvent[]> {
    return this.repository.fetchAndLockTunneled(batchSize);
  }

  async updateEventStatus(
    id: string,
    update: { status: OutboxStatus; nextAttemptAt?: Date; errorLog?: string }
  ): Promise<void> {
    await this.repository.updateStatus(
      id,
      update.status,
      update.nextAttemptAt ?? null,
      update.errorLog ?? null
    );
  }

  async moveToDeadLetter(
    event: OutboxEvent,
    errorCategory: string,
    errorLog: string
  ): Promise<void> {
    await this.repository.moveToDeadLetterQueue(event, errorCategory, errorLog);
  }
}
