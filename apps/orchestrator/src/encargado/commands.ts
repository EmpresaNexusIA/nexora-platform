/**
 * 🧔 EL ENCARGADO — A1.2 (Parto 2): la gramática v2.
 *
 * Reglas, SIN IA: cero sorpresas. Lo que no sabe, lo dice honesto.
 * Solo-lectura por construcción: acá no hay un solo INSERT/UPDATE/DELETE,
 * ni lo va a haber en este nivel de la escalera.
 *
 * Parto 1: /ayuda + /estado (el médico en el teléfono).
 * Parto 2: /busca (Qdrant) · /traeme (MinIO) · /donde (Postgres).
 *
 * Nota: las consultas corren secuenciales; si alguna tarda (timeout 15s),
 * la oreja atiende la siguiente igual. Todo resuelve un mensaje.
 */

import { exec } from 'node:child_process';
import {
  buscarEnBiblioteca,
  traerDelDeposito,
  dondeEnLaBase,
} from './consultas.js';

const CARTA = `🧔 Encargado del taller — esto sé hacer (v2):

/estado — parte del organismo al teléfono (pulso, cuartos, recursos)
/busca <texto> — 🧠 en la biblioteca (Qdrant, por significado)
/traeme <nombre> — 📦 del depósito (MinIO, archivos)
/donde <término> — 🏛️ en la base (Postgres, registros)
/ayuda — esta carta`;

export async function manejarComando(texto: string): Promise<string> {
  const comando = texto.trim().toLowerCase();

  if (comando === '/ayuda' || comando === '/start') {
    return CARTA;
  }
  if (comando === '/estado') {
    return await parteDelOrganismo();
  }
  if (comando.startsWith('/busca')) {
    const arg = texto.trim().slice(6).trim();
    if (!arg) return '📚 Para /busca decime qué buscar, jefe: /busca <texto>';
    return await buscarEnBiblioteca(arg);
  }
  if (comando.startsWith('/traeme')) {
    const arg = texto.trim().slice(7).trim();
    if (!arg) return '📦 Para /traeme decime el nombre, jefe: /traeme <nombre>';
    return await traerDelDeposito(arg);
  }
  if (comando.startsWith('/donde')) {
    const arg = texto.trim().slice(6).trim();
    if (!arg) return '🏛️ Para /donde decime el término, jefe: /donde <término>';
    return await dondeEnLaBase(arg);
  }
  return 'Eso todavía no lo aprendí, jefe 🤔 — probá /ayuda';
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
