// NEXORA · Verificación de tokens de la plataforma (Edge-compatible).
// Usa SOLO la clave PÚBLICA RS256 (env JWT_PUBLIC_KEY) — nunca la privada.
// Claims esperados (apps/api/lib/jwt.ts): { sub: userId, tenantId, type: "access" }

import { jwtVerify, importSPKI } from "jose";

export interface SesionPlatform {
  userId: string;
  tenantId: string;
}

export async function verificarAccessToken(token: string): Promise<SesionPlatform | null> {
  try {
    const pem = (process.env.JWT_PUBLIC_KEY || "").replace(/\\n/g, "\n");
    if (!pem.includes("BEGIN PUBLIC KEY")) return null;
    const key = await importSPKI(pem, "RS256");
    const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"] });
    if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.tenantId !== "string") {
      return null;
    }
    return { userId: payload.sub, tenantId: payload.tenantId };
  } catch {
    return null; // expirado, firma inválida, malformado → siempre null, nunca throw
  }
}
