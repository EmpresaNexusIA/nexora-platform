// NEXORA · Landing pública (demo muestra accesos directos)
import Link from "next/link";
import { Smartphone, MessageCircle, Percent, BarChart3 } from "lucide-react";
import { ModoSwitcher } from "@/components/ThemeControls";

export default function Landing() {
  return (
    <main data-tema="ambar" className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10">
      <header className="flex items-center justify-between py-5">
        <span className="text-xl font-black tracking-tight">
          nexora<span className="text-brand">.</span>
        </span>
        <div className="flex items-center gap-2">
          <ModoSwitcher />
          <span className="chip bg-brand/10 font-bold text-brand">DEMO</span>
        </div>
      </header>

      <section className="mt-4">
        <div className="chip mb-4 bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
          ⚡ 0% comisión por venta, para siempre
        </div>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight">
          Tu tienda online en <span className="text-brand">5 minutos</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          Recibí pedidos ordenados por WhatsApp desde tu bio de Instagram.
          Descuentos automáticos, cierre de caja en un toque y tus clientes
          frecuentes con premio. Todo desde el celu.
        </p>
      </section>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {[
          { i: Smartphone, t: "Tienda al toque", d: "Link listo para tu bio" },
          { i: MessageCircle, t: "Pedidos x WhatsApp", d: "Como ya vendés hoy" },
          { i: Percent, t: "Descuentos pro", d: "VIP y por medio de pago" },
          { i: BarChart3, t: "Caja en 1 toque", d: "Cobrado vs por cobrar" },
        ].map(({ i: Icon, t, d }) => (
          <div key={t} className="card p-4">
            <Icon size={20} className="text-brand" />
            <div className="mt-2 text-sm font-bold">{t}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{d}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Link href="/t/panaderia-maria" className="btn-primary block text-base shadow-lg shadow-brand/30">
          Ver tienda de ejemplo → Panadería María 🍞
        </Link>
        <Link href="/panel/pedidos" className="btn-soft block text-base">
          Ver panel del vendedor (demo)
        </Link>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
        Hecho con <b className="text-slate-500">Nexora</b> · Términos · Privacidad
        <br />
        MVP en modo demo (DEMO_MODE=true)
      </p>
    </main>
  );
}
