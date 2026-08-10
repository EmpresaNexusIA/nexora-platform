/**
 * 🧪 TESTIGO MÍNIMO (experimento bisectriz, 9/8 madrugada) — TEMPORAL.
 * Corre al Encargado A1.2 SOLO, sin los otros inquilinos del index.ts
 * (sin EventDispatcher, sin Pool, sin Ojo). Si acá la oreja funciona,
 * el poltergeist del "fetch ETIMEDOUT" está en uno de los compañeros
 * de cuarto del index.ts, no en el Encargado.
 *
 *   pnpm exec tsx --env-file ../../.env src/probar-oreja.ts
 *
 * Probar: mandar /ayuda desde el teléfono del fundador.
 * Cerrar: clic en la terminal (suelta selección) y Ctrl+C.
 * ESTE ARCHIVO ES TEMPORAL: no va al sello del Parto 1;
 * al final del diagnóstico se archiva o borra, según decida el fundador.
 */

import { crearEncargado } from './encargado/telegram.listener.js';

const log = {
  info: (m: string, meta?: unknown): void => console.log('[info]', m, meta ?? ''),
  warn: (m: string, meta?: unknown): void => console.warn('[warn]', m, meta ?? ''),
};

const oreja = crearEncargado(log);

if (!oreja) {
  console.warn('PROBE: faltan TELEGRAM_* en .env — nada que probar.');
} else {
  oreja.start();
  console.log('PROBE: oreja sola ACTIVA — mandá /ayuda al bot y mirá la consola 👀');

  process.once('SIGINT', (): void => {
    oreja.stop();
    console.log('PROBE: despedida caballera 👋');
    process.exit(0);
  });
}
