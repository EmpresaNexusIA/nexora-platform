/**
 * 🧔 Smoke de las consultas del Encargado (Parto 2).
 *
 * Uso (desde apps/orchestrator):
 *   npx tsx --env-file=../../.env test/consultas-smoke.ts busca  <texto>
 *   npx tsx --env-file=../../.env test/consultas-smoke.ts traeme <nombre>
 *   npx tsx --env-file=../../.env test/consultas-smoke.ts donde  <término>
 *
 * Solo lectura. No toca Telegram (no hay conflicto con la oreja).
 */

import {
  buscarEnBiblioteca,
  traerDelDeposito,
  dondeEnLaBase,
} from '../src/encargado/consultas.js';

const [, , tipo, ...resto] = process.argv;
const texto = resto.join(' ');

if (!tipo || !texto) {
  console.log('Uso: consultas-smoke.ts <busca|traeme|donde> <texto>');
  process.exit(1);
}

const fn =
  tipo === 'busca'
    ? buscarEnBiblioteca
    : tipo === 'traeme'
      ? traerDelDeposito
      : tipo === 'donde'
        ? dondeEnLaBase
        : null;

if (!fn) {
  console.log(`Tipo desconocido: ${tipo} (usá busca | traeme | donde)`);
  process.exit(1);
}

console.log(await fn(texto));
