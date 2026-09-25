// NEXORA · Panel → Configurar Tienda (diseño+tema, descuentos, entrega, suscripción)
import { getDB, ES_DEMO } from "@/lib/data";
import { ConfigClient } from "./ConfigClient";
import { requireTiendaActual, getSesion, esDueno } from "@/lib/sesion";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  // U2: la configuración es del dueño — empleados sin permisos → pedidos.
  if (!ES_DEMO) {
    const sesion = await getSesion();
    if (!esDueno(sesion)) redirect("/panel/pedidos");
  }
  const db = await getDB();
  const tienda = await requireTiendaActual();
  if (!tienda) return null;
  return <ConfigClient tienda={tienda} />;
}
