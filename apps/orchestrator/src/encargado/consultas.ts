/**
 * 🧔 EL ENCARGADO — A1.2 (Parto 2): las consultas al taller.
 *
 * /busca  <texto>   → Qdrant   🧠 la biblioteca por significado
 * /traeme <nombre>  → MinIO    📦 el depósito de archivos
 * /donde  <término> → Postgres 🏛️ los registros
 *
 * CONTRATO (el mismo de la oreja, Parto 1):
 * - Solo-lectura por construcción: acá no hay un solo INSERT/UPDATE/DELETE,
 *   ni lo va a haber en este nivel de la escalera.
 * - Toda consulta resuelve SIEMPRE un mensaje (honesto): si algo falla,
 *   se dice con nombre y apellido y el Encargado sigue de guardia.
 * - Timeouts en todas las llamadas: una consulta colgada NO traba al Encargado.
 * - NUNCA se imprimen secretos: solo causas y estados.
 * - Si falta configuración (llaves, URL), se avisa claro — no un crash.
 */

import { Client } from 'pg';
import { firmarV4, canonicalQuery, sha256, SHA_EMPTY, type FirmaV4Params } from './sigv4.js';

const TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// /busca — Qdrant (la biblioteca por significado) 🧠
// ---------------------------------------------------------------------------

/**
 * Busca en Qdrant. v1 (sin capa de IA todavía): lista las colecciones y sus
 * puntos (payload), y marca cuáles matchean el texto. Semántica real llega
 * con la capa de IA (SP5); hoy la biblioteca probablemente esté vacía y el
 * Encargado lo dice honesto (contrato).
 */
