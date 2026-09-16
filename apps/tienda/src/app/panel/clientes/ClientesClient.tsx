"use client";

// NEXORA · Clientes del comercio: marcar frecuente + % VIP (origen manual),
// y ver de dónde vino cada VIP (origen | manual/automático).

import { useState, useTransition } from "react";
import { Star, UserRound } from "lucide-react";
import type { ClienteFrecuente } from "@/lib/types";
import { setFrecuenteAction } from "@/lib/actions";

export function ClientesClient({ clientes, umbral }: { clientes: ClienteFrecuente[]; umbral: number }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [dto, setDto] = useState("10");
  const [isPending, start] = useTransition();

  const guardar = (id: string, esFrecuente: boolean, descuento: number) =>
    start(async () => {
      await setFrecuenteAction(id, esFrecuente, descuento);
      setEditando(null);
    });

  const cantVip = clientes.filter((c) => c.esFrecuente).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-black">Clientes</h1>
        <span className="chip chip-off text-[11px] font-black">⭐ {cantVip} VIP · {clientes.length} total</span>
      </div>

      <div className="card mb-4 border-dashed p-3.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        💡 Marcá como <b>frecuente</b> a tus clientes de siempre: reciben su
        descuento VIP automáticamente al pagar. Regla automática del comercio:
        <b> cada {umbral} pedidos.</b>
      </div>

      <div className="space-y-2.5">
        {clientes.map((c) => (
          <div key={c.id} className={`card p-4 ${c.esFrecuente ? "border-amber-300 dark:border-amber-800" : ""}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                c.esFrecuente ? "bg-amber-400/20 text-amber-600" : "bg-slate-200 text-slate-500 dark:bg-slate-800"
              }`}>
                {c.esFrecuente ? <Star size={18} /> : <UserRound size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-bold">
                  {c.nombreCliente}
                  {c.esFrecuente && (
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9.5px] font-black text-amber-600">
                      VIP {c.origen === "auto" ? "· auto" : ""}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {c.pedidosFinalizados} pedidos finalizados · 📱 {c.telefonoCliente}
                </div>
              </div>
              {c.esFrecuente ? (
                <span className="text-sm font-black text-amber-600">-{c.descuentoEspecial}%</span>
              ) : (
                <button
                  onClick={() => { setEditando(editando === c.id ? null : c.id); setDto("10"); }}
                  className="rounded-full bg-brand/15 px-3 py-1.5 text-[11px] font-black text-brand transition active:scale-95"
                >
                  Hacer VIP
                </button>
              )}
            </div>

            {c.esFrecuente && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setEditando(editando === c.id ? null : c.id); setDto(String(c.descuentoEspecial)); }}
                  className="btn-soft flex-1 !py-2 text-xs"
                >
                  Editar {c.descuentoEspecial}%
                </button>
                <button
                  onClick={() => guardar(c.id, false, 0)}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-rose-500/10 !py-2 text-xs font-bold text-rose-500"
                >
                  Quitar VIP
                </button>
              </div>
            )}

            {editando === c.id && (
              <div className="mt-3 flex items-end gap-2 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                <div className="flex-1">
                  <span className="label-xs">Descuento VIP (%)</span>
                  <input value={dto} onChange={(e) => setDto(e.target.value)} type="number" min="1" max="90" className="input !py-2" />
                </div>
                <button
                  onClick={() => guardar(c.id, true, Number(dto) || 0)}
                  disabled={isPending}
                  className="btn-primary !px-4 !py-2 text-xs"
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {clientes.length === 0 && (
        <div className="py-14 text-center">
          <div className="text-4xl">👥</div>
          <p className="mt-3 text-sm font-bold">Todavía no hay clientes</p>
          <p className="text-xs text-slate-400">Aparecen solos cuando compran en tu tienda.</p>
        </div>
      )}
    </div>
  );
}
