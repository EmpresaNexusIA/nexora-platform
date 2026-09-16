// NEXORA · Panel → Cierre de Caja (cobrado vs por cobrar — fix M12)
import { getDB } from "@/lib/data";
import { fmtMoney, fmtFechaLarga, hoyISOlocal } from "@/lib/format";
import { METODOS_PAGO } from "@/lib/constants";
import { Download, TrendingUp } from "lucide-react";
import { requireTiendaActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const db = await getDB();
  const tienda = await requireTiendaActual();
  if (!tienda) return null;
  const caja = await db.getCaja(tienda.id);
  const maxBar = Math.max(1, ...caja.ultimos7Dias.map((d) => d.total));

  return (
    <div data-tema={tienda.tema}>
      <h1 className="mb-1 text-lg font-black">Cierre de Caja</h1>
      <p className="mb-4 text-xs font-semibold capitalize text-slate-400">{fmtFechaLarga(hoyISOlocal())}</p>

      {/* Total del día */}
      <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-xl dark:bg-white dark:text-slate-900">
        <div className="text-[11px] font-bold uppercase tracking-wide opacity-60">Hoy vendiste</div>
        <div className="mt-1 text-4xl font-black">{fmtMoney(caja.total, tienda.moneda)}</div>
        <div className="mt-1 text-xs opacity-70">{caja.pedidos} pedidos (sin contar cancelados)</div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1.5 text-emerald-300 dark:text-emerald-700">
            ✓ Cobrado · {fmtMoney(caja.cobrado, tienda.moneda)}
          </span>
          <span className="rounded-full bg-amber-500/20 px-3 py-1.5 text-amber-300 dark:text-amber-700">
            ⏳ Por cobrar · {fmtMoney(caja.porCobrar, tienda.moneda)}
          </span>
        </div>
      </div>

      {/* Por método de pago */}
      <div className="mt-3 flex flex-wrap gap-2">
        {METODOS_PAGO.map((m) => {
          const v = caja.porMetodo[m.id];
          if (!v) return null;
          return (
            <span key={m.id} className="chip chip-off text-[11px]">
              {m.emoji} {fmtMoney(v, tienda.moneda)}
            </span>
          );
        })}
      </div>

      {/* Gráfico 7 días */}
      <div className="card mt-4 p-4">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
          <TrendingUp size={13} /> Últimos 7 días
        </div>
        <div className="flex h-28 items-end justify-between gap-2.5">
          {caja.ultimos7Dias.map((d, i) => {
            const hoy = i === 6;
            const h = Math.max(6, (d.total / maxBar) * 100);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className={`text-[9px] font-black ${hoy ? "text-brand" : "text-slate-400"}`}>
                  {d.total > 0 ? `$${Math.round(d.total / 1000)}k` : "·"}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${hoy ? "bg-gradient-to-t from-brand to-brandAccent" : "bg-brand/30"}`}
                  style={{ height: `${h}%` }}
                />
                <span className={`text-[10px] font-bold ${hoy ? "text-brand" : "text-slate-400"}`}>{d.dia}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top productos + ticket */}
      <div className="card mt-4 p-4">
        <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Top de hoy</div>
        {caja.topProductos.length === 0 && (
          <p className="py-3 text-sm text-slate-400">Todavía no hay ventas hoy 💪</p>
        )}
        {caja.topProductos.map((p, i) => (
          <div key={p.nombre} className="flex items-center justify-between py-1.5 text-sm">
            <span className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? "bg-brand text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {i + 1}
              </span>
              {p.nombre}
            </span>
            <b>{p.cantidad} u.</b>
          </div>
        ))}
        <div className="mt-3 flex justify-between border-t border-dashed border-slate-200 pt-3 text-sm dark:border-slate-700">
          <span className="text-slate-500">Ticket promedio</span>
          <b>{fmtMoney(caja.ticketPromedio, tienda.moneda)}</b>
        </div>
      </div>

      <a href="/api/reporte" className="btn-primary mt-5 flex items-center justify-center gap-2 text-base">
        <Download size={17} /> Descargar reporte del día (CSV)
      </a>
      <p className="mt-2 text-center text-[10px] text-slate-400">El reporte excluye pedidos cancelados.</p>
    </div>
  );
}
