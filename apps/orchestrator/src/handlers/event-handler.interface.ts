import { OutboxEvent } from '../types/outbox.types.js';

export interface EventHandler {
  /**
   * Ejecuta la lógica de negocio asociada al evento.
   * Si lanza una excepción, el orquestador lo interpretará como falla y gatillará el reintento.
   */
  handle(event: OutboxEvent): Promise<void>;
}
