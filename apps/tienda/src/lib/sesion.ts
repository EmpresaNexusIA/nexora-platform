import "server-only";

// NEXORA · Sesión y "tienda actual" (server-only).
// DEMO_MODE=true  → sigue la tienda demo (panaderia-maria) sin login.
// DEMO_MODE distinto → exige cookie nx_session válida y deriva el comercio
//                   del tenant del JWT (regla N1: cada comercio lo suyo).
// Fail-closed (fix P1): demo solo con "true" explícito.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDB, ES_DEMO } from "./data";
import { verificarAccessToken } from "./jwt";
import type { SesionPlatform } from "./jwt";
import type { Comercio } from "./types";

export const COOKIE_SESION = "nx_session";

export async function getSesion(): Promise<SesionPlatform | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  return verificarAccessToken(token);
}

/** ¿El usuario tiene permisos de dueño? Tokens sin role → true (compat). */
export function esDueno(sesion: SesionPlatform | null): boolean {
  if (!sesion) return false;
  // Sin role claim = token anterior a 0013 → tratar como dueño (compatibilidad)
  if (!sesion.role) return true;
  return sesion.role === "Dueño";
}

/** Slug de la tienda actual: demo en preview, del tenant en producción. */
export async function getTiendaActual(): Promise<Comercio | null> {
  const db = await getDB();
  if (ES_DEMO) return db.getTiendaPorSlug("panaderia-maria");
  const ses = await getSesion();
  if (!ses || !db.getTiendaPorTenantId) return null;
  return db.getTiendaPorTenantId(ses.tenantId);
}

/** Guard para páginas del panel: sin tienda → login. (Los server actions
 *   NO usan esto: devuelven { ok:false } para no romper el flujo post.) */
export async function requireTiendaActual(): Promise<Comercio> {
  const t = await getTiendaActual();
  if (!t) redirect("/login");
  return t;
}
