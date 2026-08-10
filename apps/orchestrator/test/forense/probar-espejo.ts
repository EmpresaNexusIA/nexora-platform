/**
 * 🧪 ESPEJO EN ARCHIVO (experimento bisectriz-2, 9/8 ~01:30) — TEMPORAL.
 *
 * La misma coreografía del Encargado (fetch a Telegram con token del .env),
 * pero en un archivo .ts del proyecto con CERO imports del proyecto.
 * Objetivo: separar "ejecutar ARCHIVO" de "importar módulos del proyecto".
 *
 *   vía tsx:        pnpm exec tsx --env-file ../../.env src/probar-espejo.ts
 *   vía node pelado: pnpm exec node --env-file ../../.env \
 *                      --experimental-strip-types src/probar-espejo.ts
 *
 * No imprime secretos: el token solo viaja por dentro de la URL.
 * Cerrar: clic en la terminal y Ctrl+C (o termina solo, es finito).
 */

const base = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const probar = async (nombre: string, url: string, ms: number): Promise<boolean> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    await res.text();
    console.log(`OK   ${nombre} -> ${res.status}`);
    return true;
  } catch (err) {
    console.log(`FAIL ${nombre} -> ${String(err)}`);
    const c = (err as { cause?: { errors?: unknown[] } }).cause;
    if (c) {
      console.log(`      causa: ${String(c)}`);
      if (c.errors) for (const x of c.errors) console.log(`       sub: ${String(x)}`);
    }
    return false;
  }
};

const main = async (): Promise<void> => {
  console.log('ESPEJO: arrancando (cero imports del proyecto)…');
  await probar('PLANO     ', 'https://api.telegram.org/', 15000);
  await probar('getMe     ', `${base}/getMe`, 15000);
  await probar('offset    ', `${base}/getUpdates?offset=-1&limit=1`, 15000);
  await probar('longpoll-1', `${base}/getUpdates?offset=0&timeout=25&limit=10`, 30000);
  await probar('longpoll-2', `${base}/getUpdates?offset=0&timeout=25&limit=10`, 30000);
  console.log('ESPEJO: cerrado. 👋');
};

void main();
