// NEXORA · /api/sesion — materializa la sesión como cookies httpOnly de
// ESTE dominio (la API entrega los JWT por body; la tienda los fija acá,
// así funciona aunque api y panel vivan en dominios distintos: los
// consumidores cross-dominio no leen las cookies de la API).

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
  if (refreshToken) {
    // Revocación en la plataforma: fire-and-forget con forward de la cookie
    // refresh_token. NUNCA falla el logout local (lo que importa es borrar
    // las cookies de este dominio; si la API está caída, el access expira solo).
    const api = process.env.NEXT_PUBLIC_API_URL || "";
    void fetch(`${api}/logout`, {
      method: "POST",
      headers: { cookie: `refresh_token=${refreshToken}` },
    }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_SESION);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}
