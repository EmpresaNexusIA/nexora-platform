"use client";

// NEXORA · Catálogo del vendedor: switch Disponible/Pausado en 1 toque,
// stock numérico opcional y alta rápida (foto-emoji, nombre y precio alcanza).

import { useEffect, useMemo, useState, useTransition } from "react";
import { ImagePlus, PackagePlus, Search, Trash2, X } from "lucide-react";
import type { Categoria, Comercio, Producto } from "@/lib/types";
import { fmtMoney, hashEmoji } from "@/lib/format";
import { toggleDisponibleAction, crearProductoAction } from "@/lib/actions";

const MAX_FOTOS = 3;

const GRADIENTES = [
  "from-amber-200 to-orange-300", "from-rose-200 to-pink-300",
  "from-sky-200 to-blue-300", "from-emerald-200 to-teal-300",
  "from-violet-200 to-purple-300", "from-lime-200 to-green-300",
];
const EMOJIS = ["🥐", "🍰", "🥖", "🧁", "☕", "🍪", "🍫", "🧀", "🍩", "🥪", "🍕", "🥤"];

export function CatalogoClient({ productos, categorias, tienda }: { productos: Producto[]; categorias: Categoria[]; tienda: Comercio }) {
  const [q, setQ] = useState("");
  const [alta, setAlta] = useState(false);
  const [emojiSel, setEmojiSel] = useState("🥐");
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();

  // Previews locales (object URLs) con limpieza al cerrar el sheet
  useEffect(() => {
    const urls = fotos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [fotos]);

  const agregarFotos = (files: FileList | null) => {
    if (!files) return;
    const nuevos = [...fotos, ...Array.from(files)].slice(0, MAX_FOTOS);
    setFotos(nuevos);
  };

  const quitarFoto = (i: number) => setFotos((fs) => fs.filter((_, ix) => ix !== i));

  const visibles = useMemo(() => {
    const n = q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return productos.filter((p) => !n || p.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(n));
  }, [productos, q]);

  const toggle = (id: string, v: boolean) => start(async () => { await toggleDisponibleAction(id, v); });

  const crear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("emoji", emojiSel);

    // 1) Subir fotos primero (valida servidor: formato ≤3MB)
    if (fotos.length > 0) {
      setSubiendo(true);
      const urls: string[] = [];
      for (const f of fotos) {
        const body = new FormData();
        body.set("file", f);
        body.set("comercio", tienda.slug);
        const r = await fetch("/api/upload", { method: "POST", body });
        const j = await r.json();
        if (!j.ok) { setSubiendo(false); setError(j.error || "No se pudo subir una foto."); return; }
        urls.push(j.url);
      }
      setSubiendo(false);
      fd.set("fotos", JSON.stringify(urls));
    }

    // 2) Crear el producto con las URLs ya subidas
    start(async () => {
      const res = await crearProductoAction(fd);
      if (res.ok) { setAlta(false); setFotos([]); setError(""); }
      else setError(res.error || "No se pudo crear.");
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-black">Mi Catálogo</h1>
        <span className="text-xs font-bold text-slate-400">{productos.length} productos</span>
      </div>

      {/* Buscador del panel */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <Search size={15} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
        {q && <button onClick={() => setQ("")}><X size={14} className="text-slate-400" /></button>}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {visibles.map((p) => {
          const agotado = !p.disponible;
          return (
            <div key={p.id} className={`card flex items-center gap-3 p-3 ${agotado ? "opacity-55" : ""}`}>
              {p.fotos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.fotos[0]} alt={p.nombre}
                  className={`h-12 w-12 shrink-0 rounded-xl object-cover ${agotado ? "grayscale" : ""}`} />
              ) : (
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ${GRADIENTES[hashEmoji(p.id) % GRADIENTES.length]} ${agotado ? "grayscale" : ""}`}>
                  {p.emoji}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.nombre}</div>
                <div className="text-xs text-slate-500">
                  {fmtMoney(p.precio, tienda.moneda)}
                  {p.stockNumerico !== null
                    ? ` · stock: ${p.stockNumerico}`
                    : " · sin control de stock"}
                  {agotado && <span className="font-bold text-rose-500"> · pausado</span>}
                </div>
              </div>
              {/* Switch */}
              <form action={() => toggle(p.id, !p.disponible)}>
                <button disabled={isPending} aria-label={p.disponible ? "Pausar" : "Activar"}
                  className={`relative h-6 w-11 rounded-full transition ${p.disponible ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.disponible ? "right-0.5" : "left-0.5"}`} />
                </button>
              </form>
            </div>
          );
        })}
      </div>
      {visibles.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">Sin resultados para “{q}”.</p>
      )}

      {/* FAB alta rápida */}
      <button onClick={() => setAlta(true)} aria-label="Agregar producto"
        className="fixed bottom-24 right-4 z-20 flex h-13 w-13 items-center justify-center rounded-full bg-brand p-4 text-white shadow-xl shadow-brand/40 transition hover:scale-105 active:scale-95">
        <PackagePlus size={22} />
      </button>

      {/* Sheet alta rápida */}
      {alta && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAlta(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-slate-50 p-5 pb-9 dark:bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <h2 className="mb-1 text-lg font-black">Producto rápido ⚡</h2>
            <p className="mb-4 text-xs text-slate-500">Nombre, precio y una buena foto alcanzan para empezar a vender.</p>

            <form onSubmit={crear} className="space-y-3">
              {/* Fotos reales (hasta 3) — se suben al servidor al guardar */}
              <div>
                <span className="label-xs">Fotos (hasta {MAX_FOTOS})</span>
                <div className="flex flex-wrap gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
                      <button type="button" onClick={() => quitarFoto(i)} aria-label="Quitar foto"
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  {fotos.length < MAX_FOTOS && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand hover:text-brand dark:border-slate-600">
                      <ImagePlus size={18} />
                      <span className="text-[9px] font-bold">SUBIR</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                        onChange={(e) => { agregarFotos(e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">JPG, PNG o WebP · máx. 3 MB cada una</p>
              </div>

              {/* Ícono: solo se usa si el producto no tiene foto */}
              <div>
                <span className="label-xs">Ícono (se usa si no ponés foto)</span>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => setEmojiSel(e)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${emojiSel === e ? "bg-brand text-white" : "bg-slate-200 dark:bg-slate-800"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <input name="nombre" className="input" placeholder="Nombre del producto" required maxLength={60} />
              <div className="grid grid-cols-2 gap-2">
                <input name="precio" className="input" type="number" min="1" step="1" placeholder="Precio ($)" required />
                <input name="stock" className="input" type="number" min="0" placeholder="Stock (opcional)" />
              </div>
              {categorias.length > 0 && (
                <select name="categoriaId" className="input">
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
              <button disabled={isPending || subiendo} className="btn-primary w-full text-base">
                {subiendo ? "Subiendo fotos..." : isPending ? "Guardando..." : "Guardar producto"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
