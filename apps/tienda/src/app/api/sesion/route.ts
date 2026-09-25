// NEXORA · /api/sesion — materializa la sesión como cookies httpOnly de
// ESTE dominio (la API entrega los JWT por body; la tienda los fija acá,
// así funciona aunque api y panel vivan en dominios distintos: los
// consumidores cross-dominio no leen las cookies de la API).
//
// Fase BFF (fix 6b): el login de la UI pasó a usar /api/login (BFF), donde
// el refresh nunca toca JavaScript. Esta ruta queda como compatibilidad
// para consumidores que ya tengan ambos tokens (y mantiene la misma
// validación).

import { NextRequest, NextResponse } from "next/server";
import { verificarAccessToken, verificarRefreshToken } from "@/lib/jwt";

// Sin exports: Next solo permite exportar handlers en los route files.
const COOKIE_SESION = "nx_session";
const COOKIE_REFRESH = "nx_refresh";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";

  // Ambos se validan con la clave pública RS256 antes de fijar cookies.
  const [sesion, refreshValido] = await Promise.all([
    accessToken ? verificarAccessToken(accessToken) : null,
    refreshToken ? verificarRefreshToken(refreshToken) : null,
  ]);
  if (!sesion || !refreshValido) {
    return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });
  }

  // Fix de seguridad #5: el access y el refresh deben pertenecer al MISMO
  // usuario y tenant — impide armar una sesión "híbrida" con tokens de dos
  // sesiones distintas (p. ej. refresh robado de otra cuenta).
  if (
    refreshValido.userId !== sesion.userId ||
    refreshValido.tenantId !== sesion.tenantId
  ) {
    return NextResponse.json({ ok: false, error: "Sesión inválida" }, { status: 401 });
  }

  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // la validez real la manda el exp del JWT
  } as const;

  const res = NextResponse.json({ ok: true, tenantId: sesion.tenantId });
  res.cookies.set(COOKIE_SESION, accessToken, { ...base, sameSite: "lax" });
  // El refresh nunca necesita viajar cross-site → SameSite=Strict
  res.cookies.set(COOKIE_REFRESH, refreshToken, { ...base, sameSite: "strict" });
  return res;
}

export async function DELETE(req: NextRequest) {
  const refreshToken = req.cookies.get(COOKIE_REFRESH)?.value;
  let revocacion = "ok";
  if (refreshToken) {
    // Revocación en la plataforma con forward de la cookie refresh_token.
    // Se ESPERA la respuesta: en Vercel la función serverless puede terminar
    // antes de que complete un fetch no esperado y la revocación en Redis
    // quedaría sin hacerse.
    const api = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const r = await fetch(`${api}/logout`, {
        method: "POST",
        headers: { cookie: `refresh_token=${refreshToken}` },
      });
      if (!r.ok) revocacion = "failed";
    } catch {
      revocacion = "failed";
    }
  }

  // Fix 6a: el logout local NUNCA falla (se borran las cookies de este
  // dominio) — pero si la revocación en la API falló, la respuesta lo
  // avisa (warning) y se loguea: el refresh en Redis podría seguir vivo
  // (hasta su rotación/expiry), y un cliente atento puede volver a hacer
  // logout o reportar la anomalía.
  const res =
    revocacion === "ok"
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: true, warning: "revocation_failed" });
  if (revocacion !== "ok") {
    console.warn(
      "[sesion] Revocación en la API falló — el refresh en Redis puede seguir vigente (fix 6a)",
    );
  }
  res.cookies.delete(COOKIE_SESION);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}
