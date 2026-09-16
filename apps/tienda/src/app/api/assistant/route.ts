// NEXORA · API del asistente (cliente + vendedor)
// Contrato estable: el front y la app futura consumen ESTE endpoint;
// adentro puede vivir el motor de reglas (hoy) o un LLM (mañana).

import { NextResponse } from "next/server";
import { getDB } from "@/lib/data";
import { responderCliente, responderVendedor, buildSystemPrompt } from "@/lib/assistant/engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const audiencia = body.audiencia === "vendedor" ? "vendedor" : "cliente";
    const mensaje = String(body.mensaje || "").slice(0, 500);
    if (!mensaje.trim()) {
      return NextResponse.json({ ok: false, error: "Mensaje vacío" }, { status: 400 });
    }

    const db = await getDB();
    // En demo, la única tienda es Panadería María; con Supabase, por slug.
    const slug = String(body.slug || "panaderia-maria");
    const tienda = await db.getTiendaPorSlug(slug);
    if (!tienda) return NextResponse.json({ ok: false, error: "Tienda no encontrada" }, { status: 404 });

    const productos = await db.getProductos(tienda.id);
    const ctx = { tienda, productos };

    let respuesta;
    if (audiencia === "vendedor") {
      const [caja, pedidos] = await Promise.all([db.getCaja(tienda.id), db.getPedidos(tienda.id)]);
      respuesta = responderVendedor({ ...ctx, caja, pedidos }, mensaje);
    } else {
      // Modo LLM (futuro): si está configurado, acá iría la llamada con
      // buildSystemPrompt(ctx, audiencia). Hoy: reglas + contexto.
      void buildSystemPrompt;
      respuesta = responderCliente(ctx, mensaje);
    }

    return NextResponse.json({ ok: true, ...respuesta });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "No pude responder. Probá de nuevo." },
      { status: 500 },
    );
  }
}
