import { OutboxEvent } from '../types/outbox.types.js';
import { ErrorCategory } from '../types/resilience.types.js';

export interface DeadLetterRepository {
  move(event: OutboxEvent, category: ErrorCategory, errorLog: string): Promise<void>;
}
