// NEXORA · Seguimiento del pedido (/pedido/[token]) — para el cliente final.
// El token largo hace el link no adivinable (sin login requerido).

import { getDB } from "@/lib/data";
import { ESTADOS_PEDIDO } from "@/lib/constants";
import { fmtMoney, fmtFechaLarga, fmtHora } from "@/lib/format";
import { CheckCircle2, Circle, Clock, XCircle, MessageCircle } from "lucide-react";

const TIMELINE: ("pendiente" | "confirmado" | "en_preparacion" | "finalizado")[] = [
  "pendiente", "confirmado", "en_preparacion", "finalizado",
];

export default async function SeguimientoPage({ params }: { params: { token: string } }) {
  const db = await getDB();
  const data = await db.getPedidoPorToken(params.token);
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-xl font-black">Pedido no encontrado</h1>
        <p className="mt-2 text-sm text-slate-500">Revisá el link que te llegó con tu comprobante.</p>
      </main>
    );
  }
  const { pedido: p, items, tienda: t } = data;
  const cancelado = p.estado === "cancelado";
  const idxActual = TIMELINE.indexOf(p.estado as never);

  return (
    <main data-tema={t.tema} className="mx-auto min-h-screen max-w-md px-5 pb-12 pt-8">
      <div className="text-center">
        <div className="text-4xl">{t.logoEmoji}</div>
        <h1 className="mt-2 text-xl font-black">Pedido {p.numeroOrden}</h1>
        <p className="text-sm text-slate-500">{t.nombre} · {fmtFechaLarga(p.creadoEn)} · {fmtHora(p.creadoEn)} h</p>
      </div>

      {/* Timeline */}
      <div className="card mt-6 p-5">
        {cancelado ? (
          <div className="flex items-center gap-3 text-rose-500">
            <XCircle size={22} />
            <div>
              <div className="font-black">Pedido cancelado</div>
              <div className="text-xs text-slate-500">{t.nombre} lo gestionó. Escribiles por WhatsApp si quedó alguna duda.</div>
            </div>
          </div>
        ) : (
          TIMELINE.map((e, i) => {
            const hecho = i <= idxActual;
            const esUltimo = i === idxActual && p.estado !== "finalizado";
            return (
              <div key={e} className="flex items-center gap-3 py-1.5">
                {hecho ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" /> : <Circle size={20} className="text-slate-300 shrink-0" />}
                <span className={`text-sm ${hecho ? "font-bold" : "text-slate-400"}`}>
                  {ESTADOS_PEDIDO[e].label}
                  {esUltimo && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-black text-brand">AHORA</span>}
                </span>
              </div>
            );
          })
        )}
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-xs dark:border-slate-700">
          <span className="flex items-center gap-1 text-slate-500"><Clock size={12} /> Pago: {p.metodoPago}</span>
          <span className={`rounded-full px-2 py-0.5 font-black ${p.pagado ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
            {p.pagado ? "✓ Pagado" : "⏳ A pagar"}
          </span>
        </div>
      </div>

      {/* Resumen */}
      <div className="card mt-4 p-5 text-sm">
        <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Tu pedido</div>
        {items.map((i) => (
          <div key={i.id} className="flex justify-between py-1">
            <span>{i.cantidad}× {i.nombreCongelado}</span>
            <span className="text-slate-500">{fmtMoney(i.subtotal, t.moneda)}</span>
          </div>
        ))}
        <div className="mt-3 space-y-1 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmtMoney(p.subtotal, t.moneda)}</span></div>
          {p.costoEnvio > 0 && <div className="flex justify-between text-slate-500"><span>Envío</span><span>{fmtMoney(p.costoEnvio, t.moneda)}</span></div>}
          {p.descuentoAplicado > 0 && <div className="flex justify-between font-semibold text-emerald-600"><span>Descuento</span><span>−{fmtMoney(p.descuentoAplicado, t.moneda)}</span></div>}
          <div className="flex justify-between pt-1 text-base font-black"><span>Total</span><span>{fmtMoney(p.totalFinal, t.moneda)}</span></div>
        </div>
        <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800">
          {p.modoEntrega === "envio" ? `🛵 Envío a: ${p.direccionEntrega}` : `🏪 Retiro en: ${t.dirRetiro}`}
        </div>
      </div>

      <a href={`https://wa.me/${t.whatsapp}`} target="_blank" rel="noreferrer"
        className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-sm font-black text-[#0B3319] transition active:scale-[0.98]">
        <MessageCircle size={16} /> Hablar con {t.nombre}
      </a>

      <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-400">
        Comprobante de pedido · No válido como factura. El comercio emite el comprobante fiscal correspondiente.
        <br />Términos · Privacidad · Hecho con <b>Nexora</b>
      </p>
    </main>
  );
}
