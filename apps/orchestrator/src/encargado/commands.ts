/**
 * 🧔 EL ENCARGADO — A1.2 (Parto 1): la gramática v1.
 *
 * Reglas, SIN IA: cero sorpresas. Lo que no sabe, lo dice honesto.
 * Solo-lectura por construcción: acá no hay un solo INSERT/UPDATE/DELETE,
 * ni lo va a haber en este nivel de la escalera.
 *
 * Parto 1: /ayuda + /estado (el médico en el teléfono).
 * Parto 2 (próximo): /busca (Qdrant) · /traeme (MinIO) · /donde (Postgres).
 */

import { exec } from 'node:child_process';

const CARTA = `🧔 Encargado del taller — esto sé hacer (v1):

/estado — parte del organismo al teléfono (pulso, cuartos, recursos)
/ayuda — esta carta

Muy pronto (Parto 2): /busca · /traeme · /donde`;

export async function manejarComando(texto: string): Promise<string> {
  const comando = texto.trim().toLowerCase();

  if (comando === '/ayuda' || comando === '/start') {
    return CARTA;
  }
  if (comando === '/estado') {
    return await parteDelOrganismo();
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
