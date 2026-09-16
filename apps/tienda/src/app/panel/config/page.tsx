// NEXORA · Panel → Configurar Tienda (diseño+tema, descuentos, entrega, suscripción)
import { getDB } from "@/lib/data";
import { ConfigClient } from "./ConfigClient";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const db = await getDB();
  const tienda = await db.getTiendaPorSlug("panaderia-maria");
  if (!tienda) return null;
  return <ConfigClient tienda={tienda} />;
}
