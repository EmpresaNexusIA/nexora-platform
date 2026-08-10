/**
 * 🧪 ESPEJO INFINITO (experimento final, 9/8 madrugada) — TEMPORAL.
 *
 * Hace EXACTAMENTE lo que hace la oreja del Encargado, pero con
 * CERO imports del proyecto:
 *   - offset real (leído afuera y pasado por env OFFSET)
 *   - long-poll t=25, limit=10, AbortSignal 30s
 *   - loop SIN FIN; si tropieza: causa escrita + 3s de respiro y sigue
 *
 *   cd apps/orchestrator
 *   OFFSET=$(node -e "console.log(JSON.parse(require(\"fs\").readFileSync(\".encargado-offset.json\",\"utf8\")).offset)") \
 *   && OFFSET=$OFFSET pnpm exec tsx --env-file ../../.env src/probar-infinito.ts
 *
 * Observar ~2 minutos. Cerrar: clic en la terminal y Ctrl+C.
 */

const base = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
let offset = Number(process.env.OFFSET ?? 0);
let ciclo = 0;

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const correr = async (): Promise<void> => {
  console.log(`INFINITO: arrancando con offset=${offset} — loop t=25 para siempre ♾️`);
  while (true) {
    ciclo += 1;
    const empezo = Date.now();
    try {
      const res = await fetch(
        `${base}/getUpdates?offset=${offset}&timeout=25&limit=10`,
        { signal: AbortSignal.timeout(30_000) }
      );
      const data = (await res.json()) as {
        ok: boolean;
        result: Array<{ update_id: number }>;
      };
      const n = data.result?.length ?? 0;
      if (n > 0) offset = data.result[n - 1].update_id + 1;
      const segs = ((Date.now() - empezo) / 1000).toFixed(1);
      console.log(`ciclo ${ciclo}: OK ${res.status} updates=${n} (${segs}s)`);
    } catch (err) {
      const segs = ((Date.now() - empezo) / 1000).toFixed(1);
      console.log(`ciclo ${ciclo}: FAIL (${segs}s) ${String(err)}`);
      const c = (err as { cause?: { errors?: unknown[] } }).cause;
      if (c) {
        console.log(`       causa: ${String(c)}`);
        if (c.errors) for (const x of c.errors) console.log(`        sub: ${String(x)}`);
      }
      await dormir(3000);
    }
  }
};

void correr();
