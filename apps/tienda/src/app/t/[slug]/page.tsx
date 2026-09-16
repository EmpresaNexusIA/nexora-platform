// NEXORA · Tienda pública /t/[slug] — escaparate del comercio
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDB } from "@/lib/data";
import { StoreClient } from "@/components/tienda/StoreClient";
import { descuentoPorPago } from "@/lib/money";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const db = await getDB();
  const t = await db.getTiendaPorSlug(params.slug);
  if (!t) return { title: "Tienda no disponible" };
  return {
    title: `${t.nombre} · Pedidos online`,
    description: t.descripcion || `Pedí online en ${t.nombre}. ${t.rubro}.`,
    openGraph: {
      title: `${t.nombre} ${t.logoEmoji}`,
      description: t.descripcion,
      type: "website",
    },
  };
}

export default async function TiendaPage({ params }: { params: { slug: string } }) {
  const db = await getDB();
  const [tienda] = await Promise.all([db.getTiendaPorSlug(params.slug)]);
  if (!tienda || !tienda.publicada) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">🛍️</div>
        <h1 className="mt-4 text-xl font-black">Esta tienda está pausada o no existe</h1>
        <p className="mt-2 text-sm text-slate-500">
          Si sos el dueño, revisá tu panel: puede estar sin publicar o en pausa temporal.
        </p>
      </main>
    );
  }

  const [productos, categorias] = await Promise.all([
    db.getProductos(tienda.id),
    db.getCategorias(tienda.id),
  ]);
  await db.registrarVisita(tienda.slug);
  const dtoPago = descuentoPorPago(tienda, tienda.metodoDescuento as never);

  return (
    <StoreClient
      tienda={tienda}
      productos={productos}
      categorias={categorias}
      dtoPagoPublic={dtoPago}
    />
  );
}
