import crypto from "node:crypto";
import type { Redis } from "ioredis";

export interface ActivationTokenPayload {
  clientId: string;
  tenantId: string;
  userId: string;
  purpose: "account_activation";
  createdAt: string;
}

const TOKEN_TTL_SECONDS = 48 * 60 * 60; // 48 horas

export async function createActivationToken(
  redis: Redis,
  payload: { clientId: string; tenantId: string; userId: string },
): Promise<{ token: string; hash: string }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

  // Si existe una invitación previa para el mismo usuario, se invalida el token anterior
  const existingHashKey = `user_activation:${payload.userId}`;
  const existingHash = await redis.get(existingHashKey);
  if (existingHash) {
    await redis.del(`activation_token:${existingHash}`);
  }

  const tokenPayload: ActivationTokenPayload = {
    clientId: payload.clientId,
    tenantId: payload.tenantId,
    userId: payload.userId,
    purpose: "account_activation",
    createdAt: new Date().toISOString(),
  };

  const tokenKey = `activation_token:${hash}`;
  await redis.set(tokenKey, JSON.stringify(tokenPayload), "EX", TOKEN_TTL_SECONDS);
  await redis.set(existingHashKey, hash, "EX", TOKEN_TTL_SECONDS);

  return { token: rawToken, hash };
}

export async function consumeActivationToken(
  redis: Redis,
  rawToken: string,
): Promise<ActivationTokenPayload | null> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const tokenKey = `activation_token:${hash}`;

  const luaScript = `
    local val = redis.call('GET', KEYS[1])
    if val then
      redis.call('DEL', KEYS[1])
    end
    return val
  `;

  const rawPayload = (await redis.eval(luaScript, 1, tokenKey)) as string | null;
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as ActivationTokenPayload;
    if (parsed.purpose !== "account_activation") {
      return null;
    }

    if (parsed.userId) {
      await redis.del(`user_activation:${parsed.userId}`).catch(() => {});
    }

    return parsed;
  } catch {
    return null;
  }
}
