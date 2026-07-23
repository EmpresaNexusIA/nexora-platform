import { Logger } from './logger.js';
import { EventProcessor } from './event.processor.js';
import { CorrelationContext } from './correlation.context.js';

export class OutboxWorker {
  private running: boolean = true;
  private activeJobs: number = 0;

  constructor(
    private readonly logger: Logger,
    private readonly processor: EventProcessor
  ) {}

  async handleEvent(rawEvent: any): Promise<void> {
    if (!this.running && this.activeJobs === 0) {
      this.logger.warn('Worker rechazando evento: deteniéndose.');
      throw new Error('Worker shutting down');
    }

    this.activeJobs++;
    const context = CorrelationContext.generate(rawEvent.id, rawEvent.tenantId);

    this.logger.info('Iniciando procesamiento de evento.', {
      eventId: context.eventId,
      traceId: context.traceId,
      tenantId: context.tenantId
    });

    try {
      this.running = true;
      await this.processor.process({ ...rawEvent, ...context });
    } catch (error: any) {
      this.logger.error('Error crítico en Worker.', error, {
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

    while (this.activeJobs > 0) {
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
