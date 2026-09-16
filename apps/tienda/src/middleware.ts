// NEXORA · Guard del panel (Edge): /panel/* exige nx_session válida.
// La tienda pública, el checkout y el seguimiento quedan ABERTOS (regla
// del producto: el cliente final compra sin login).

import { NextRequest, NextResponse } from "next/server";
import { verificarAccessToken } from "@/lib/jwt";

const COOKIE_SESION = "nx_session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarAccessToken(token) : null;
  if (sesion) return NextResponse.next();

  // Sin sesión (o vencida) → login con retorno
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  const res = NextResponse.redirect(url);
  if (token) res.cookies.delete(COOKIE_SESION); // limpia la expirada
  return res;
}

export const config = {
  matcher: ["/panel/:path*"],
};
