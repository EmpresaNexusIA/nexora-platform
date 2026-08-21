import { describe, it, expect, beforeEach } from "vitest";
import {
  createActivationToken,
  consumeActivationToken,
} from "../lib/activation-token.js";

class MemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<"OK" | null> {
    const expiresAt =
      mode === "EX" && duration ? Date.now() + duration * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async eval(script: string, numkeys: number, key: string): Promise<string | null> {
    const val = await this.get(key);
    if (val) {
      await this.del(key);
    }
    return val;
  }

  forceExpire(key: string) {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() - 1000;
    }
  }
}

describe("Activation Token Lifecycle (Redis Unit Tests)", () => {
  let redis: MemoryRedis;

  beforeEach(() => {
    redis = new MemoryRedis();
  });

  it("Genera un token válido de 32 bytes en base64url y guarda su hash en Redis", async () => {
    const payload = {
      clientId: "00000000-0000-0000-0000-000000000001",
      tenantId: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000003",
    };

    const { token } = await createActivationToken(redis as any, payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThanOrEqual(40);

    const consumed = await consumeActivationToken(redis as any, token);
    expect(consumed).not.toBeNull();
    expect(consumed?.clientId).toBe(payload.clientId);
    expect(consumed?.tenantId).toBe(payload.tenantId);
    expect(consumed?.userId).toBe(payload.userId);
    expect(consumed?.purpose).toBe("account_activation");
  });

  it("Retorna null para un token inexistente", async () => {
    const consumed = await consumeActivationToken(
      redis as any,
      "token_inexistente_12345678901234567890",
    );
    expect(consumed).toBeNull();
  });

  it("Retorna null para un token vencido (expired)", async () => {
    const payload = {
      clientId: "00000000-0000-0000-0000-000000000001",
      tenantId: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000003",
    };

    const { token } = await createActivationToken(redis as any, payload);
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(token).digest("hex");

    redis.forceExpire(`activation_token:${hash}`);

    const consumed = await consumeActivationToken(redis as any, token);
    expect(consumed).toBeNull();
  });

  it("Impide el reuso de un token ya consumido (consumo único)", async () => {
    const payload = {
      clientId: "00000000-0000-0000-0000-000000000001",
      tenantId: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000003",
    };

    const { token } = await createActivationToken(redis as any, payload);

    const firstAttempt = await consumeActivationToken(redis as any, token);
    expect(firstAttempt).not.toBeNull();

    const secondAttempt = await consumeActivationToken(redis as any, token);
    expect(secondAttempt).toBeNull();
  });

  it("Al reemitir un token para el mismo usuario, invalida la invitación anterior", async () => {
    const payload = {
      clientId: "00000000-0000-0000-0000-000000000001",
      tenantId: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000003",
    };

    const first = await createActivationToken(redis as any, payload);
    const second = await createActivationToken(redis as any, payload);

    const firstConsumed = await consumeActivationToken(redis as any, first.token);
    expect(firstConsumed).toBeNull();

    const secondConsumed = await consumeActivationToken(redis as any, second.token);
    expect(secondConsumed).not.toBeNull();
    expect(secondConsumed?.userId).toBe(payload.userId);
  });
});
