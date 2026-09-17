// NEXORA · Guard del panel (Edge): /panel/* exige nx_session válida.
// La tienda pública, el checkout y el seguimiento quedan ABERTOS (regla
// del producto: el cliente final compra sin login).
//
// Fase 1.6 — renovación silenciosa: access vencido + nx_refresh presente →
// POST /refresh server-side (timeout 5 s, una API lenta no frena el render)
// → el access nuevo SE REVALIDA con la clave pública → redirect a la misma
// URL con cookies nuevas. Cualquier fallo → /login?next=... sin cookies.

import { NextRequest, NextResponse } from "next/server";
import { verificarAccessToken } from "@/lib/jwt";

const COOKIE_SESION = "nx_session";
const COOKIE_REFRESH = "nx_refresh";
const API = process.env.NEXT_PUBLIC_API_URL || "";

/** Al login con retorno, limpiando ambas cookies. */
function irALogin(req: NextRequest) {
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  const res = NextResponse.redirect(url);
  res.cookies.delete(COOKIE_SESION);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}

export async function middleware(req: NextRequest) {
  // Demo sin backend: el panel es abierto (doc FASE15) y no hay API contra
  // la cual renovar — sin esto la preview queda trabada en /login.
  if (process.env.DEMO_MODE !== "false") return NextResponse.next();

  const access = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = access ? await verificarAccessToken(access) : null;
  if (sesion) return NextResponse.next();

  // Access inválido/vencido: intentamos renovación silenciosa si hay refresh.
  const refresh = req.cookies.get(COOKIE_REFRESH)?.value;
  if (!refresh) return irALogin(req);

  let nuevo: { accessToken?: unknown; refreshToken?: unknown } | null = null;
  try {
    const r = await fetch(`${API}/refresh`, {
      method: "POST",
      headers: { cookie: `refresh_token=${refresh}` },
      signal: AbortSignal.timeout(5000), // 5 s máximo (Edge + Node >= 17.3)
    });
    if (r.ok) nuevo = await r.json().catch(() => null);
  } catch {
    // timeout (abort) o API caída → sigue con nuevo = null → login
  }

  const nuevoAccess = typeof nuevo?.accessToken === "string" ? nuevo.accessToken : "";
  const nuevoRefresh = typeof nuevo?.refreshToken === "string" ? nuevo.refreshToken : "";
  // El access nuevo no se confía a ciegas: se revalida con la clave pública.
  const sesionNueva = nuevoAccess ? await verificarAccessToken(nuevoAccess) : null;
  if (!sesionNueva) return irALogin(req);

  // Renovación OK → a la MISMA URL (pathname + search) con cookies nuevas.
  // TODOS los atributos van explícitos en cada set (no se hereda nada del
  // POST de /api/sesion): sin path: "/" la cookie quedaría scoped al
  // directorio del request (p. ej. /panel) y el DELETE /api/sesion del
  // logout no recibiría nx_refresh → la revocación fallaría en silencio.
  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set(COOKIE_SESION, nuevoAccess, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // la validez real la manda el exp del JWT
  });
  if (nuevoRefresh) {
    // El refresh nunca necesita viajar cross-site → SameSite=Strict
    res.cookies.set(COOKIE_REFRESH, nuevoRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return res;
}

export const config = {
  matcher: ["/panel/:path*"],
};
