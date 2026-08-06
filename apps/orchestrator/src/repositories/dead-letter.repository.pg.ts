import { DeadLetterRepository } from './dead-letter.repository.interface.js';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxEvent } from '../types/outbox.types.js';
import { ErrorCategory } from '../types/resilience.types.js';

/**
 * 🧱 El Albañil de la mesa de autopsias — implementación oficial de DeadLetterRepository.
 *
 * Responde a la pregunta histórica del backlog: "¿quién implementa DeadLetterRepository?"
 * Respuesta: PgDeadLetterRepository, que DELEGA en
 * OutboxRepository.moveToDeadLetterQueue — la cirugía transaccional
 * (INSERT en orchestrator.dead_letter_queue + UPDATE de audit.outbox)
 * ya probada por la suite de validación. Regla de la casa: no reinventar
 * lo que pasó la prueba de oro.
 */
export class PgDeadLetterRepository implements DeadLetterRepository {
  constructor(private readonly outbox: OutboxRepository) {}

  async move(event: OutboxEvent, category: ErrorCategory, errorLog: string): Promise<void> {
    await this.outbox.moveToDeadLetterQueue(event, category, errorLog);
  }
}
