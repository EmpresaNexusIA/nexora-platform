/**
 * 🧔 EL ENCARGADO — la gramática v4 (con el CRM del fundador).
 *
 * Reglas, SIN IA: cero sorpresas. Lo que no sabe, lo dice honesto.
 * Solo-lectura sobre el ORGANISMO salvo las acciones aprobadas (A3).
 * El CRM (public.clientes) es herramienta del DUEÑO: solo el chat del
 * fundador (whitelist) puede usarlo — no es acción autónoma del empleado.
 *
 * Parto 1: /ayuda + /estado · Parto 2: /busca /traeme /donde.
 * A3: /muertos /enterrar /reintentar /prontuario + si/no.
 * v4: /clientes /nuevo-cliente /cliente /cliente-estado (CRM).
 *
 * Nota: las consultas corren secuenciales; si alguna tarda (timeout),
 * la oreja atiende la siguiente igual. Todo resuelve un mensaje.
 */

import { exec } from 'node:child_process';
import {
  buscarEnBiblioteca,
  traerDelDeposito,
  dondeEnLaBase,
} from './consultas.js';
import {
  listarMuertos,
  ejecutarEnterrar,
  ejecutarReintentar,
  verificarResultadosPendientes,
  verProntuario,
  resolverMuerto,
} from './acciones.js';
import { proponer, responder } from './aprobacion.js';
import type { Pedido } from './aprobacion.js';
import {
  listarClientes,
  nuevoCliente,
  detalleCliente,
  cambiarEstadoCliente,
} from './clientes.js';
import { Client } from 'pg';

const CARTA = `🧔 Encargado del taller — esto sé hacer (v4):

/estado — parte del organismo (pulso, cuartos, recursos)
/muertos — ⚰️ el cementerio (sin resolver)
/enterrar <id> · /reintentar <id> — acciones con tu si/no
/prontuario — 📜 acciones y su resultado
/clientes — 🗂️ la lista de clientes
/nuevo-cliente <nombre> | <rubro> | <tel> — 🗂️ agregar
/cliente <nombre> — 🗂️ ficha completa
/cliente-estado <nombre> <estado> — 🗂️ mover de etapa
/busca · /traeme · /donde — los cuartos
/ayuda — esta carta`;

export async function manejarComando(texto: string): Promise<string> {
  const limpio = texto.trim();
  const comando = limpio.toLowerCase();

  // Aprobación: ✅/❌ o si/sí/no (no son comandos)
  const rta = limpio.toLowerCase();
  if (limpio === '✅' || limpio === '❌' || rta === 'si' || rta === 'sí' || rta === 'no') {
    const res = responder(limpio);
    if (res.accion === 'ejecutar' && res.pedido) {
      return await ejecutarPedido(res.pedido);
    }
    return res.mensaje;
  }

  if (comando === '/ayuda' || comando === '/start') {
    return CARTA;
  }
  if (comando === '/estado') {
    await verificarResultadosPendientes();
    return await parteDelOrganismo();
  }
  if (comando === '/muertos') {
    const v = await verificarResultadosPendientes();
    const m = await listarMuertos();
    return v ? `${v}\n\n${m}` : m;
  }
  if (comando === '/prontuario') {
    const v = await verificarResultadosPendientes();
    const p = await verProntuario();
    return v ? `${v}\n\n${p}` : p;
  }
  if (comando === '/clientes') {
    return await listarClientes();
  }
  if (comando.startsWith('/nuevo-cliente')) {
    const arg = limpio.slice('/nuevo-cliente'.length).trim();
    if (!arg) return '📝 Para /nuevo-cliente: /nuevo-cliente <nombre> | <rubro> | <teléfono>';
    return await nuevoCliente(arg);
  }
  if (comando.startsWith('/cliente-estado')) {
    const arg = limpio.slice('/cliente-estado'.length).trim();
    // formato: <nombre o id> <estado> — el estado es la ÚLTIMA palabra
    const ultimoEspacio = arg.lastIndexOf(' ');
    if (ultimoEspacio <= 0) {
      return '📝 Para /cliente-estado: /cliente-estado <nombre> <estado> (nuevo|contactado|presupuestando|vendido|activo)';
    }
    const termino = arg.slice(0, ultimoEspacio).trim();
    const estado = arg.slice(ultimoEspacio + 1).trim();
    return await cambiarEstadoCliente(termino, estado);
  }
  if (comando.startsWith('/cliente')) {
    const arg = limpio.slice('/cliente'.length).trim();
    if (!arg) return '🗂️ Para /cliente: /cliente <nombre o id>';
    return await detalleCliente(arg);
  }
  if (comando.startsWith('/enterrar')) {
    const arg = limpio.slice('/enterrar'.length).trim();
    if (!arg) return '⚰️ Para /enterrar decime el id (de /muertos), jefe: /enterrar <id>';
    return await proponerAccion('enterrar', arg);
  }
  if (comando.startsWith('/reintentar')) {
    const arg = limpio.slice('/reintentar'.length).trim();
    if (!arg) return '🔄 Para /reintentar decime el id (de /muertos), jefe: /reintentar <id>';
    return await proponerAccion('reintentar', arg);
  }
  if (comando.startsWith('/busca')) {
    const arg = limpio.slice('/busca'.length).trim();
    if (!arg) return '📚 Para /busca decime qué buscar, jefe: /busca <texto>';
    return await buscarEnBiblioteca(arg);
  }
  if (comando.startsWith('/traeme')) {
    const arg = limpio.slice('/traeme'.length).trim();
    if (!arg) return '📦 Para /traeme decime el nombre, jefe: /traeme <nombre>';
    return await traerDelDeposito(arg);
  }
  if (comando.startsWith('/donde')) {
    const arg = limpio.slice('/donde'.length).trim();
    if (!arg) return '🏛️ Para /donde decime el término, jefe: /donde <término>';
    return await dondeEnLaBase(arg);
  }
  return 'Eso todavía no lo aprendí, jefe 🤔 — probá /ayuda';
}

