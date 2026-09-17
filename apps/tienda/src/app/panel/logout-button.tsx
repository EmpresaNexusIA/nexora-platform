"use client";

// NEXORA · Botón "Salir" del panel (Fase 1.6).
// DELETE /api/sesion → revoca el refresh en la plataforma (la tienda espera
// la respuesta de la API para que la revocación en Redis sí o sí ocurra)
// y limpia las cookies locales; después vuelve a /login.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const salir = async () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await fetch("/api/sesion", { method: "DELETE" });
    } catch {
      // nunca frenamos la salida: las cookies se borran igual del lado tienda
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
    >
      <LogOut size={17} />
    </button>
  );
}
