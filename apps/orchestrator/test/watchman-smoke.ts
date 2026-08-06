/**
 * 🧪 Smoke test del Ojo (Empleado #0 — A1).
 *
 * Se corre a mano y NO toca nada (solo lectura):
 *   pnpm --filter @nexora/orchestrator exec tsx test/watchman-smoke.ts
 *
 * Mira la DLQ real una sola vez, reporta la cuenta y sale.
 * Esperado en sano: "🕊️ 0 muerto(s) — silencio correcto, la paz reina."
 */
import { Pool } from 'pg';
import { DlQWatchman } from '../src/vigilance/dlq.watchman.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://nexora_admin:nexora_pass_dev_123@localhost:5432/nexora_dev';

const logger = {
  info: (msg: string, meta?: unknown) => console.log('ℹ️ ', msg, meta ?? ''),
  warn: (msg: string, meta?: unknown) => console.log('⚠️ ', msg, meta ?? ''),
};

async function main(): Promise<void> {
  const db = new Pool({ connectionString });
  try {
    const watchman = new DlQWatchman(db, logger);
    const count = await watchman.checkOnce();
    if (count === 0) {
      console.log('🕊️ RESULTADO: 0 muerto(s) — silencio correcto, la paz reina.');
    } else {
      console.log(`🚨 RESULTADO: ${count} muerto(s) en la DLQ — el Ojo ladró arriba ☝️`);
    }
  } finally {
    await db.end();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('❌ smoke falló:', err);
    process.exit(1);
  }
);
