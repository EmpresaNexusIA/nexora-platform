// NEXORA · WhatsApp via wa.me (fix M8: wa.me NO adjunta archivos —
// el comprobante viaja como LINK dentro del texto). MVP sin API paga.

import type { Comercio, ItemPedido, Pedido } from "./types";
import { fmtMoney } from "./format";
import { soloDigitos } from "./format";

export function mensajePedido(p: Pedido, items: ItemPedido[], t: Comercio, urlPdf: string): string {
  const lineas = items
    .map((i) => `• ${i.cantidad}x ${i.nombreCongelado} — ${fmtMoney(i.subtotal, t.moneda)}`)
    .join("\n");
  return [
    `Hola ${t.nombre}! 👋 Pedido ${p.numeroOrden}`,
    ``,
    lineas,
    ``,
    p.descuentoAplicado > 0 ? `Subtotal: ${fmtMoney(p.subtotal, t.moneda)}` : "",
    costEnvio0(p) ? "" : `Envío: ${fmtMoney(p.costoEnvio, t.moneda)}`,
    p.descuentoAplicado > 0 ? `Descuento: -${fmtMoney(p.descuentoAplicado, t.moneda)}` : "",
    `TOTAL: ${fmtMoney(p.totalFinal, t.moneda)}`,
    ``,
    `Pago: ${p.metodoPago} · ${p.modoEntrega === "envio" ? "Envío a " + p.direccionEntrega : "Retiro"}`,
    p.notasCliente ? `Nota: ${p.notasCliente}` : "",
    ``,
    `Comprobante: ${urlPdf}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function waLink(numeroDestino: string, mensaje: string): string {
  return `https://wa.me/${soloDigitos(numeroDestino)}?text=${encodeURIComponent(mensaje)}`;
}

// helper pequeño para no ensuciar el template
function costEnvio0(p: Pedido): boolean {
  return (p.costoEnvio || 0) <= 0;
}