export async function buscarEnBiblioteca(texto: string): Promise<string> {
  const base = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333';
  const llave = process.env.QDRANT_API_KEY;
  try {
    const res = await fetch(`${base}/collections`, {
      headers: llave ? { 'api-key': llave } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return '🧠 La biblioteca me cerró la puerta (QDRANT_API_KEY ausente o inválida) — avisale al taller.';
    }
    if (!res.ok) {
      return `🧠 La biblioteca no respondió bien (HTTP ${res.status}).`;
    }
    const data = (await res.json()) as {
      result?: { collections?: { name: string }[] };
    };
    const colecciones = data.result?.collections ?? [];

    if (colecciones.length === 0) {
      return (
        '📚 Mi biblioteca aún está vacía, jefe. Cuando la llenemos (runbooks, ' +
        'conocimiento del taller), /busca va a brillar — con semántica real ' +
        'cuando llegue la capa de IA (SP5).'
      );
    }

    const termino = texto.toLowerCase();
    let coincidencias = 0;
    const partes: string[] = [];
    for (const c of colecciones.slice(0, 3)) {
      const puntos = await qdrantScroll(base, llave, c.name);
      const match = puntos.filter((p) =>
        JSON.stringify(p.payload ?? {}).toLowerCase().includes(termino)
      );
      coincidencias += match.length;
      if (match.length > 0) {
        partes.push(
          `• "${c.name}": ${match.length} coincidencia(s) de ${puntos.length} puntos`
        );
        for (const m of match.slice(0, 5)) {
          const pld = JSON.stringify(m.payload ?? {});
          partes.push(
            `   — ${String(m.id)}: ${pld.length > 100 ? pld.slice(0, 100) + '…' : pld}`
          );
        }
      } else {
        partes.push(`• "${c.name}": ${puntos.length} puntos (nada matchea "${texto}")`);
      }
    }

    const cabecera =
      coincidencias > 0
        ? `🧠 Encontré ${coincidencias} coincidencia(s) para "${texto}" en la biblioteca:`
        : `🧠 La biblioteca tiene esto (y "${texto}" no matchea nada todavía):`;
    return [cabecera, ...partes].join('\n');
  } catch (err) {
    return `🧠 La biblioteca no me contestó (${String(err)}) — ¿estará dormida?`;
  }
}

/** Una pasada de scroll por una colección (lee hasta 50 puntos, sin vectores). */
async function qdrantScroll(
  base: string,
  llave: string | undefined,
  coleccion: string
): Promise<{ id: unknown; payload?: unknown }[]> {
  const res = await fetch(
    `${base}/collections/${encodeURIComponent(coleccion)}/points/scroll`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(llave ? { 'api-key': llave } : {}),
      },
      body: JSON.stringify({ limit: 50, with_payload: true, with_vector: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    result?: { points?: { id: unknown; payload?: unknown }[] };
  };
  return data.result?.points ?? [];
}

// ---------------------------------------------------------------------------
// /traeme — MinIO (el depósito de archivos) 📦
// ---------------------------------------------------------------------------

interface Hallazgo {
  bucket: string;
  key: string;
  size: number;
  modified: string;
}

/**
 * Busca en MinIO (S3) los objetos cuyo nombre (o prefijo) matchee el texto.
 * v1: lista coincidencias y dice dónde están. v1.1 (próximo): adjunta el
 * archivo por Telegram.
 */
export async function traerDelDeposito(nombre: string): Promise<string> {
  const base = process.env.MINIO_ENDPOINT ?? 'http://127.0.0.1:9000';
  const ak = process.env.MINIO_ROOT_USER;
  const sk = process.env.MINIO_ROOT_PASSWORD;
  if (!ak || !sk) {
    return '📦 No tengo las llaves del depósito (MINIO_ROOT_USER/PASSWORD en .env) — avisale al taller.';
  }
  try {
    const buckets = await s3ListarBuckets(base, ak, sk);
    if (buckets.length === 0) {
      return '📦 El depósito está vacío, jefe — no hay ni un bucket todavía.';
    }

    const hallazgos: Hallazgo[] = [];
    for (const b of buckets.slice(0, 5)) {
      const objetos = await s3ListarObjetos(base, ak, sk, b, nombre);
      hallazgos.push(...objetos);
    }

    if (hallazgos.length === 0) {
      return `📦 No encontré nada con "${nombre}" en el depósito, jefe. 🤷`;
    }

    const lineas = hallazgos
      .slice(0, 8)
      .map(
        (h) =>
          `• ${h.bucket}/${h.key} — ${humano(h.size)} · ${h.modified.slice(0, 10)}`
      );
    const aviso =
      hallazgos.length > 8
        ? `  (y ${hallazgos.length - 8} más — acotá el nombre para afinar)`
        : '';
    return [
      `📦 Encontré ${hallazgos.length} archivo(s) para "${nombre}":`,
      ...lineas,
      aviso,
      '(v1.1 te los adjunto por acá mismo; hoy te digo dónde viven)',
    ]
      .filter((l) => l !== '')
      .join('\n');
  } catch (err) {
    return `📦 El depósito no me contestó (${String(err)}) — ¿estará dormido?`;
  }
}

/** GET firmado a MinIO; devuelve el cuerpo como texto (XML). */
async function s3Get(
  base: string,
  ak: string,
  sk: string,
  method: string,
  path: string,
  pares: [string, string][] = []
): Promise<string> {
  const host = base.replace(/^https?:\/\//, '');
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const params: FirmaV4Params = {
    method,
    host,
    path,
    queryPares: pares,
    extraHeaders: { 'x-amz-content-sha256': SHA_EMPTY },
    payloadHash: SHA_EMPTY,
    accessKey: ak,
    secretKey: sk,
    service: 's3',
    amzDate,
  };
  const { authz } = firmarV4(params);
  const qs = canonicalQuery(pares);
  const url = `${base}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: authz,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': SHA_EMPTY,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`S3 respondió ${res.status} (${path})`);
  }
  return res.text();
}

/** Lista los buckets (GET /) — parsea el XML de ListBuckets. */
async function s3ListarBuckets(base: string, ak: string, sk: string): Promise<string[]> {
  const xml = await s3Get(base, ak, sk, 'GET', '/');
  return [...xml.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1]);
}

/** Lista objetos con prefijo (GET /bucket?list-type=2&prefix=...) — ListObjectsV2. */
async function s3ListarObjetos(
  base: string,
  ak: string,
  sk: string,
  bucket: string,
  prefijo: string
): Promise<Hallazgo[]> {
  const path = `/${bucket}`;
  const xml = await s3Get(base, ak, sk, 'GET', path, [
    ['list-type', '2'],
    ['prefix', prefijo],
  ]);
  const hallazgos: Hallazgo[] = [];
  for (const bloque of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const contenido = bloque[1];
    const key = contenido.match(/<Key>([^<]*)<\/Key>/)?.[1] ?? '';
    const size = Number(contenido.match(/<Size>(\d+)<\/Size>/)?.[1] ?? '0');
    const modified = contenido.match(/<LastModified>([^<]*)<\/LastModified>/)?.[1] ?? '';
    if (key) hallazgos.push({ bucket, key, size, modified });
  }
  return hallazgos;
}

function humano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// /donde — Postgres (los registros) 🏛️
// ---------------------------------------------------------------------------

interface FilaDlq {
  id: string;
  eventType: string;
  errorCategory: string | null;
  failedAt: Date | null;
}

interface FilaOutbox {
  id: string;
  tipo: string;
  status: string | null;
  creado: Date | null;
}

/**
 * "¿Dónde vive esto en la base?" — v1:
 * 1) tablas cuyo nombre matchea (information_schema),
 * 2) columnas cuyo nombre matchea (information_schema),
 * 3) eventos del término en el cementerio (DLQ) y en la bandeja (outbox).
 * SELECTs predefinidas, parametrizadas ($1), con LIMIT. Solo lectura.
 */
export async function dondeEnLaBase(termino: string): Promise<string> {
  const url = process.env.ENCARGADO_DATABASE_URL;
  if (!url) {
    return '🏛️ No tengo ENCARGADO_DATABASE_URL en el entorno — avisale al taller.';
  }
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
  });
  try {
    await client.connect();
    const t = `%${termino}%`;

    const tablas = await client.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name
         FROM information_schema.tables
        WHERE table_schema IN ('public','audit','orchestrator')
          AND table_name ILIKE $1
        ORDER BY 1, 2
        LIMIT 15`,
      [t]
    );

    const columnas = await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_schema, table_name, column_name
         FROM information_schema.columns
        WHERE table_schema IN ('public','audit','orchestrator')
          AND column_name ILIKE $1
        ORDER BY 1, 2, 3
        LIMIT 15`,
      [t]
    );

    // DLQ: columnas probadas por el Ojo (watchman).
    const dlq = await client.query<FilaDlq>(
      `SELECT id,
              event_type     AS "eventType",
              error_category AS "errorCategory",
              failed_at      AS "failedAt"
         FROM orchestrator.dead_letter_queue
        WHERE event_type ILIKE $1 OR error_category ILIKE $1
        ORDER BY failed_at DESC
        LIMIT 5`,
      [t]
    );

    // Outbox: la columna de tipo puede llamarse event_type o type — se
    // detecta sola (y status/created_at si existen). Cero suposiciones.
    const colTipo = await columnaDeEvento(client);
    let outbox: { rows: FilaOutbox[] } = { rows: [] };
    if (colTipo) {
      const tieneStatus = await existeColumna(client, 'audit', 'outbox', 'status');
      const tieneCreado = await existeColumna(client, 'audit', 'outbox', 'created_at');
      const aliases = ['id', `${colTipo} AS tipo`];
      if (tieneStatus) aliases.push('status');
      if (tieneCreado) aliases.push('created_at AS creado');
      outbox = await client.query<FilaOutbox>(
        `SELECT ${aliases.join(', ')}
           FROM audit.outbox
          WHERE ${colTipo} ILIKE $1
          ORDER BY id
          LIMIT 5`,
        [t]
      );
    }

    const lineas: string[] = [`🏛️ "${termino}" en la base:`];
    lineas.push(
      `• Tablas: ${
        tablas.rows.length > 0
          ? tablas.rows.map((r) => `${r.table_schema}.${r.table_name}`).join(', ')
          : 'ninguna matchea'
      }`
    );
    lineas.push(
      `• Columnas: ${
        columnas.rows.length > 0
          ? columnas.rows
              .map((r) => `${r.table_schema}.${r.table_name}.${r.column_name}`)
              .join(', ')
          : 'ninguna matchea'
      }`
    );
    lineas.push(
      `• Cementerio (DLQ): ${
        dlq.rows.length > 0
          ? dlq.rows
              .map((r) => `${r.eventType} [${r.errorCategory ?? '?'}] ${fecha(r.failedAt)}`)
              .join(' · ')
          : 'nada con ese término'
      }`
    );
    if (colTipo) {
      lineas.push(
        `• Bandeja (outbox): ${
          outbox.rows.length > 0
            ? outbox.rows
                .map((r) => `${r.tipo} [${r.status ?? '?'}] ${fecha(r.creado)}`)
                .join(' · ')
            : 'nada con ese término'
        }`
      );
    }
    return lineas.join('\n');
  } catch (err) {
    return `🏛️ La base no me contestó (${String(err)}) — ¿estará dormida?`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** ¿Existe la columna? (information_schema — cero suposiciones). */
async function existeColumna(
  client: Client,
  schema: string,
  tabla: string,
  columna: string
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, tabla, columna]
  );
  return (r.rowCount ?? 0) > 0;
}

/** Nombre de la columna de tipo de audit.outbox (event_type o type), o null. */
async function columnaDeEvento(client: Client): Promise<string | null> {
  if (await existeColumna(client, 'audit', 'outbox', 'event_type')) return 'event_type';
  if (await existeColumna(client, 'audit', 'outbox', 'type')) return 'type';
  return null;
}

function fecha(f: Date | null): string {
  if (!f) return '?';
  try {
    return new Date(f).toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return '?';
  }
}
