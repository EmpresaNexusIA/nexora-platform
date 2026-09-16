// NEXORA · Motor de dinero — REGLA N6 (núcleo crítico del negocio)
// Este archivo es PURO (sin IO): se usa igual en el cliente (desglose visible)
// y en el servidor (recálculo obligatorio antes de grabar). El SQL
// crear_pedido() en Supabase replica EXACTAMENTE esta lógica.

import type { Comercio, DesgloseCarrito, MetodoPagoId, ModoEntregaId } from "./types";
export { };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function vigente(desde: string | null, hasta: string | null, hoy: Date = new Date()): boolean {
  const d = hoy.toISOString().slice(0, 10);
  if (desde && d < desde) return false;
  if (hasta && d > hasta) return false;
  return true;
}

/** dto por método de pago (con vigencia por fechas — fix M5) */
export function descuentoPorPago(tienda: Comercio, metodo: MetodoPagoId, hoy = new Date()): number {
  if (!tienda.metodoDescuento || tienda.metodoDescuento === "ninguno") return 0;
  if (tienda.porcentajeDescuento <= 0) return 0;
  if (metodo !== tienda.metodoDescuento) return 0;
  return vigente(tienda.dtoDesde, tienda.dtoHasta, hoy) ? tienda.porcentajeDescuento : 0;
}

/**
 * Desglose completo del carrito.
 * @param dtoVipPct % VIP del cliente frecuente en ESTA tienda (0 si no aplica)
 */
export function computeDesglose(params: {
  tienda: Comercio;
  lineas: { precio: number; cantidad: number }[];
  modoEntrega: ModoEntregaId;
  metodoPago: MetodoPagoId;
  dtoVipPct: number;
  hoy?: Date;
}): DesgloseCarrito {
  const { tienda, lineas, modoEntrega, metodoPago, dtoVipPct, hoy = new Date() } = params;

  const subtotal = round2(lineas.reduce((a, l) => a + l.precio * l.cantidad, 0));
  const envio = round2(modoEntrega === "envio" ? (tienda.costoEnvio || 0) : 0);

  const dtoPago = descuentoPorPago(tienda, metodoPago, hoy);
  const dtoVip = Math.max(0, dtoVipPct || 0);

  let aplicado = 0;
  let regla: DesgloseCarrito["regla"] = "ninguna";

  if (tienda.acumularDescuentos) {
    // SÍ acumula: suma con TOPE (fix M6) y aviso si lo alcanza
    const suma = dtoVip + dtoPago;
    aplicado = Math.min(suma, tienda.topeDescuento || 100);
    if (aplicado > 0) regla = suma > aplicado ? "acumulado_tope" : "acumulado";
  } else {
    // NO acumula: Max() — la mejor para el cliente, y se AVISA cuál aplicó
    aplicado = Math.max(dtoVip, dtoPago);
    if (aplicado > 0) regla = dtoVip >= dtoPago ? "vip" : "pago";
  }

  const base = subtotal; // NUNCA incluir el envío (N6)
  const descuento = round2((base * aplicado) / 100);
  const total = round2(subtotal + envio - descuento);

  return { subtotal, envio, dtoVip, dtoPago, dtoAplicadoPct: aplicado, descuento, total, regla };
}

export const textoRegla = (r: DesgloseCarrito["regla"]): string =>
  r === "vip"
    ? "Descuento cliente frecuente"
    : r === "pago"
      ? "Descuento por método de pago"
      : r === "acumulado"
        ? "Descuentos acumulados"
        : r === "acumulado_tope"
          ? "Descuento máximo alcanzado 🎉"
          : "Sin descuento";
