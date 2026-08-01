import { Pool } from 'pg';
import { OutboxEvent, OutboxStatus } from '../types/outbox.types.js';

export class OutboxRepository {
  constructor(private readonly db: Pool) {}

  async fetchAndLockTunneled(batchSize: number): Promise<OutboxEvent[]> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const selectAndLockQuery = `
        WITH selected_events AS (
            SELECT id FROM audit.outbox
            WHERE status IN ('PENDING', 'RETRY')
              AND (next_attempt_at IS NULL OR next_attempt_at <= now())
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        )
        UPDATE audit.outbox o
        SET status = 'PROCESSING', started_at = now(), attempts = o.attempts + 1
        FROM selected_events se
        WHERE o.id = se.id
        RETURNING o.id, o.status, o.event_type AS "eventType", o.payload, o.attempts,
                  o.next_attempt_at AS "nextAttemptAt", o.created_at AS "createdAt",
                  o.started_at AS "startedAt", o.completed_at AS "completedAt",
                  o.error_log AS "errorLog", o.request_id AS "requestId";
      `;
      const res = await client.query(selectAndLockQuery, [batchSize]);
      await client.query('COMMIT');
      return res.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    id: string,
    status: OutboxStatus,
    nextAttemptAt: Date | null = null,
    errorLog: string | null = null
  ): Promise<void> {
    const query = `
      UPDATE audit.outbox
      SET status = $2::audit.outbox_status,
          next_attempt_at = $3,
          error_log = $4,
          completed_at = CASE WHEN $2::text::audit.outbox_status = 'COMPLETED' THEN now() ELSE completed_at END
      WHERE id = $1;
    `;
    await this.db.query(query, [id, status, nextAttemptAt, errorLog]);
  }

  async moveToDeadLetterQueue(
    event: OutboxEvent,
    errorCategory: string,
    errorLog: string
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO orchestrator.dead_letter_queue (original_event_id, event_type, payload, error_category, error_log)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, event.eventType, JSON.stringify(event.payload), errorCategory, errorLog]
      );
      // FIX SP3: un evento que ya vive en la DLQ queda DEAD_LETTER (el enum
      // audit.outbox_status lo contempla). Antes quedaba FAILED, que sugiere
      // "falló" en vez de "murió" y ensucia la observabilidad.
      await client.query(
        `UPDATE audit.outbox SET status = 'DEAD_LETTER'::audit.outbox_status, error_log = $2, completed_at = now() WHERE id = $1`,
        [event.id, errorLog]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
