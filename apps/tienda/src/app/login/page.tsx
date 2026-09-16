"use client";

// NEXORA · /login — el dueño del comercio entra a su panel.
// Login contra apps/api (Fastify) → JWT → cookie host-only vía /api/sesion.

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const siguiente = params.get("next") || "/panel/pedidos";
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();

  const entrar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const r = await fetch(`${API}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(fd.get("email") || "").trim(),
            password: String(fd.get("password") || ""),
          }),
        });
        if (!r.ok) {
          setError(r.status === 401 ? "Email o contraseña incorrectos." : "Usuario inactivo o error del servidor.");
          return;
        }
        const j = await r.json();
        const rr = await fetch("/api/sesion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: j.accessToken }),
        });
        if (!rr.ok) { setError("No se pudo iniciar la sesión."); return; }
        router.replace(siguiente);
        router.refresh();
      } catch {
        setError("Sin conexión con el servidor. Probá más tarde.");
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <span className="text-4xl">🛍️</span>
        <h1 className="mt-2 text-2xl font-black">Tu panel de control</h1>
        <p className="mt-1 text-sm text-slate-500">Pedidos, caja y catálogo de tu tienda.</p>
      </div>

      <form onSubmit={entrar} className="space-y-3">
        <div>
          <span className="label-xs">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" placeholder="tu@email.com" />
        </div>
        <div>
          <span className="label-xs">Contraseña</span>
          <input name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••••••" />
        </div>
        {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-500">{error}</p>}
        <button disabled={isPending} className="btn-primary flex w-full items-center justify-center gap-2">
          <LogIn size={15} /> {isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
        ¿Todavía no tenés tienda?{" "}
        <a href="/quiero-tienda" className="font-bold text-brand">Creala en 24 hs</a>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
