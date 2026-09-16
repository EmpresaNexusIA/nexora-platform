"use client";

// NEXORA · Pedidos del vendedor: tarjetas con estados completos, filtros,
// acciones por estado y "Marcar pagado" manual (etapa MVP — regla N5/F5).

import { useMemo, useState, useTransition } from "react";
import { MessageCircle, CheckCircle2, Bell, X, RotateCcw } from "lucide-react";
import type { Comercio, EstadoPedido } from "@/lib/types";
import type { PedidoConItems } from "@/lib/data/adapter";
import { ESTADOS_PEDIDO, TRANSICIONES } from "@/lib/constants";
import { fmtMoney, fmtHora } from "@/lib/format";
import { cambiarEstadoAction, marcarPagadoAction } from "@/lib/actions";

const FILTROS: { id: string; label: string; estados: EstadoPedido[] }[] = [
  { id: "todos", label: "Todos", estados: [] },
  { id: "pendientes", label: "Pendientes", estados: ["pendiente"] },
  { id: "curso", label: "En curso", estados: ["confirmado", "en_preparacion"] },
  { id: "finalizados", label: "Finalizados", estados: ["finalizado"] },
  { id: "cancelados", label: "Cancelados", estados: ["cancelado"] },
];

const COLOR: Record<string, string> = {
  pendiente: "bg-amber-500/15 text-amber-600 border-amber-300",
  confirmado: "bg-sky-500/15 text-sky-600 border-sky-300",
  en_preparacion: "bg-indigo-500/15 text-indigo-600 border-indigo-300",
  finalizado: "bg-emerald-500/15 text-emerald-600 border-emerald-300",
  cancelado: "bg-rose-500/15 text-rose-600 border-rose-300",
};

function accionesPara(e: EstadoPedido): { estado: EstadoPedido; label: string }[] {
  return TRANSICIONES[e]
    .filter((x) => x !== "cancelado")
    .map((x) => ({
      estado: x,
      label: x === "confirmado" ? "Confirmar" : x === "en_preparacion" ? "En preparación" : "✓ Finalizar",
    }));
}

export function PedidosClient({ pedidos, tienda }: { pedidos: PedidoConItems[]; tienda: Comercio }) {
  const [filtro, setFiltro] = useState("todos");
  const [isPending, start] = useTransition();
  const [cancelando, setCancelando] = useState<string | null>(null);

  const nuevosHoy = pedidos.filter(
    (p) => p.estado === "pendiente" && Date.now() - new Date(p.creadoEn).getTime() < 30 * 60e3,
  ).length;

  const visibles = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)!;
    const list = f.estados.length ? pedidos.filter((p) => f.estados.includes(p.estado)) : pedidos;
    return list;
  }, [pedidos, filtro]);

  const cambiar = (id: string, estado: EstadoPedido, reintegrar = false) =>
    start(async () => {
      await cambiarEstadoAction(id, estado, reintegrar);
      setCancelando(null);
    });

  const marcarPagado = (id: string, v: boolean) => start(async () => { await marcarPagadoAction(id, v); });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-black">Pedidos</h1>
        <span className="text-xs font-bold text-slate-400">{pedidos.length} totales</span>
      </div>

      {nuevosHoy > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-slate-900 p-3.5 text-white shadow-lg dark:bg-white dark:text-slate-900">
          <Bell size={17} className="shrink-0 animate-pulse" />
          <p className="text-xs font-bold">
            🛎 {nuevosHoy} pedido(s) nuevo(s) esperando tu confirmación — ¡los confirmados rápido terminan recomprando!
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="chips mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)} className={`chip ${filtro === f.id ? "chip-on" : "chip-off"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tarjetas */}
      <div className="space-y-3">
        {visibles.map((p) => (
          <div key={p.id} className={`card p-4 transition ${p.estado === "pendiente" ? "border-brand/60 ring-1 ring-brand/20" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-black">
                  {p.numeroOrden} · {p.clienteNombre}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">{fmtHora(p.creadoEn)} · {p.modoEntrega === "envio" ? "🛵 Envío" : "🏪 Retiro"} · {p.metodoPago}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${COLOR[p.estado]}`}>
                {ESTADOS_PEDIDO[p.estado].label}
              </span>
            </div>

            <div className="mt-2 text-[12.5px] text-slate-600 dark:text-slate-300">
              {p.items.map((i) => `${i.cantidad}× ${i.nombreCongelado}`).join(" · ")}
            </div>
            {p.notasCliente && (
              <div className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                💬 "{p.notasCliente}"
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-base font-black">{fmtMoney(p.totalFinal, tienda.moneda)}</span>
              {p.pagado ? (
                <span className="text-[11px] font-black text-emerald-600">✓ PAGADO ({p.metodoPago})</span>
              ) : (
                <span className="text-[11px] font-black text-amber-600">⏳ POR COBRAR</span>
              )}
            </div>

            {/* Acciones */}
            {p.estado !== "finalizado" && p.estado !== "cancelado" && (
              <div className="mt-3 flex gap-2">
                {accionesPara(p.estado).map((a) => (
                  <form key={a.estado} className="flex-1" action={() => cambiar(p.id, a.estado)}>
                    <button disabled={isPending} className="btn-primary w-full !py-2.5 text-xs">{a.label}</button>
                  </form>
                ))}
                {!p.pagado && (
                  <form className="flex-1" action={() => marcarPagado(p.id, true)}>
                    <button disabled={isPending} className="w-full rounded-xl bg-slate-900 px-2 py-2.5 text-xs font-bold text-white transition active:scale-95 dark:bg-white dark:text-slate-900">
                      💵 Marcar pagado
                    </button>
                  </form>
                )}
                <a
                  href={`https://wa.me/54${p.clienteTelefono.replace(/^0+|549/g, "")}`}
                  target="_blank" rel="noreferrer"
                  className="flex h-9 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 transition active:scale-90"
                  aria-label="WhatsApp del cliente"
                >
                  <MessageCircle size={16} />
                </a>
                <button
                  onClick={() => setCancelando(cancelando === p.id ? null : p.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 transition active:scale-90"
                  aria-label="Cancelar pedido"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {p.estado === "cancelado" && (
              <div className="mt-3 text-[11px] font-semibold text-slate-400">
                Pedido cancelado · el stock se reintegró si correspondía
              </div>
            )}
            {p.pagado && p.estado !== "finalizado" && p.estado !== "cancelado" && (
              <button onClick={() => marcarPagado(p.id, false)} className="mt-2 flex items-center gap-1 text-[10.5px] text-slate-400 underline">
                <RotateCcw size={10} /> desmarcar pago
              </button>
            )}

            {/* Confirmación de cancelación (inline, sin modales feos) */}
            {cancelando === p.id && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                <p className="text-xs font-bold text-rose-600">¿Cancelar {p.numeroOrden}?</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => cambiar(p.id, "cancelado", true)} disabled={isPending}
                    className="flex-1 rounded-lg bg-rose-500 py-2 text-xs font-black text-white">
                    Sí, cancelar y reintegrar stock
                  </button>
                  <button onClick={() => setCancelando(null)} className="flex-1 rounded-lg bg-slate-200 py-2 text-xs font-bold dark:bg-slate-700">
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {visibles.length === 0 && (
        <div className="py-16 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
          <p className="mt-3 text-sm font-bold">No hay pedidos en esta vista</p>
          <p className="text-xs text-slate-400">Cuando entre uno nuevo, te avisamos al toque.</p>
        </div>
      )}
    </div>
  );
}
