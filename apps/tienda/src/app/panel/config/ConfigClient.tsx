"use client";

// NEXORA · Configuración: 5 bloques del wireframe (suscripción visible SIEMPRE — fix F1).

import { useState, useTransition } from "react";
import { CreditCard, ExternalLink, FileText, ShieldCheck, Download } from "lucide-react";
import type { Comercio, MetodoPagoId } from "@/lib/types";
import { DISEÑOS, METODOS_PAGO, PLANES } from "@/lib/constants";
import { guardarConfigAction } from "@/lib/actions";
import { TemaSwatches } from "@/components/ThemeControls";
import { fmtMoney } from "@/lib/format";

export function ConfigClient({ tienda }: { tienda: Comercio }) {
  const [isPending, start] = useTransition();
  const [guardado, setGuardado] = useState("");
  const plan = PLANES[tienda.plan];

  const guardar = (patch: Parameters<typeof guardarConfigAction>[0], msg: string) =>
    start(async () => {
      await guardarConfigAction(patch);
      setGuardado(msg);
      setTimeout(() => setGuardado(""), 1800);
    });

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-black">Configurar Tienda</h1>
      {guardado && (
        <div className="rounded-xl bg-emerald-500/15 px-3 py-2 text-center text-xs font-black text-emerald-600">
          ✓ {guardado}
        </div>
      )}

      {/* 0 · SUSCRIPCIÓN (siempre visible — sin esto el modelo de cobro no existe) */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white dark:from-white dark:to-slate-100 dark:text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-black uppercase">Plan {plan.nombre}</span>
            <p className="mt-2 text-xs opacity-70">
              {tienda.estadoSuscripcion === "trial"
                ? "⏳ Estás en la prueba gratis · luego débito automático"
                : "Débito automático · Mercado Pago"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-black">{fmtMoney(plan.precio, tienda.moneda)}</div>
            <div className="text-[10px] opacity-60">/mes</div>
          </div>
        </div>
        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-black transition hover:bg-white/20 dark:bg-slate-900/5 dark:hover:bg-slate-900/10">
          <CreditCard size={14} /> Gestionar suscripción
        </button>
      </section>

      {/* 1 · DISEÑO Y TEMA (presets + dark — directiva fundador #1) */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">Diseño y color de tu tienda</h2>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {DISEÑOS.map((d) => (
            <button key={d.id} onClick={() => guardar({ diseno: d.id }, `Diseño "${d.nombre}" guardado`)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition ${
                tienda.diseno === d.id ? "border-brand" : "border-slate-200 dark:border-slate-700"
              }`}>
              <span className="text-xl">{d.emoji}</span>
              <span className="text-[11px] font-bold">{d.nombre}</span>
              {tienda.diseno === d.id && <span className="text-[9px] font-black text-emerald-600">✓</span>}
            </button>
          ))}
        </div>
        <TemaSwatches
          value={tienda.tema}
          onChange={(t) => guardar({ tema: t as Comercio["tema"] }, `Color "${t}" guardado`)}
        />
        <a href={`/t/${tienda.slug}`} target="_blank" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-brand">
          Ver mi tienda como cliente <ExternalLink size={12} />
        </a>
      </section>

      {/* 2 · DESCUENTOS (vigencia automática + tope — fix M5/M6) */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">Descuentos</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            guardar(
              {
                metodoDescuento: fd.get("metodo") as MetodoPagoId,
                porcentajeDescuento: Number(fd.get("pct")),
                dtoDesde: (fd.get("desde") as string) || null,
                dtoHasta: (fd.get("hasta") as string) || null,
                acumularDescuentos: fd.get("acumular") === "on",
                topeDescuento: Number(fd.get("tope")),
                umbralFrecuente: Number(fd.get("umbral")),
              },
              "Descuentos guardados",
            );
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="label-xs">% de dto. por pagar en…</span>
              <input name="pct" type="number" min="0" max="90" defaultValue={tienda.porcentajeDescuento} className="input" />
            </div>
            <div>
              <span className="label-xs">Método premiado</span>
              <select name="metodo" defaultValue={tienda.metodoDescuento} className="input">
                {METODOS_PAGO.filter((m) => m.id !== "otro").map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
                <option value="ninguno">Ninguno</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="label-xs">Vigente desde</span>
              <input name="desde" type="date" defaultValue={tienda.dtoDesde || ""} className="input" />
            </div>
            <div>
              <span className="label-xs">Vigente hasta</span>
              <input name="hasta" type="date" defaultValue={tienda.dtoHasta || ""} className="input" />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3.5 py-3 text-sm font-semibold dark:bg-slate-800">
            Acumular con descuento VIP
            <input name="acumular" type="checkbox" defaultChecked={tienda.acumularDescuentos} className="h-5 w-5 accent-amber-500" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="label-xs">Tope acumulado (%)</span>
              <input name="tope" type="number" min="1" max="100" defaultValue={tienda.topeDescuento} className="input" />
            </div>
            <div>
              <span className="label-xs">VIP automático tras N pedidos</span>
              <input name="umbral" type="number" min="0" max="50" defaultValue={tienda.umbralFrecuente} className="input" />
            </div>
          </div>
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800">
            Si no acumulan, el cliente recibe SIEMPRE la mejor oferta (Max) y se lo avisamos en pantalla.
          </p>
          <button disabled={isPending} className="btn-primary w-full">Guardar descuentos</button>
        </form>
      </section>

      {/* 3 · ENTREGA */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">Entrega</h2>
        <form className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            guardar(
              {
                modoEntrega: fd.get("modo") as Comercio["modoEntrega"],
                costoEnvio: Number(fd.get("costo")),
                dirRetiro: String(fd.get("dir") || ""),
                horarios: String(fd.get("horarios") || ""),
              },
              "Entrega guardada",
            );
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="label-xs">Modo</span>
              <select name="modo" defaultValue={tienda.modoEntrega} className="input">
                <option value="ambos">Retiro + Envío</option>
                <option value="retiro">Solo retiro</option>
                <option value="envio">Solo envío</option>
              </select>
            </div>
            <div>
              <span className="label-xs">Costo de envío ($)</span>
              <input name="costo" type="number" min="0" defaultValue={tienda.costoEnvio} className="input" />
            </div>
          </div>
          <div>
            <span className="label-xs">Dirección de retiro</span>
            <input name="dir" defaultValue={tienda.dirRetiro} className="input" />
          </div>
          <div>
            <span className="label-xs">Horarios</span>
            <input name="horarios" defaultValue={tienda.horarios} className="input" />
          </div>
          <button disabled={isPending} className="btn-primary w-full">Guardar entrega</button>
        </form>
      </section>

      {/* 4 · LINK DE LA TIENDA + LEGAL */}
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-400">Tu link y tu cuenta</h2>
        <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          🔗 <b>nexora.app/t/{tienda.slug}</b>
          <p className="mt-1 text-[10.5px] opacity-80">
            Tu link NO cambia aunque edites el nombre (el link de tu bio es un activo). Editable 1 sola vez con advertencia.
          </p>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <button className="btn-soft flex w-full items-center gap-2 !py-2.5 text-xs"><FileText size={14} /> Términos y condiciones</button>
          <button className="btn-soft flex w-full items-center gap-2 !py-2.5 text-xs"><ShieldCheck size={14} /> Política de privacidad</button>
          <button className="btn-soft flex w-full items-center gap-2 !py-2.5 text-xs"><Download size={14} /> Exportar mis datos</button>
          <button className="flex w-full items-center rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-500">
            Cerrar cuenta
          </button>
        </div>
      </section>
    </div>
  );
}
