import { EventDispatcher } from './core/event.dispatcher.js';
import { Pool } from 'pg';
import { DlQWatchman } from './vigilance/dlq.watchman.js';
import { createTelegramNotifier } from './vigilance/telegram.notifier.js';
import { crearEncargado } from './encargado/telegram.listener.js';
import { crearEngine } from './core/engine.js';
import { Logger } from './core/logger.js';

const dispatcher = new EventDispatcher();

// Registro condicional para suite de validación

if (process.env.NODE_ENV === 'test') {
  console.log('[Testing] Registrando TestHandler para suite de validación');
}

// ============================================================
// 👋 APAGADO COMPARTIDO (review #5): UNA sola despedida.
// Antes: dos process.on('SIGINT') competían y el sync del Encargado
// cortaba el pool.end() async del Ojo (portazo para Postgres).
// Ahora: cada empleado anota su limpieza en alApagar y UN handler único
// espera TODAS antes de un único process.exit(0). Despedida educada.
// ============================================================

const alApagar: Array<() => Promise<void> | void> = [];
let salidaPedida = false;

const apagarTodo = async (): Promise<void> => {
  if (salidaPedida) return; // una sola despedida, aunque repitan la señal
  salidaPedida = true;
  console.log('\n👋 Apagado caballero: cerrando todo con calma…');
  for (const tarea of alApagar) {
    try {
      await tarea();
    } catch (err) {
      console.warn('despedida con tropiezo (se continúa igual):', String(err));
    }
  }
  process.exit(0);
};

process.once('SIGINT', apagarTodo);
process.once('SIGTERM', apagarTodo);

// ============================================================
// 👁️ EMPLEADO #0 — A1.1: enchufe del Ojo + canal Telegram 📨
// Mira y AVISA. Nunca escribe ni toca la DLQ (eso es A2/A3).
//
// LLAVE DE ENCENDIDO (por seguridad, apagado por defecto):
//   DLQ_WATCHMAN=on pnpm exec tsx --env-file ../../.env src/index.ts
// Opcionales:
//   DLQ_WATCH_MS=60000      (intervalo; default 300000 = 5 min)
//   DATABASE_URL=postgres://...  (default: dev local)
//   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID  (en .env → avisos al bolsillo;
//                                           si faltan, queda en modo mudo)
// REGLA DE ORO: el token vive SOLO en el .env. Jamás en código/chats.
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

  const notifier = createTelegramNotifier();
  console.log(
    notifier
      ? '📨 Canal Telegram: LISTO (avisos al bolsillo 📱).'
      : '📨 Canal Telegram: mudo (faltan TELEGRAM_* en .env — solo ladrido local).'
  );

  const watchman = new DlQWatchman(
    pool,
    logger,
    Number(process.env.DLQ_WATCH_MS ?? 300_000),
    notifier
  );
  watchman.start();
  console.log('👁️ Empleado #0 (A1.1): vigilancia de la DLQ ACTIVA.');

  // El Ojo anota su despedida en el apagado compartido (ver arriba):
  // suelta la vigilancia y se despide de la base con pool.end() real.
  alApagar.push(async (): Promise<void> => {
    watchman.stop();
    await pool.end();
    console.log('👁️ Ojo: vigilancia suelta, base despedida.');
  });
} else {
  console.log('👁️ Empleado #0 (A1.1) en reposo — prender con DLQ_WATCHMAN=on');
}

// ============================================================
// 🧔 EL ENCARGADO — A1.2 (Parto 1): oreja Telegram + /ayuda + /estado
// Escucha comandos del fundador (long-polling, solo salida) y responde.
// SOLO-LECTURA por contrato: nunca escribe ni toca el organismo.
//
// LLAVE DE ENCENDIDO (apagado por defecto): ENCARGADO=on
//   ENCARGADO=on pnpm exec tsx --env-file ../../.env src/index.ts
//   (combinable con el Ojo: DLQ_WATCHMAN=on ENCARGADO=on ...)
// Requiere TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID en .env.
// Su despedida también va por el apagado compartido (ver arriba).
// ============================================================

if (process.env.ENCARGADO === 'on' && process.env.NODE_ENV !== 'test') {
  const loggerMin = {
    info: (message: string, meta?: unknown) => console.log('[info]', message, meta ?? ''),
    warn: (message: string, meta?: unknown) => console.warn('[warn]', message, meta ?? ''),
  };
  const encargado = crearEncargado(loggerMin);
  if (!encargado) {
    console.warn('🧔 Encargado: faltan TELEGRAM_* en .env — queda en reposo.');
  } else {
    encargado.start();
    console.log('🧔 Encargado (A1.2): oreja ACTIVA — esperando comandos del fundador 📱');
    // El Encargado anota su despedida en el apagado compartido:
    alApagar.push((): void => {
      encargado.stop();
      console.log('🧔 Encargado: oreja guardada (offset ya en disco).');
    });
  }
} else {
  console.log('🧔 Encargado (A1.2) en reposo — prender con ENCARGADO=on');
}

// ============================================================
// 🚂 EL MOTOR SP3 — la ignición que faltaba (llave WORKER=on)
// El motor (Worker, Processor, RetryManager, Idempotencia) ya existía
// pero nunca se instanciaba: index.ts era un andamio. Ahora se enciende
// con su propia llave, apagado por defecto (regla de la casa: ni CI ni
// arranques accidentales quedan colgados).
//   WORKER=on pnpm exec tsx --env-file ../../.env src/index.ts
// Opcionales: WORKER_BATCH (10) · WORKER_INTERVAL_MS (5000)
// ============================================================

if (process.env.WORKER === 'on' && process.env.NODE_ENV !== 'test') {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://nexora_admin:nexora_pass_dev_123@localhost:5432/nexora_dev',
  });
  const logger = new Logger();
  const engine = crearEngine(pool, logger);
  engine.start();
  console.log('🚂 Motor SP3: ENCENDIDO (worker real leyendo el outbox).');
  alApagar.push(async (): Promise<void> => {
    await engine.stop();
    await pool.end();
    console.log('🚂 Motor: apagado, base despedida.');
  });
} else {
  console.log('🚂 Motor SP3 en reposo — prender con WORKER=on');
}

// ... resto de tu inicialización ...
