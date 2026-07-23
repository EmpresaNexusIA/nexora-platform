import { OutboxEvent } from '../types/outbox.types.js';
import { EventHandler } from '../handlers/event-handler.interface.js';

export class EventDispatcher {
  private readonly handlers = new Map<string, EventHandler>();

  /**
   * Registra un handler para un tipo de evento específico.
   */
  register(eventType: string, handler: EventHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`[EventDispatcher] Ya existe un handler registrado para el evento: ${eventType}`);
    }
    this.handlers.set(eventType, handler);
  }

  /**
   * Retorna el nombre identificador del handler asignado a un tipo de evento.
   */
  getHandlerName(eventType: string): string | null {
    const handler = this.handlers.get(eventType);
    return handler ? handler.constructor.name : null;
  }

  /**
   * Rutea el evento hacia su handler correspondiente.
   */
  async dispatch(event: OutboxEvent): Promise<void> {
    const handler = this.handlers.get(event.eventType);

    if (!handler) {
      throw new Error(`[EventDispatcher] No se encontró un handler registrado para el tipo de evento: "${event.eventType}"`);
    }

    await handler.handle(event);
  }
}
