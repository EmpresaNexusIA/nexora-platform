/**
 * 📱 Prueba del canal Telegram (A1.1): manda UN mensaje real a tu celular.
 *
 * Se corre desde apps/orchestrator:
 *   pnpm exec tsx --env-file ../../.env test/telegram-smoke.ts
 *
 * OK: suena el teléfono con 🩺 NEXORA — prueba del canal de alertas.
 * El token jamás se imprime: viaja del .env a Telegram, sin escalas.
 */
import { createTelegramNotifier } from '../src/vigilance/telegram.notifier.js';

async function main(): Promise<void> {
  const notifier = createTelegramNotifier();
  if (!notifier) {
    console.error(
      '❌ Faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID en el entorno.\n' +
        '   ¿Corriste con --env-file ../../.env desde apps/orchestrator?'
    );
    process.exit(1);
  }

  await notifier.send(
    '🩺 NEXORA — prueba del canal de alertas.\n' +
      'Si leés esto, el Ojo te llega al bolsillo 👁️📱'
  );
  console.log('✅ mensaje enviado — mirá tu Telegram 📱');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('❌ falló el envío:', err);
    process.exit(1);
  }
);
