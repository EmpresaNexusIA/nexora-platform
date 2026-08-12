/**
 * 🚂 EL MOTOR SP3 — el enchufe del orquestador (la ignición que faltaba).
 *
 * El motor (Worker, Processor, RetryManager, Idempotencia, Repositories)
 * ya existía y estaba bien armado — pero NUNCA se instanciaba: el index.ts
 * era un andamio con "// ... resto de tu inicialización ...".
 * Este archivo es el bucle + el cableado real:
 *
 *   cada intervalMs → PollingEventSource.fetchPendingEvents (FOR UPDATE
 *   SKIP LOCKED, los marca PROCESSING) → Worker.handleEvent (Processor:
 *   idempotencia + dispatcher) →
 *     OK        → updateStatus COMPLETED
 *     Error     → RetryManager.evaluate (TRANSIENT → RETRY con backoff;
 *                 PERMANENT / agotado → DEAD_LETTER)
 *
 * LLAVE DE ENCENDIDO (apagado por defecto, regla de la casa):
 *   WORKER=on
 * Opcionales: WORKER_BATCH (default 10) · WORKER_INTERVAL_MS (default 5000)
 *
 * El apagado elegante va por el apagado compartido del index (alApagar).
 */

import { Pool } from 'pg';
import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.collector.js';
import { EventDispatcher } from './event.dispatcher.js';
import { RetryManager } from './retry.manager.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { IdempotencyRepository } from '../repositories/idempotency.repository.js';
import { OutboxRepository } from '../repositories/outbox.repository.js';
import { PollingEventSource } from '../event-source/polling.event-source.js';
import { DeadLetterManager } from './dead-letter.manager.js';
import { PgDeadLetterRepository } from '../repositories/dead-letter.repository.pg.js';
import { OutboxWorker } from './worker.js';
import { EventProcessor } from './event.processor.js';
import { UserSoftDeletedHandler } from '../handlers/user-soft-deleted.handler.js';
import type { OutboxEvent } from '../types/outbox.types.js';
import type { ClassifiableError } from '../types/resilience.types.js';

export interface EngineHandle {
  start(): void;
  stop(): Promise<void>;
}

export function crearEngine(pool: Pool, logger: Logger): EngineHandle {
  // ---- piezas del motor (todas ya existían, ahora se cablean) ----
  const metrics = new MetricsCollector();
  const outboxRepo = new OutboxRepository(pool);
  const eventSource = new PollingEventSource(outboxRepo);
  const dispatcher = new EventDispatcher();
  dispatcher.register('user.soft_deleted', new UserSoftDeletedHandler());
  const retryManager = new RetryManager();
  const idempotency = new IdempotencyService(new IdempotencyRepository(pool));
  const dlqRepo = new PgDeadLetterRepository(outboxRepo);
  const dlqManager = new DeadLetterManager(dlqRepo, metrics, logger);

  const processor = new EventProcessor(logger, metrics, dispatcher, idempotency);
  const worker = new OutboxWorker(logger, processor);

  // ---- configuración ----
  const batchSize = Number(process.env.WORKER_BATCH ?? 10);
  const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 5000);

  let timer: NodeJS.Timeout | null = null;
  let corriendo = false;

  const procesarRonda = async (): Promise<void> => {
    if (corriendo) return; // no superponer rondas
    corriendo = true;
    try {
      const eventos = await eventSource.fetchPendingEvents(batchSize);
      if (eventos.length > 0) {
        logger.info('Motor: ronda con eventos.', { batch: eventos.length });
      }
      for (const evento of eventos) {
        await procesarUno(evento);
      }
    } catch (err) {
      logger.error('Motor: ronda falló (reintenta en la próxima).', err as Error);
    } finally {
      corriendo = false;
    }
  };

  const procesarUno = async (evento: OutboxEvent): Promise<void> => {
    try {
      await worker.handleEvent(evento);
      await eventSource.updateEventStatus(evento.id, { status: 'COMPLETED' });
      logger.info('Motor: evento completado.', { eventId: evento.id, eventType: evento.eventType });
    } catch (err) {
      const error = err as ClassifiableError;
      const evalRetry = retryManager.evaluate(evento, error);
      if (evalRetry.action === 'RETRY') {
        metrics.incrementRetry();
        await eventSource.updateEventStatus(evento.id, {
          status: 'RETRY',
          nextAttemptAt: evalRetry.nextAttemptAt ?? undefined,
          errorLog: evalRetry.reason,
        });
        logger.warn('Motor: reintento agendado.', {
          eventId: evento.id,
          attempt: evalRetry.attemptCount,
          reason: evalRetry.reason,
        });
      } else {
        await eventSource.moveToDeadLetter(evento, evalRetry.category, evalRetry.reason);
        logger.warn('Motor: evento a la DLQ.', {
          eventId: evento.id,
          category: evalRetry.category,
          reason: evalRetry.reason,
        });
      }
    }
  };

  return {
    start(): void {
      if (timer) return;
      logger.info('Motor: encendido.', {
        batchSize,
        intervalMs,
        handler: 'user.soft_deleted',
      });
      void procesarRonda();
      timer = setInterval(() => {
        void procesarRonda().catch((err) =>
          logger.error('Motor: ronda con error.', err as Error)
        );
      }, intervalMs);
    },
    async stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await worker.stop();
      logger.info('Motor: apagado, ronda en curso terminada.');
    },
  };
}
