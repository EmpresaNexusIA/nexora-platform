"use client";

// NEXORA · Tab bar del panel (5 pestañas — wireframe del Plan V2)
// U2: Caja y Config solo se muestran al dueño (mostrarFinanzas=true).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Package, Users, BarChart3, Settings } from "lucide-react";

const ALL_TABS = [
  { href: "/panel/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/panel/catalogo", label: "Catálogo", icon: Package },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/caja", label: "Caja", icon: BarChart3, requiereDueno: true },
  { href: "/panel/config", label: "Config", icon: Settings, requiereDueno: true },
];

export function PanelNav({ mostrarFinanzas }: { mostrarFinanzas?: boolean }) {
  const path = usePathname();
  const tabs = mostrarFinanzas !== false
    ? ALL_TABS
    : ALL_TABS.filter((t) => !t.requiereDueno);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const activo = path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-bold transition ${
                activo ? "text-brand" : "text-slate-400 hover:text-slate-600"
              }`}>
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
