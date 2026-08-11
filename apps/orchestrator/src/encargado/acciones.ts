/**
 * 🧔 EL ENCARGADO — A3 (paso 2 de F6): las ACCIONES supervisadas.
 *
 * A3 = humano en el loop: el Encargado PROPONE, el fundador APRUEBA (✅/❌),
 * y SOLO entonces se ejecuta. Nada autónomo (A2 se gana por graduación,
 * con prontuario que mide RESULTADO, no aprobación — review del 10/8).
 *
 * Contrato (reglas de la casa):
 * - Enterrar NUNCA borra: marca resolved_at (la autopsia queda, cultura museo).
 * - Reintentar revive la MISMA fila del outbox (UPDATE a PENDING), nunca un
 *   INSERT duplicado (el SQL dorado deja la fila en DEAD_LETTER).
 * - Todo en transacción (o todo o nada).
 * - Toda función resuelve SIEMPRE un mensaje honesto (la oreja no se traba).
 * - Timeouts en todas las consultas.
 */

import { Client } from 'pg';

const TIMEOUT_MS = 15_000;

export interface MuertoInfo {
  id: string;
  eventType: string;
  errorCategory: string | null;
  failedAt: Date | null;
}

async function conectar(): Promise<Client | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
  });
  await client.connect();
  return client;
}

/** ⚰️ /muertos — la mesa de autopsias (solo NO resueltos). */
export async function listarMuertos(): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const r = await client.query<MuertoInfo>(
      `SELECT id,
              event_type     AS "eventType",
              error_category AS "errorCategory",
              failed_at      AS "failedAt"
         FROM orchestrator.dead_letter_queue
        WHERE resolved_at IS NULL
        ORDER BY failed_at DESC
        LIMIT 10`
    );
    if (r.rows.length === 0) {
      return '⚰️ No hay muertos en la mesa, jefe — el cementerio está vacío. 🕊️';
    }
    const lineas = r.rows.map(
      (m) =>
        `• ${String(m.id).slice(0, 8)} — ${m.eventType} [${m.errorCategory ?? '?'}] ${fecha(m.failedAt)}`
    );
    return [
      '⚰️ Muertos en la mesa (sin resolver):',
      ...lineas,
      '(usá /enterrar o /reintentar con el id corto)',
    ].join('\n');
  } catch (err) {
    return `🏛️ La base no me contestó (${String(err)}) — ¿estará dormida?`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Resuelve el id que manda el fundador (corto de /muertos o uuid completo)
 * contra la mesa SIN resolver. Devuelve el muerto exacto o un mensaje.
 */
export async function resolverMuerto(
  client: Client,
  idOpcion: string
): Promise<{ ok: true; muerto: MuertoInfo } | { ok: false; mensaje: string }> {
  const r = await client.query<MuertoInfo>(
    `SELECT id,
            event_type     AS "eventType",
            error_category AS "errorCategory",
            failed_at      AS "failedAt"
       FROM orchestrator.dead_letter_queue
      WHERE resolved_at IS NULL
        AND id::text LIKE $1
      ORDER BY failed_at
      LIMIT 5`,
    [`${idOpcion}%`]
  );
  if (r.rows.length === 0) {
    return { ok: false, mensaje: 'No encontré ese muerto sin resolver, jefe — revisá /muertos.' };
  }
  if (r.rows.length > 1) {
    return {
      ok: false,
      mensaje: `Hay ${r.rows.length} muertos que empiezan así — pasame un id más largo (de /muertos).`,
    };
  }
  return { ok: true, muerto: r.rows[0] };
}

/** ⚰️ /enterrar — marca resuelto + prontuario con EXITO (acción terminal). */
export async function ejecutarEnterrar(dlqId: string, aprobadoPor: string): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    // El fundador manda el id corto de /muertos: se resuelve a uuid completo
    // ANTES de tocar nada (defensa en profundidad: esta función acepta ambos).
    const resuelto = await resolverMuerto(client, dlqId);
    if (!resuelto.ok) return resuelto.mensaje;
    const idCompleto = resuelto.muerto.id;
    await client.query('BEGIN');
    const upd = await client.query<{ originalEventId: string; eventType: string }>(
      `UPDATE orchestrator.dead_letter_queue
          SET resolved_at = now(), resolved_action = 'BURIED'
        WHERE id = $1 AND resolved_at IS NULL
        RETURNING original_event_id AS "originalEventId", event_type AS "eventType"`,
      [idCompleto]
    );
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      return '🤔 Ese muerto ya no está sin resolver (¿ya lo enterramos?).';
    }
    const { originalEventId, eventType } = upd.rows[0];
    await client.query(
      `INSERT INTO audit.empleado_acciones
         (accion, dlq_id, original_event_id, event_type, detalle, ejecutada_por,
          resultado, resultado_detalle, resultado_verificado_at)
       VALUES ('BURIED', $1, $2, $3, 'entierro aprobado', $4,
               'EXITO', 'accion terminal (BURIED)', now())`,
      [idCompleto, originalEventId, eventType, aprobadoPor]
    );
    await client.query('COMMIT');
    return `⚰️ Enterrado: ${eventType} (${String(idCompleto).slice(0, 8)}…) — autopsia conservada, auditado con resultado EXITO. ✅`;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    return `⚰️ No pude enterrar (${String(err)}) — la base no cooperó.`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** 🔄 /reintentar — revive la MISMA fila del outbox (UPDATE) + prontuario pendiente. */
