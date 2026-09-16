"use server";

// NEXORA · Server Actions — único punto de escritura de la app.
// Toda mutación pasa por acá → va al adaptador (demo/Supabase) → hidrata UI.

import { revalidatePath } from "next/cache";
import { getDB, ES_DEMO } from "./data";
import { notificarPedidoNuevo } from "./notificar";
import type { EstadoPedido, MetodoPagoId, ModoEntregaId, LineaCarrito, TemaId } from "./types";
import type { Comercio } from "./types";

const baseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";

// Dirección del comercio demo (en producción: desde auth/sesión)
export async function getTiendaActual() {
  const db = await getDB();
  // DEMO: una sola tienda. REAL: comercio del usuario autenticado (RLS).
  return db.getTiendaPorSlug("panaderia-maria");
}

// ---------- Pedidos ----------
export async function crearPedidoAction(params: {
  slug: string;
  lineas: LineaCarrito[];
  cliente: { nombre: string; email: string; telefono: string };
  modoEntrega: ModoEntregaId;
  direccionEntrega: string;
  notasCliente: string;
  metodoPago: MetodoPagoId;
}) {
  const db = await getDB();
  const res = await db.crearPedido({ ...params, baseUrl: baseUrl() });
  if (res.ok) {
    revalidatePath("/panel/pedidos");
    revalidatePath(`/t/${params.slug}`);
    // Push al vendedor — nunca bloquea ni rompe el pedido
    try {
      const tienda = await db.getTiendaPorSlug(params.slug);
      if (tienda && res.pedido) {
        await notificarPedidoNuevo({ pedido: res.pedido, items: res.items, tienda });
      }
    } catch {
      /* las notificaciones no tiran el checkout abajo */
    }
    // FUTURO (Fase 3): Email B1/D1 + generar PDF del comprobante.
  }
  return res;
}

export async function cambiarEstadoAction(pedidoId: string, nuevo: EstadoPedido, reintegrarStock: boolean) {
  const db = await getDB();
  const res = await db.cambiarEstado(pedidoId, nuevo, reintegrarStock);
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/caja");
  return res;
}

export async function marcarPagadoAction(pedidoId: string, v: boolean) {
  const db = await getDB();
  await db.marcarPagado(pedidoId, v);
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/caja");
  return { ok: true };
}

// ---------- Catálogo ----------
export async function toggleDisponibleAction(productoId: string, v: boolean) {
  const db = await getDB();
  await db.setDisponible(productoId, v);
  const t = await getTiendaActual();
  if (t) revalidatePath(`/t/${t.slug}`);
  revalidatePath("/panel/catalogo");
  return { ok: true };
}

export async function crearProductoAction(form: FormData) {
  const t = await getTiendaActual();
  if (!t) return { ok: false, error: "Sin tienda" };
  const db = await getDB();
  const nombre = String(form.get("nombre") || "").trim();
  const precio = Number(form.get("precio") || 0);
  const emoji = String(form.get("emoji") || "🛍️").slice(0, 4);
  const stockStr = String(form.get("stock") || "").trim();
  if (nombre.length < 2) return { ok: false, error: "Poné un nombre (mínimo 2 letras)." };
  if (!isFinite(precio) || precio <= 0) return { ok: false, error: "Poné un precio mayor a 0." } ;
  let fotos: string[] = [];
  try {
    const raw = String(form.get("fotos") || "");
    const arr = raw ? JSON.parse(raw) : [];
    fotos = Array.isArray(arr) ? arr.filter((u) => typeof u === "string" && u.startsWith("/uploads/")).slice(0, 3) : [];
  } catch { fotos = []; }
  const res = await db.crearProducto({
    comercioId: t.id, nombre, precio, emoji, fotos,
    categoriaId: String(form.get("categoriaId") || "") || null,
    stockNumerico: stockStr === "" ? null : Math.max(0, parseInt(stockStr)),
  });
  revalidatePath("/panel/catalogo");
  if (t) revalidatePath(`/t/${t.slug}`);
  return res;
}

// ---------- Clientes ----------
export async function setFrecuenteAction(id: string, esFrecuente: boolean, descuento: number) {
  const db = await getDB();
  await db.setFrecuente(id, esFrecuente, Math.max(0, Math.min(90, descuento || 0)));
  revalidatePath("/panel/clientes");
  return { ok: true };
}

// ---------- Configuración ----------
export async function guardarConfigAction(patch: Partial<Comercio>) {
  const t = await getTiendaActual();
  if (!t) return { ok: false, error: "Sin tienda" };
  const db = await getDB();
  // Whitelist de seguridad: solo estos campos se pueden tocar desde el panel
  const permitidos: (keyof Comercio)[] = [
    "diseno", "tema", "metodoDescuento", "porcentajeDescuento", "dtoDesde", "dtoHasta",
    "acumularDescuentos", "topeDescuento", "umbralFrecuente",
    "modoEntrega", "costoEnvio", "dirRetiro", "horarios", "linkPago", "descripcion", "whatsapp",
  ];
  const limpio: Partial<Comercio> = {};
  for (const k of permitidos) if (patch[k] !== undefined) (limpio as Record<string, unknown>)[k] = patch[k];
  // Normalizaciones
  if (limpio.porcentajeDescuento !== undefined) {
    limpio.porcentajeDescuento = Math.max(0, Math.min(90, Number(limpio.porcentajeDescuento) || 0));
  }
  if (limpio.topeDescuento !== undefined) {
    limpio.topeDescuento = Math.max(0, Math.min(100, Number(limpio.topeDescuento) || 0));
  }
  if (limpio.costoEnvio !== undefined) {
    limpio.costoEnvio = Math.max(0, Number(limpio.costoEnvio) || 0);
  }
  await db.updateComercio(t.id, limpio);
  revalidatePath("/panel/config");
  revalidatePath(`/t/${t.slug}`);
  return { ok: true };
}

// NOTA Next.js: en archivos "use server" SOLO se exportan funciones async.
// Constantes/tipos van en lib/constants.ts o lib/types.ts.
