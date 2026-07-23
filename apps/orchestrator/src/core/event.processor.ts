import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.collector.js';
import { EventDispatcher } from './event.dispatcher.js';
import { IdempotencyService } from './idempotency.service.js';

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

      // Cambiamos a tryAcquire para coincidir con el contrato de IdempotencyService
      const isNew = await this.idempotency.tryAcquire(event.id);
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
