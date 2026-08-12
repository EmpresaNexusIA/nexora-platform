/**
 * 🗂️ EL ENCARGADO — CRM del fundador: public.clientes (migración 0004).
 *
 * El lugar blindado (RLS + FORCE, ADR-0008) para guardar los clientes
 * que consigue el frente comercial. Semilla del CRM de Nexora.
 *
 * NOTA DE CONTRATO: esto NO es una acción autónoma del empleado — es la
 * interfaz del sistema para su DUEÑO (el fundador guarda su gestión por
 * Telegram). El "solo lectura" del A1.2 protege el organismo (eventos,
 * DLQ); el CRM es herramienta del dueño, y solo el chat del fundador
 * (whitelist) puede usarla.
 *
 * Reglas: estados cerrados (CHECK en la base + validación acá), todo
 * parametrizado, timeouts, y siempre respuestas honestas.
 */

import { Client } from 'pg';

const TIMEOUT_MS = 15_000;
const ESTADOS = ['nuevo', 'contactado', 'presupuestando', 'vendido', 'activo'] as const;

interface ClienteFila {
  id: string;
  nombre: string;
  rubro: string | null;
  direccion: string | null;
  telefono: string | null;
  tieneWeb: boolean;
  servicioVendido: string | null;
  estado: string;
  notas: string | null;
  creadoEn: Date;
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

/** 📋 /clientes — la lista (últimos 15, los más recientes primero). */
export async function listarClientes(): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const r = await client.query<{ id: string; nombre: string; rubro: string | null; estado: string }>(
      `SELECT id, nombre, rubro, estado
         FROM public.clientes
        ORDER BY creado_en DESC
        LIMIT 15`
    );
    if (r.rows.length === 0) {
      return '🗂️ Todavía no hay clientes guardados, jefe. Agregá el primero con /nuevo-cliente.';
    }
    const emoji = (e: string) =>
      e === 'vendido' || e === 'activo' ? '🟢' : e === 'presupuestando' ? '🟡' : e === 'contactado' ? '🔵' : '⚪';
    const lineas = r.rows.map(
      (c) => `${emoji(c.estado)} ${String(c.id).slice(0, 8)} — ${c.nombre} [${c.rubro ?? '?'}] (${c.estado})`
    );
    return ['🗂️ Clientes (últimos 15):', ...lineas].join('\n');
  } catch (err) {
    return `🏛️ La base no me contestó (${String(err)})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** ➕ /nuevo-cliente <nombre> | <rubro> | <teléfono> — agrega uno. */
export async function nuevoCliente(linea: string): Promise<string> {
  const partes = linea.split('|').map((p) => p.trim());
  const nombre = partes[0] ?? '';
  const rubro = partes[1] ?? null;
  const telefono = partes[2] ?? null;
  if (!nombre) {
    return '📝 Para /nuevo-cliente necesito al menos el nombre, jefe: /nuevo-cliente <nombre> | <rubro> | <teléfono>';
  }
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const r = await client.query<{ id: string }>(
      `INSERT INTO public.clientes (nombre, rubro, telefono)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [nombre, rubro, telefono]
    );
    return `🗂️ Cliente agregado: ${nombre}${rubro ? ` [${rubro}]` : ''}${telefono ? ` · ${telefono}` : ''} — estado: nuevo (${String(r.rows[0].id).slice(0, 8)}).`;
  } catch (err) {
    return `🏛️ No pude guardarlo (${String(err)})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** 🔍 /cliente <nombre o id> — la ficha completa. */
export async function detalleCliente(termino: string): Promise<string> {
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const r = await client.query<ClienteFila>(
      `SELECT id,
              nombre,
              rubro,
              direccion,
              telefono,
              tiene_web       AS "tieneWeb",
              servicio_vendido AS "servicioVendido",
              estado,
              notas,
              creado_en       AS "creadoEn"
         FROM public.clientes
        WHERE nombre ILIKE $1 OR id::text LIKE $2
        ORDER BY creado_en DESC
        LIMIT 5`,
      [`%${termino}%`, `${termino}%`]
    );
    if (r.rows.length === 0) {
      return `🗂️ No encontré ningún cliente con "${termino}", jefe.`;
    }
    if (r.rows.length > 1) {
      return `🗂️ Hay ${r.rows.length} clientes que matchean "${termino}" — pasame uno más exacto:\n${r.rows
        .map((c) => `• ${String(c.id).slice(0, 8)} — ${c.nombre}`)
        .join('\n')}`;
    }
    const c = r.rows[0];
    return [
      `🗂️ ${c.nombre}`,
      `   Rubro: ${c.rubro ?? '—'}`,
      `   Dirección: ${c.direccion ?? '—'}`,
      `   Teléfono: ${c.telefono ?? '—'}`,
      `   ¿Tiene web? ${c.tieneWeb ? 'Sí' : 'No'}`,
      `   Servicio: ${c.servicioVendido ?? 'ninguno'}`,
      `   Estado: ${c.estado}`,
      `   Notas: ${c.notas ?? '—'}`,
      `   (${String(c.id).slice(0, 8)})`,
    ].join('\n');
  } catch (err) {
    return `🏛️ La base no me contestó (${String(err)})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** 🔄 /cliente-estado <nombre o id> <estado> — mueve de etapa. */
export async function cambiarEstadoCliente(termino: string, estado: string): Promise<string> {
  const e = estado.trim().toLowerCase();
  if (!(ESTADOS as readonly string[]).includes(e)) {
    return `📝 Los estados válidos son: ${ESTADOS.join(', ')}.`;
  }
  const client = await conectar().catch(() => null);
  if (!client) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  try {
    const r = await client.query<{ id: string; nombre: string }>(
      `UPDATE public.clientes
          SET estado = $1, actualizado_en = now()
        WHERE nombre ILIKE $2 OR id::text LIKE $3
        RETURNING id, nombre`,
      [e, `%${termino}%`, `${termino}%`]
    );
    const filas = r.rowCount ?? 0;
    if (filas === 0) {
      return `🗂️ No encontré ningún cliente con "${termino}", jefe.`;
    }
    if (filas > 1) {
      return `🗂️ Hay ${filas} clientes que matchean "${termino}" — pasame uno más exacto.`;
    }
    return `🗂️ ${r.rows[0].nombre} → estado: ${e} ✅`;
  } catch (err) {
    return `🏛️ No pude actualizar (${String(err)})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}