export async function ejecutarReintentar(dlqId: string, aprobadoPor: string): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const resuelto = await resolverMuerto(client, dlqId);
    if (!resuelto.ok) return resuelto.mensaje;
    const idCompleto = resuelto.muerto.id;
    await client.query('BEGIN');
    const upd = await client.query<{ originalEventId: string; eventType: string }>(
      `UPDATE orchestrator.dead_letter_queue
          SET resolved_at = now(), resolved_action = 'RETRIED'
        WHERE id = $1 AND resolved_at IS NULL
        RETURNING original_event_id AS "originalEventId", event_type AS "eventType"`,
      [idCompleto]
    );
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      return '🤔 Ese muerto ya no está sin resolver (¿ya lo reintentamos?).';
    }
    const { originalEventId, eventType } = upd.rows[0];
    await client.query(
      `INSERT INTO audit.empleado_acciones
         (accion, dlq_id, original_event_id, event_type, detalle, ejecutada_por)
       VALUES ('RETRIED', $1, $2, $3, 'reintento aprobado', $4)`,
      [idCompleto, originalEventId, eventType, aprobadoPor]
    );
    // Revive la MISMA fila del outbox (el SQL dorado la dejó en DEAD_LETTER).
    const revive = await client.query(
      `UPDATE audit.outbox
          SET status = 'PENDING', attempts = 0, next_attempt_at = now(),
              error_log = NULL, completed_at = NULL, started_at = NULL
        WHERE id = $1`,
      [originalEventId]
    );
    if (revive.rowCount === 0) {
      await client.query('ROLLBACK');
      return '🚨 Anomalía: el evento original no existe en el outbox — no toqué nada.';
    }
    await client.query('COMMIT');
    return `🔄 Reviviendo: ${eventType} vuelve al outbox (PENDING). Te aviso el resultado cuando se verifique. ✅`;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    return `🔄 No pude reintentar (${String(err)}) — la base no cooperó.`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * 📜 Verifica los reintentos pendientes (resultado NULL) y les pone
 * EXITO / FRACASO. Se llama al atender /muertos, /prontuario y /estado.
 * Devuelve un resumen breve ('' si no había nada que verificar).
 */
export async function verificarResultadosPendientes(): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '';
  try {
    const pend = await client.query<{ id: string; oev: string; creado: Date }>(
      `SELECT id, original_event_id AS oev, created_at AS creado
         FROM audit.empleado_acciones
        WHERE accion = 'RETRIED' AND resultado IS NULL
        ORDER BY created_at
        LIMIT 20`
    );
    let exitos = 0;
    let fracasos = 0;
    for (const p of pend.rows) {
      const estado = await client.query<{ status: string | null }>(
        `SELECT status FROM audit.outbox WHERE id = $1`,
        [p.oev]
      );
      const status = estado.rows[0]?.status ?? null;
      const caidas = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM orchestrator.dead_letter_queue
          WHERE original_event_id = $1 AND failed_at >= $2`,
        [p.oev, p.creado]
      );
      let res: [string, string] | null = null;
      if (status === 'COMPLETED') {
        res = ['EXITO', 'evento completado tras el reintento'];
      } else if ((caidas.rows[0]?.n ?? 0) > 0) {
        res = ['FRACASO', 'volvió a caer en la DLQ'];
      } else if (status === 'PENDING' || status === 'PROCESSING' || status === 'RETRY') {
        continue; // sigue en vuelo: se vuelve a mirar la próxima ronda
      } else {
        res = ['FRACASO', `sigue sin completar (${status ?? 'sin fila en outbox'})`];
      }
      await client.query(
        `UPDATE audit.empleado_acciones
            SET resultado = $1, resultado_detalle = $2, resultado_verificado_at = now()
          WHERE id = $3`,
        [res[0], res[1], p.id]
      );
      if (res[0] === 'EXITO') exitos++;
      else fracasos++;
    }
    if (exitos + fracasos === 0) return '';
    return `📜 Prontuario actualizado: ${exitos} EXITO, ${fracasos} FRACASO.`;
  } catch (err) {
    return `📜 No pude verificar resultados (${String(err)})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** 📜 /prontuario — el historial de acciones con su resultado (solo lectura). */
export async function verProntuario(): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const r = await client.query<{
      accion: string;
      eventType: string;
      resultado: string | null;
      resultadoDetalle: string | null;
      creado: Date;
    }>(
      `SELECT accion,
              event_type AS "eventType",
              resultado,
              resultado_detalle AS "resultadoDetalle",
              created_at AS creado
         FROM audit.empleado_acciones
        ORDER BY created_at DESC
        LIMIT 10`
    );
    if (r.rows.length === 0) {
      return '📜 El prontuario está vacío, jefe — todavía no hubo acciones.';
    }
    const lineas = r.rows.map((a) => {
      const res =
        a.resultado === 'EXITO'
          ? '✅ EXITO'
          : a.resultado === 'FRACASO'
            ? '❌ FRACASO'
            : '⏳ pendiente';
      return `• ${a.accion} ${a.eventType} → ${res} (${fecha(a.creado)})`;
    });
    return ['📜 Prontuario del Empleado #0 (últimas 10):', ...lineas].join('\n');
  } catch (err) {
    return `📜 La base no me contestó (${String(err)})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

function fecha(f: Date | null): string {
  if (!f) return '?';
  try {
    return new Date(f).toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return '?';
  }
}
