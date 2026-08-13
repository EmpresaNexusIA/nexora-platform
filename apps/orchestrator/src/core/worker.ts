import { Logger } from './logger.js';
import { EventProcessor } from './event.processor.js';
import { CorrelationContext } from './correlation.context.js';
import { OutboxEvent } from '../types/outbox.types.js';

export class OutboxWorker {

  private running: boolean = true;
  private activeJobs: number = 0;

  constructor(
    private readonly logger: Logger,
    private readonly processor: EventProcessor
  ) {}

  async handleEvent(rawEvent: OutboxEvent): Promise<void> {
    if (!this.running && this.activeJobs === 0) {
      this.logger.warn('Worker rechazando evento: deteniéndose.');
      throw new Error('Worker shutting down');
    }

    this.activeJobs++;

    // FIX SP3: el tenant vive dentro del payload del evento (audit.outbox no
    // tiene columna tenant_id). Antes se leía rawEvent.tenantId -> siempre undefined.
    const context = CorrelationContext.generate(rawEvent.id, rawEvent.payload?.tenantId);

    this.logger.info('Iniciando procesamiento de evento.', {
      eventId: context.eventId,
      traceId: context.traceId,
      tenantId: context.tenantId
    });

    try {
      this.running = true;
      await this.processor.process({ ...rawEvent, ...context });

    } catch (error: unknown) {
      // v2 (12/8): deuda fina saldada — `any` → `unknown` con conversión segura.
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error crítico en Worker.', err, {
        eventId: context.eventId,
        traceId: context.traceId
      });
      throw error;

    } finally {
      this.activeJobs--;
    }
  }

  getState(): string {
    return this.running ? 'RUNNING' : 'STOPPED';
  }

  getActiveJobs(): number {
    return this.activeJobs;
  }

  async stop(): Promise<void> {
    this.logger.info('Deteniendo worker...', {
      activeJobs: this.activeJobs
    });

    this.running = false;

    // v2 (12/8, review): tope de fuerza de 10s. Antes el while podía colgarse
    // para siempre si un job no terminaba → proceso zombie + kill -9 de rutina
    // (lo que la casa evita). Ahora: apagado prolijo SIEMPRE, con límite.
    const plazo = Date.now() + 10_000;

    while (this.activeJobs > 0) {
      if (Date.now() > plazo) {
        this.logger.warn('Worker: tope de apagado (10s) alcanzado — forzando.', {
          activeJobs: this.activeJobs
        });
        break;
      }
      this.logger.info('Esperando tareas activas...', {
        activeJobs: this.activeJobs
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.info('Worker detenido correctamente.', {
      activeJobs: this.activeJobs
    });
  }
}