/** Resuelve el id (corto o completo) y arma el pedido de aprobación. */
async function proponerAccion(
  tipo: 'enterrar' | 'reintentar',
  idOpcion: string
): Promise<string> {
  const url = process.env.DATABASE_URL;
  if (!url) return '🏛️ No tengo DATABASE_URL — avisale al taller.';
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
  });
  try {
    await client.connect();
    const resuelto = await resolverMuerto(client, idOpcion);
    if (!resuelto.ok) return resuelto.mensaje;
    const m = resuelto.muerto;
    const descripcion = `${m.eventType} [${m.errorCategory ?? '?'}] · ${String(m.id).slice(0, 8)}`;
    const { avisoCancelado } = proponer(tipo, m.id, descripcion);
    const verbo = tipo === 'enterrar' ? 'enterrar' : 'revivir (reintentar)';
    const pedidoTexto = `⚖️ ¿${verbo} este muerto? ${descripcion} — respondé si o no (expira en 2 min).`;
    return avisoCancelado ? `${avisoCancelado}\n\n${pedidoTexto}` : pedidoTexto;
  } catch (err) {
    return `🏛️ La base no me contestó (${String(err)}) — ¿estará dormida?`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Ejecuta el pedido aprobado (transaccional, auditado). */
async function ejecutarPedido(p: Pedido): Promise<string> {
  if (p.tipo === 'enterrar') {
    return await ejecutarEnterrar(p.dlqId, 'fundador');
  }
  return await ejecutarReintentar(p.dlqId, 'fundador');
}

/**
 * /estado — el parte del organismo: reutiliza al médico de la casa
 * (infra/scripts/healthcheck.sh). Si el médico encuentra algo feo,
 * el Encargado igual muestra el parte (para eso está).
 */
function parteDelOrganismo(): Promise<string> {
  const script = process.env.HEALTHCHECK_PATH ?? '../../infra/scripts/healthcheck.sh';
  return new Promise((resolve) => {
    exec(`bash ${script}`, { timeout: 90_000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      const salida = (stdout ?? '').trim();
      if (salida) {
        resolve(`🩺 Parte del organismo (médico de guardia):\n\n${salida}`);
      } else {
        resolve(`⚠️ El médico no pudo dar el parte: ${String(error)}`);
      }
    });
  });
}
