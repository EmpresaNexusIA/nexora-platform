// NEXORA · Panel → Catálogo (switch de stock + alta rápida)
import { getDB } from "@/lib/data";
import { CatalogoClient } from "./CatalogoClient";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const db = await getDB();
  const tienda = await db.getTiendaPorSlug("panaderia-maria");
  if (!tienda) return null;
  const [productos, categorias] = await Promise.all([
    db.getProductos(tienda.id),
    db.getCategorias(tienda.id),
  ]);
  return <CatalogoClient productos={productos} categorias={categorias} tienda={tienda} />;
}
