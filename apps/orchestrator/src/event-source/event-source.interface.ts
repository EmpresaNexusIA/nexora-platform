import { OutboxEvent } from '../types/outbox.types.js';

export interface EventSource {
  /**
   * Obtiene una tanda de eventos listos para procesar usando bloqueo seguro (SKIP LOCKED).
   * Incrementa de forma atómica el contador de intentos y pasa el estado a PROCESSING.
   */
  fetchPendingEvents(batchSize: number): Promise<OutboxEvent[]>;

  /**
   * Actualiza el estado final o de reintento del evento tras su ejecución.
   */
  updateEventStatus(
    id: string,
    update: {
      status: OutboxEvent['status'];
      nextAttemptAt?: Date;
      errorLog?: string;
    }
  ): Promise<void>;

  /**
   * Deriva de forma atómica un evento fallido irreversible hacia la Dead Letter Queue.
   */
  moveToDeadLetter(
    event: OutboxEvent,
    errorCategory: string,
    errorLog: string
  ): Promise<void>;
}
