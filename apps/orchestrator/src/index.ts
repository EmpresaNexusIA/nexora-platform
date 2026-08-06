import { EventDispatcher } from './core/event.dispatcher.js';
import { Pool } from 'pg';
import { DlQWatchman } from './vigilance/dlq.watchman.js';

// ... otros imports existentes ...

const dispatcher = new EventDispatcher();

// Registro condicional para suite de validación

if (process.env.NODE_ENV === 'test') {

  console.log("[Testing] Registrando TestHandler para suite de validación");

}

// ============================================================
// 👁️ EMPLEADO #0 — A1: enchufe del Ojo de la DLQ (2026-08-06)
// Mira y AVISA. Nunca escribe ni toca la DLQ (eso es A2/A3).
//
// LLAVE DE ENCENDIDO (por seguridad, apagado por defecto):
//     DLQ_WATCHMAN=on pnpm exec tsx src/index.ts
// Opcional:
//     DLQ_WATCH_MS=60000      (intervalo; default 300000 = 5 min)
//     DATABASE_URL=postgres://...  (default: dev local)
// ============================================================

if (process.env.DLQ_WATCHMAN === 'on' && process.env.NODE_ENV !== 'test') {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://nexora_admin:nexora_pass_dev_123@localhost:5432/nexora_dev',
  });

  // Logger mínimo (TODO deuda conocida: enchufar al logger real del core).
  const logger = {
    info: (message: string, meta?: unknown) => console.log('[info]', message, meta ?? ''),
    warn: (message: string, meta?: unknown) => console.warn('[warn]', message, meta ?? ''),
  };

  const watchman = new DlQWatchman(
    pool,
    logger,
    Number(process.env.DLQ_WATCH_MS ?? 300_000)
  );
  watchman.start();
  console.log('👁️ Empleado #0 (A1): vigilancia de la DLQ ACTIVA.');

  // Apagado limpio: soltar la vigilancia y la base como un caballero.
  const apagar = async (): Promise<void> => {
    watchman.stop();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);
} else {
  console.log('👁️ Empleado #0 (A1) en reposo — prender con DLQ_WATCHMAN=on');
}

// ... resto de tu inicialización ...
