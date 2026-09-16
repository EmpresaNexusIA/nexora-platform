// NEXORA · Panel → Pedidos (pestaña crítica del vendedor)
import { getDB } from "@/lib/data";
import { PedidosClient } from "./PedidosClient";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const db = await getDB();
  const tienda = await db.getTiendaPorSlug("panaderia-maria");
  if (!tienda) return null;
  const pedidos = await db.getPedidos(tienda.id);
  return <PedidosClient pedidos={pedidos} tienda={tienda} />;
}
