/**
 * 🧔 EL ENCARGADO — A1.2 (Parto 1): la oreja Telegram. v1.2 (causa real)
 *
 * Escucha comandos del fundador por long-polling (la netbook SOLO SALE
 * a preguntar: cero puertas abiertas a internet, sin webhooks ni IP
 * pública) y responde por el mismo Mensajero v2 de la casa (reintentos).
 *
 * Historial de parches:
 * - v1.1 (review #5): try/catch alrededor de manejarComando Y de send():
 *   un mensaje-veneno NO puede trabar la oreja; el fundador siempre
 *   recibe respuesta (aunque sea la de error).
 * - v1.2 (8/8, cacería "fetch failed"): Node esconde la razón real de
 *   un fallo de red en err.cause (y sus errors[]). La oreja ahora lo
 *   declara con nombre y apellido al anotar el tropiezo, y saluda con
 *   la versión de Node que la corre (para que no haya testigos mudos).
 *   Comportamiento intacto: mismos reintentos, misma lista blanca,
 *   mismo offset. Solo más transparencia.
 *
 * REGLAS DEL CONTRATO (A1.2):
 * - Solo comandos del fundador: las escrituras CRM requieren su orden explicita.
 * - Lista blanca: solo responde al TELEGRAM_CHAT_ID del fundador.
 *   Cualquier otro chat = silencio (solo queda anotado).
 * - Offset en disco local (.encargado-offset.json, gitignored):
 *   los comandos ya atendidos no se repiten tras un reinicio.
 * - NUNCA imprimir token ni secretos: solo causas de red, sin sorpresas.
 */

import { createTelegramNotifier } from '../vigilance/telegram.notifier.js';
import type { TelegramNotifier } from '../vigilance/telegram.notifier.js';
import { manejarComando } from './commands.js';
import * as fs from 'node:fs';

interface TgMessage {
  chat: { id: number };
  text?: string;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}
interface LoggerMin {
  info: (mensaje: string, meta?: unknown) => void;
  warn: (mensaje: string, meta?: unknown) => void;
}

const dormir = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export class EncargadoListener {
  private corriendo = false;
  private offset: number;
  private readonly base: string;

  constructor(
    token: string,
    private readonly chatIdPermitido: string,
    private readonly notifier: TelegramNotifier,
    private readonly logger: LoggerMin,
    private readonly archivoOffset = '.encargado-offset.json'
  ) {
    this.base = `https://api.telegram.org/bot${token}`;
    this.offset = this.cargarOffset();
  }

  start(): void {
    this.corriendo = true;
    void this.bucle();
  }

  stop(): void {
    this.corriendo = false;
  }

  private async bucle(): Promise<void> {
    await this.prepararOffsetInicial();
    this.logger.info('🧔 Encargado: oreja puesta. Esperando comandos del fundador…', {
      node: process.version,
      execArgv: process.execArgv,
    });
    while (this.corriendo) {
      try {
        const updates = await this.pedirUpdates();
        for (const u of updates) {
          await this.atender(u);
          this.avanzarOffset(u.update_id);
        }
      } catch (err) {
        // Lección A1.1: un parpadeo de red NO tira al empleado.
        // v1.2: además de anotar el tropiezo, declara la causa REAL
        // (Node la esconde en err.cause y, a veces, en cause.errors[]).
        this.logger.warn('🧔 oreja tropieza (reintento en 3s):', String(err));
        this.declararCausa(err);
        await dormir(3000);
      }
    }
  }

  /** v1.2: traduce el "fetch failed" críptico a una causa con nombre. */
  private declararCausa(err: unknown): void {
    const causa = (err as { cause?: unknown }).cause;
    if (!causa) {
      this.logger.warn('   ↳ (sin causa escondida: el error es todo lo que hay)');
      return;
    }
    this.logger.warn('   ↳ causa real:', String(causa));
    const codigo = (causa as { code?: string }).code;
    if (codigo) {
      this.logger.warn('   ↳ código:', codigo);
    }
    const sub = (causa as { errors?: unknown[] }).errors;
    if (sub && sub.length > 0) {
      for (const s of sub) {
        this.logger.warn('     ↳ subcausa:', String(s));
      }
    }
  }

  private async pedirUpdates(): Promise<TgUpdate[]> {
    const res = await fetch(
      `${this.base}/getUpdates?offset=${this.offset}&timeout=25&limit=10`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!res.ok) throw new Error(`getUpdates respondió ${res.status}`);
    const data = (await res.json()) as { ok: boolean; result: TgUpdate[] };
    if (!data.ok) throw new Error('getUpdates ok=false');
    return data.result;
  }

  private async atender(u: TgUpdate): Promise<void> {
    const msg = u.message;
    if (!msg?.text) return;
    const quien = String(msg.chat.id);
    if (quien !== this.chatIdPermitido) {
      this.logger.warn('🧔 chat ajeno ignorado (no es el fundador).');
      return;
    }
    this.logger.info(`🧔 comando recibido: ${msg.text}`);

    // 🚨 Mensaje-veneno (review #5): un comando que explota adentro
    // NUNCA sale de esta función: la oreja sigue, el offset avanza
    // igual y el fundador recibe una respuesta humana del tropiezo.
    let respuesta: string;
    try {
      respuesta = await manejarComando(msg.text.trim());
    } catch (err) {
      this.logger.warn('🧔 ese comando se rompió adentro (la oreja NO se traba):', String(err));
      this.declararCausa(err);
      respuesta =
        '🧔 Algo se rompió procesando ese comando, jefe — quedó anotado y sigo de guardia. 🫡';
    }

    // El envío también va blindado: si Telegram cae duro, se anota,
    // se descarta ESTA respuesta y la oreja avanza igual.
    try {
      await this.notifier.send(respuesta);
      this.logger.info('🧔 respuesta enviada al bolsillo 📱');
    } catch (err) {
      this.logger.warn('🧔 no pude mandar la respuesta (descartada, sigo):', String(err));
    }
  }

  // ---- offset (memoria de "hasta cuál atendí") ----

  private cargarOffset(): number {
    try {
      const raw = fs.readFileSync(this.archivoOffset, 'utf8');
      return (JSON.parse(raw) as { offset: number }).offset;
    } catch {
      return -1; // sin archivo: primera vuelta (ver prepararOffsetInicial)
    }
  }

  private guardarOffset(): void {
    fs.writeFileSync(this.archivoOffset, JSON.stringify({ offset: this.offset }));
  }

  private avanzarOffset(updateId: number): void {
    this.offset = updateId + 1;
    this.guardarOffset();
  }

  private async prepararOffsetInicial(): Promise<void> {
    if (this.offset >= 0) return;
    // Primera vuelta de la vida: no responder historial viejo del chat.
    try {
      const res = await fetch(`${this.base}/getUpdates?offset=-1&limit=1`, {
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json()) as { ok: boolean; result: TgUpdate[] };
      this.offset = data.ok && data.result.length > 0
        ? data.result[data.result.length - 1].update_id + 1
        : 0;
    } catch {
      this.offset = 0;
    }
    this.guardarOffset();
  }
}

export function crearEncargado(logger: LoggerMin): EncargadoListener | null {
  const notifier = createTelegramNotifier();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!notifier || !token || !chatId) return null;
  return new EncargadoListener(token, chatId, notifier, logger);
}
