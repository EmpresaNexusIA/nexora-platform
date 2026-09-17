// NEXORA · Layout del panel del vendedor: header + 5 pestañas + copiloto
// (En producción: middleware exige sesión y dueño de la tienda — regla N1)

import Link from "next/link";
import { getDB, ES_DEMO } from "@/lib/data";
import { PLANES } from "@/lib/constants";
import { ModoSwitcher } from "@/components/ThemeControls";
import { ChatWidget } from "@/components/ChatWidget";
import { PanelNav } from "./nav";
import { LogoutButton } from "./logout-button";
import { requireTiendaActual } from "@/lib/sesion";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const db = await getDB();
  const tienda = await requireTiendaActual(); // demo: tienda actual

  return (
    <div data-tema={tienda?.tema || "ambar"} className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center justify-between">
          <Link href="/panel/pedidos" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brandAccent text-lg text-white">
              {tienda?.logoEmoji || "🛍️"}
            </span>
            <div>
              <div className="text-sm font-black leading-tight">{tienda?.nombre}</div>
              <div className="text-[10px] font-bold text-slate-400">
                {tienda?.estadoSuscripcion === "trial"
                  ? `⏳ Prueba gratis · ${tienda && PLANES[tienda.plan].nombre} (demo)`
                  : `Plan ${tienda ? PLANES[tienda.plan].nombre : ""}`}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {/* Salir solo con sesión real: en demo el panel es abierto */}
            {!ES_DEMO && <LogoutButton />}
            <ModoSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      {/* Copiloto del vendedor (directiva #2) */}
      {tienda && <ChatWidget slug={tienda.slug} audiencia="vendedor" nombreTienda={tienda.nombre} />}

      <PanelNav />
    </div>
  );
}
