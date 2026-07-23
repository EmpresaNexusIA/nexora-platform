import { OutboxEvent } from '../types/outbox.types.js';
import { 
  IRetryManager, 
  RetryPolicy, 
  CustomRetryConfig, 
  ClassifiableError, 
  RetryEvaluation, 
  ErrorCategory,
  JitterStrategy
} from '../types/resilience.types.js';

export class RetryManager implements IRetryManager {
  // Configuración global por defecto oficial de Nexora Platform
  private readonly globalDefault: RetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 1000, // 1 segundo
    maxDelayMs: 60000, // 1 minuto
    jitterStrategy: 'FULL'
  };

  // Diccionario de estrategias matemáticas para cumplir con Open/Closed
  private readonly jitterStrategies: Record<JitterStrategy, (backoff: number) => number> = {
    NONE: (backoff) => backoff,
    FULL: (backoff) => Math.floor(Math.random() * (backoff + 1)),
    EQUAL: (backoff) => {
      const half = Math.floor(backoff / 2);
      return half + Math.floor(Math.random() * (half + 1));
    }
  };

  public evaluate(
    event: OutboxEvent,
    error: ClassifiableError,
    customConfig?: CustomRetryConfig
  ): RetryEvaluation {
    // 1. Resolver jerarquía de políticas (Override por Handler)
    const policy = this.resolvePolicy(customConfig);

    // 2. Determinar categoría del error siguiendo el contrato abstracto
    const category: ErrorCategory = error.category || 'UNKNOWN';

    // 3. Evaluar curso de acción inmediato
    if (category === 'PERMANENT') {
      return {
        action: 'DEAD_LETTER',
        category,
        attemptCount: event.attempts,
        nextAttemptAt: null,
        reason: `Abortado por Error Permanente: ${error.message}`
      };
    }

    const nextAttemptCount = event.attempts + 1;

    if (nextAttemptCount > policy.maxAttempts) {
      return {
        action: 'DEAD_LETTER',
        category,
        attemptCount: event.attempts,
        nextAttemptAt: null,
        reason: `Estrategia de reintentos agotada (${event.attempts}/${policy.maxAttempts}). Motivo: ${error.message}`
      };
    }

    // 4. Calcular backoff exponencial con Jitter
    const delayMs = this.calculateDelay(nextAttemptCount, policy);
    const nextAttemptAt = new Date(Date.now() + delayMs);

    return {
      action: 'RETRY',
      category,
      attemptCount: nextAttemptCount,
      nextAttemptAt,
      reason: `Reintento agendado #${nextAttemptCount} (espera: ${delayMs}ms, estrategia: ${policy.jitterStrategy}) debido a: ${error.message}`
    };
  }

  /**
   * Resuelve la política final combinando los valores globales con los overrides declarativos del Handler.
   */
  private resolvePolicy(customConfig?: CustomRetryConfig): RetryPolicy {
    if (!customConfig || typeof customConfig.getRetryPolicy !== 'function') {
      return this.globalDefault;
    }
    return {
      ...this.globalDefault,
      ...customConfig.getRetryPolicy()
    };
  }

  /**
   * Encapsula el cálculo matemático puro del backoff exponencial.
   */
  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    // Fórmula base: baseDelay * 2^attempt
    const backoffPuro = policy.baseDelayMs * Math.pow(2, attempt);
    const cappedBackoff = Math.min(policy.maxDelayMs, backoffPuro);

    // Aplicar la estrategia seleccionada mapeada en el diccionario operacional
    const strategyFn = this.jitterStrategies[policy.jitterStrategy] || this.jitterStrategies.FULL;
    return strategyFn(cappedBackoff);
  }
}
