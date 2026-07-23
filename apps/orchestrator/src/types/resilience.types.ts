import { OutboxEvent } from './outbox.types.js';

/**
 * Clasificación agnóstica de errores operacionales.
 */
export type ErrorCategory = 'TRANSIENT' | 'PERMANENT' | 'UNKNOWN';

/**
 * Estrategias de dispersión temporal (Jitter) para mitigar el efecto manada.
 */
export type JitterStrategy = 'NONE' | 'FULL' | 'EQUAL';

/**
 * Estructura de un error que transporta metadatos de clasificación.
 */
export interface ClassifiableError extends Error {
  category?: ErrorCategory;
}

/**
 * Política de reintentos pura y configurable.
 */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterStrategy: JitterStrategy;
}

/**
 * Contrato que deben implementar los Handlers de eventos 
 * que requieran sobreescribir la política de resiliencia por defecto.
 */
export interface CustomRetryConfig {
  getRetryPolicy(): Partial<RetryPolicy>;
}

/**
 * Resultado operacional de la evaluación de un fallo.
 */
export interface RetryEvaluation {
  action: 'RETRY' | 'DEAD_LETTER';
  category: ErrorCategory;
  attemptCount: number;
  nextAttemptAt: Date | null;
  reason: string;
}

/**
 * Contrato público del RetryManager.
 * Diseñado de forma agnóstica para evaluar la resiliencia de cualquier evento de la plataforma.
 */
export interface IRetryManager {
  /**
   * Evalúa un fallo contra una política específica y calcula de forma atómica 
   * el curso de acción, aplicando la estrategia de Jitter correspondiente.
   */
  evaluate(
    event: OutboxEvent,
    error: ClassifiableError,
    customConfig?: CustomRetryConfig
  ): RetryEvaluation;
}
