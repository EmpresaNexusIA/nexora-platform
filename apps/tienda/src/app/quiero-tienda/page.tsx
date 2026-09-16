"use client";

// NEXORA · /quiero-tienda — captación del lead hacia crm/clientes (Fase 1).
// Postea contra apps/api del monorepo. Si no hay API configurada aún,
// muestra el WhatsApp del fundador como canal de respaldo.

import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "";

export default function QuieroTienda() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = {
      nombre: String(fd.get("nombre") || ""),
      telefono: String(fd.get("telefono") || ""),
      rubro: String(fd.get("rubro") || ""),
      tieneWeb: fd.get("tieneWeb") === "on",
      notas: String(fd.get("notas") || ""),
      empresa: String(fd.get("empresa") || ""), // honeypot — siempre vacío
    };
    start(async () => {
      if (!API) { setError("Este entorno no tiene API configurada todavía."); return; }
      try {
        const r = await fetch(`${API}/crm/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) setEnviado(true);
        else {
          const j = await r.json().catch(() => null);
          setError(j?.error || "No pudimos registrarlo. Probá de nuevo.");
        }
      } catch {
        setError("Sin conexión con el servidor. Probá más tarde.");
      }
    });
  };

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <CheckCircle2 size={56} className="text-emerald-500" />
        <h1 className="text-2xl font-black">¡Listo! Ya tenemos tus datos 🎉</h1>
        <p className="text-sm text-slate-500">
          Te escribimos en el día para activar tu tienda con los <b>14 días de prueba</b>.
          Mientras tanto pensá el nombre: va a ser tu link para siempre 😉
        </p>
        <Link href="/" className="btn-primary">Volver</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-svh max-w-md px-6 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600">
        <ArrowLeft size={14} /> Volver
      </Link>
      <h1 className="text-2xl font-black">Quiero mi tienda 🛍️</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Dejanos tus datos y en <b>24 hs</b> tenés tu link listo para compartir en tu bio.
      </p>

      <form onSubmit={enviar} className="space-y-3">
        {/* 🍯 honeypot — oculto a humanos */}
        <input name="empresa" type="text" tabIndex={-1} autoComplete="off"
          className="pointer-events-none absolute -left-96 opacity-0" aria-hidden="true" />

        <div>
          <span className="label-xs">Tu nombre</span>
          <input name="nombre" required maxLength={120} className="input" placeholder="María García" />
        </div>
        <div>
          <span className="label-xs">WhatsApp (con código de área)</span>
          <input name="telefono" required type="tel" className="input" placeholder="341 5551234" />
        </div>
        <div>
          <span className="label-xs">¿Qué vendés?</span>
          <input name="rubro" maxLength={120} className="input" placeholder="Panadería, ropa, servicios..." />
        </div>
        <div>
          <span className="label-xs">Contanos algo más (opcional)</span>
          <textarea name="notas" maxLength={500} rows={3} className="input"
            placeholder="Ej: vendo por Instagram y pierdo pedidos por DM" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input name="tieneWeb" type="checkbox" className="h-4 w-4 accent-amber-500" />
          Ya tengo sitio web
        </label>

        {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-500">{error}</p>}

        <button disabled={isPending} className="btn-primary flex w-full items-center justify-center gap-2">
          <Send size={15} /> {isPending ? "Enviando..." : "Quiero mi tienda"}
        </button>
        <p className="text-center text-[11px] text-slate-400">
          Sin compromiso · 14 días de prueba · Podés borrar todo cuando quieras
        </p>
      </form>
    </main>
  );
}
