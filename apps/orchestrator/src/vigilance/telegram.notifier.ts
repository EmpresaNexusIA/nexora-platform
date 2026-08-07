/**
 * 📨 El Mensajero v2 — Empleado #0 (A1.1): canal de alertas Telegram.
 *
 * REGLA DE ORO DE LA CASA: el token vive SOLO en el .env
 * (jamás en código, jamás en un chat, jamás en un documento).
 * Si faltan credenciales, el mensajero queda MUDO (modo seguro).
 *
 * Lección 2026-08-07 (ceremonia 2.0): una pavadita de WiFi tumbó UN fetch
 * (TypeError: fetch failed). Un canal de alertas NO se cae por un
 * parpadeo → reintentos con pequeña espera (1.5s, 3s) antes de rendirse.
 */

export interface TelegramNotifier {
  send(text: string): Promise<void>;
}

export class HttpTelegramNotifier implements TelegramNotifier {
  private readonly base: string;

  constructor(
    token: string,
    private readonly chatId: string
  ) {
    this.base = `https://api.telegram.org/bot${token}`;
  }

  private async intentarUnaVez(text: string): Promise<void> {
    const res = await fetch(`${this.base}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text }),
    });
    if (!res.ok) {
      throw new Error(`Telegram respondió ${res.status}`);
    }
  }

  async send(text: string, intentos = 3): Promise<void> {
    let ultimoError: unknown;
    for (let i = 1; i <= intentos; i++) {
      try {
        await this.intentarUnaVez(text);
        return;
      } catch (err) {
        ultimoError = err;
        if (i < intentos) {
          // espera corta y creciente: 1.5s, luego 3s (traga parpadeos de red)
          await new Promise((r) => setTimeout(r, 1500 * i));
        }
      }
    }
    throw new Error(`Telegram falló tras ${intentos} intentos: ${String(ultimoError)}`);
  }
}

/**
 * Fábrica segura: mensajero real si el .env tiene sus 2 llaves,
 * o null (mudo) si falta algo. Nunca rompe la app por falta de config.
 */
export function createTelegramNotifier(
  env: NodeJS.ProcessEnv = process.env
): TelegramNotifier | null {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return new HttpTelegramNotifier(token, chatId);
}
