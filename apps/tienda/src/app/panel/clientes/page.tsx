// NEXORA · Panel → Clientes (frecuentes/VIP — fix M4: acá se marca quién es VIP)
import { getDB } from "@/lib/data";
import { ClientesClient } from "./ClientesClient";
import { requireTiendaActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const db = await getDB();
  const tienda = await requireTiendaActual();
  if (!tienda) return null;
  const clientes = await db.getClientes(tienda.id);
  return <ClientesClient clientes={clientes} umbral={tienda.umbralFrecuente} />;
}
