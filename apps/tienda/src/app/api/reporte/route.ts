// NEXORA · Reporte CSV del cierre de caja (descarga del vendedor)

import { getDB } from "@/lib/data";
import { fmtMoney } from "@/lib/format";
import { getTiendaActual } from "@/lib/sesion";

export async function GET() {
  const db = await getDB();
  const t = await getTiendaActual(); // demo: tienda actual
  if (!t) return new Response("No autorizado", { status: 401 });
  const [caja, pedidos] = await Promise.all([db.getCaja(t.id), db.getPedidos(t.id)]);
  const hoy = caja.fecha;
  const deHoy = pedidos.filter((p) => p.estado !== "cancelado" && p.creadoEn.slice(0, 10) === hoy);

  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const filas: string[] = [
    "pedido;fecha_hora;cliente;estado;pagado;metodo_pago;entrega;subtotal;descuento;envio;total",
    ...deHoy.map((p) =>
      [
        p.numeroOrden,
        new Date(p.creadoEn).toLocaleString("es-AR"),
        esc(p.clienteNombre),
        p.estado,
        p.pagado ? "si" : "no",
        p.metodoPago,
        p.modoEntrega,
        p.subtotal,
        p.descuentoAplicado,
        p.costoEnvio,
        p.totalFinal,
      ].join(";"),
    ),
    "",
    `TOTAL DEL DIA;;;;${deHoy.length} pedidos;;;;;;${caja.total}`,
    `COBRADO;;;;;;;;;;;${caja.cobrado}`,
    `POR COBRAR;;;;;;;;;;;${caja.porCobrar}`,
  ];
  const csv = "﻿" + filas.join("\r\n"); // BOM para Excel
  void fmtMoney;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexora-cierre-${hoy}.csv"`,
    },
  });
}
