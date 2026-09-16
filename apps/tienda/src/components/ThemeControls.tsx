"use client";

// Selector de TEMA (3 presets, persiste en localStorage) + modo claro/oscuro.
// La tienda pública fija su tema por comercio; el panel lo deja elegir.

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { TEMAS } from "@/lib/constants";

export function TemaSwatches({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-3">
      {TEMAS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition ${
            value === t.id ? "border-slate-900 dark:border-white" : "border-slate-200 dark:border-slate-700"
          }`}
          title={t.nombre}
        >
          <span
            className="h-7 w-7 rounded-full shadow-inner"
            style={{ background: `rgb(${t.id === "ambar" ? "245 158 11" : t.id === "esmeralda" ? "5 150 105" : "37 99 235"})` }}
          />
          <span className="text-xs font-semibold">{t.nombre}</span>
          {value === t.id && <span className="text-[10px] font-bold text-emerald-600">✓ activo</span>}
        </button>
      ))}
    </div>
  );
}

export function ModoSwitcher() {
  const [oscuro, setOscuro] = useState<boolean | null>(null);
  useEffect(() => {
    setOscuro(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const root = document.documentElement;
    const on = !root.classList.contains("dark");
    root.classList.toggle("dark", on);
    try { localStorage.setItem("nexora-modo", on ? "oscuro" : "claro"); } catch {}
    setOscuro(on);
  };
  return (
    <button
      onClick={toggle}
      aria-label="Cambiar modo"
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {oscuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
