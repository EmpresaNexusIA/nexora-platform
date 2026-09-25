// NEXORA · /api/login — BFF de login (fix 6b, mini-fase "BFF de login").
// El navegador manda SOLO email+password; el JWT se obtiene en el SERVER
// (Node → apps/api /login) y las cookies se fijan acá. El refresh token
// NUNCA toca JavaScript (el flujo viejo lo pasaba por el browser:
// /login → /api/sesion; hoy existe el XSS surface mínimo que corresponde).
// Misma validación que /api/sesion: ambos tokens con la clave pública y
// del mismo usuario/tenant antes de fijar cookies.

import { NextRequest, NextResponse } from "next/server";
import { verificarAccessToken, verificarRefreshToken } from "@/lib/jwt";

// Sin exports: Next solo permite exportar handlers en los route files.
const COOKIE_SESION = "nx_session";
const COOKIE_REFRESH = "nx_refresh";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Credenciales requeridas" }, { status: 400 });
  }

  // Server → server: el password viaja Node → API (misma red/dominio),
  // nunca se expone en el bundle ni en el JS de la página.
  const api = process.env.NEXT_PUBLIC_API_URL || "";
  let r: Response;
  try {
    r = await fetch(`${api}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Sin conexión con el servidor" },
      { status: 502 },
    );
  }

  if (r.status === 401) {
    return NextResponse.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });
  }
  if (r.status === 403) {
    return NextResponse.json({ ok: false, error: "Usuario inactivo" }, { status: 403 });
  }
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 502 });
  }

  const j = await r.json().catch(() => null);
  const accessToken = typeof j?.accessToken === "string" ? j.accessToken : "";
  const refreshToken = typeof j?.refreshToken === "string" ? j.refreshToken : "";

  // El BFF no confía a ciegas: ambos tokens se revalidan con la clave
  // pública (misma regla que /api/sesion) y deben ser del mismo usuario/tenant.
  const [sesion, refreshValido] = await Promise.all([
    accessToken ? verificarAccessToken(accessToken) : null,
    refreshToken ? verificarRefreshToken(refreshToken) : null,
  ]);
  if (
    !sesion ||
    !refreshValido ||
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
