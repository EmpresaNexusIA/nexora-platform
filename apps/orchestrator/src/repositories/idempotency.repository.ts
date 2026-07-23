import { Pool } from 'pg';

export class IdempotencyRepository {
  constructor(private readonly db: Pool) {}

  /**
   * Intenta registrar de forma atómica la ejecución de un handler para un evento.
   * Retorna true si se registró con éxito (primera vez), false si violó la unicidad (duplicado).
   */
  async tryRegister(eventId: string, requestId: string | null, handlerName: string): Promise<boolean> {
    const query = `
      INSERT INTO orchestrator.idempotency_keys (event_id, request_id, handler_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, handler_name) DO NOTHING;
    `;
    try {
      const res = await this.db.query(query, [eventId, requestId, handlerName]);
      return res.rowCount !== null && res.rowCount > 0;
    } catch (error) {
      return false;
    }
  }
}
