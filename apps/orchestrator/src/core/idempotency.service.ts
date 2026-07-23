import { Pool } from 'pg';

export class IdempotencyService {
  constructor(private readonly db: Pool) {}

  async tryAcquire(idempotencyKey: string): Promise<boolean> {
    try {
      const query = `
        INSERT INTO orchestrator.idempotency_keys (idempotency_key, created_at)
        VALUES ($1, NOW())
        ON CONFLICT (idempotency_key) DO NOTHING;
      `;
      const result = await this.db.query(query, [idempotencyKey]);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      return false;
    }
  }
}
