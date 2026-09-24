// NEXORA · Verificación de tokens de la plataforma (Edge-compatible).
// Usa SOLO la clave PÚBLICA RS256 (env JWT_PUBLIC_KEY) — nunca la privada.
// Claims esperados (apps/api/lib/jwt.ts): { sub: userId, tenantId,
//   type: "access" | "refresh", role?: "Dueño" | "Empleado" }

import { jwtVerify, importSPKI } from "jose";

export interface SesionPlatform {
  userId: string;
  tenantId: string;
  // U2: undefined = token anterior a 0013 → compat dueño (ver esDueno)
  role?: "Dueño" | "Empleado" | string;
}

/** Verificación interna común (firma RS256 + claims de plataforma). Todo fallo → null. */
async function verificarTokenPlataforma(
  token: string,
): Promise<{ sub: string; tenantId: string; type: string; role?: string } | null> {
  try {
    const pem = (process.env.JWT_PUBLIC_KEY || "").replace(/\\n/g, "\n");
    if (!pem.includes("BEGIN PUBLIC KEY")) return null;
    const key = await importSPKI(pem, "RS256");
    const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.type !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      type: payload.type,
      role: payload.role as string | undefined,
    };
  } catch {
    return null; // expirado, firma inválida, malformado → siempre null, nunca throw
  }
}

/** Token de acceso (type "access") verificado con la clave pública. */
export async function verificarAccessToken(token: string): Promise<SesionPlatform | null> {
  const datos = await verificarTokenPlataforma(token);
  if (!datos || datos.type !== "access") return null;
  return { userId: datos.sub, tenantId: datos.tenantId, role: datos.role };
}

/** Token de refresco (type "refresh") verificado con la clave pública. */
export async function verificarRefreshToken(token: string): Promise<SesionPlatform | null> {
  const datos = await verificarTokenPlataforma(token);
  if (!datos || datos.type !== "refresh") return null;
  return { userId: datos.sub, tenantId: datos.tenantId, role: datos.role };
}
