import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.collector.js';
import { EventDispatcher } from './event.dispatcher.js';
import { IdempotencyService } from '../services/idempotency.service.js';

export class EventProcessor {
  constructor(
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
    private readonly dispatcher: EventDispatcher,
    private readonly idempotency: IdempotencyService
  ) {}

  async process(event: any): Promise<void> {
    const startTime = Date.now();
    const context = {
      eventId: event.id,
      tenantId: event.tenantId,
      handler: event.type
    };

    try {
      this.metrics.incrementProcessed();

      // Idempotencia canónica (services/ + repositories/): clave (event_id, handler_name)
      // sobre orchestrator.idempotency_keys, con ON CONFLICT por la unique compuesta.
      // NOTA: la versión fósil en core/ esperaba columnas inexistentes
      // (idempotency_key, created_at) y fallaba en silencio descartando todos los eventos.
      const handlerName =
        this.dispatcher.getHandlerName(event.eventType) ?? event.eventType;
      const isNew = await this.idempotency.isUniqueAndRegister(event, handlerName);

      if (!isNew) {
        this.logger.warn('Evento duplicado detectado, omitiendo.', context);
        return;
      }

      await this.dispatcher.dispatch(event);
      this.metrics.incrementSuccess();
      this.logger.info('Evento procesado exitosamente.', {
        ...context,
        durationMs: Date.now() - startTime
      });
    } catch (error: any) {
      this.metrics.incrementFailure();
      this.logger.error('Error procesando evento.', error, context);
      throw error;
    }
  }
}
