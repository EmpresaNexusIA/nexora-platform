// NEXORA · /api/sesion — materializa la sesión como cookie httpOnly de
// ESTE dominio (la API entrega el JWT por body; la tienda lo fija acá,
// así funciona aunque api y panel vivan en dominios distintos).

import { NextResponse } from "next/server";
import { verificarAccessToken } from "@/lib/jwt";

const COOKIE_SESION = "nx_session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.accessToken === "string" ? body.accessToken : "";
  const sesion = token ? await verificarAccessToken(token) : null;
  if (!sesion) {
    return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, tenantId: sesion.tenantId });
  res.cookies.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // la validez real la manda el exp del JWT
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_SESION);
  return res;
}
