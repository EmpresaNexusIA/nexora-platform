"use client";

// NEXORA · Tienda pública (cliente): portada, buscador, categorías, grilla,
// carrito persistente y checkout con desglose vivo + WhatsApp (fix M8).
// Inspiración revisada vs. apps grandes (directiva #6):
//   · pedidosya-type: buscador siempre visible, acción "+" en cada tarjeta
//   · tiendanube-mobile: checkout en un solo scroll, sin pasos innecesarios
//   · mercadolibre: "tu carrito se guarda solo" (localStorage por tienda)

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Search, X, Plus, Minus, ShoppingBag, MessageCircle, Store as StoreIcon,
  Truck, CheckCircle2, Sparkles, Clock, MapPin, BadgePercent, Send,
} from "lucide-react";
import type { Categoria, Comercio, Producto, MetodoPagoId, ModoEntregaId, Pedido, ItemPedido } from "@/lib/types";
import { METODOS_PAGO, MODOS_ENTREGA } from "@/lib/constants";
import { computeDesglose, textoRegla } from "@/lib/money";
import { fmtMoney, hashEmoji } from "@/lib/format";
import { crearPedidoAction } from "@/lib/actions";
import { ChatWidget } from "@/components/ChatWidget";
import Link from "next/link";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const GRADIENTES = [
  "from-amber-200 to-orange-300", "from-rose-200 to-pink-300",
  "from-sky-200 to-blue-300", "from-emerald-200 to-teal-300",
  "from-violet-200 to-purple-300", "from-lime-200 to-green-300",
];

interface Props {
  tienda: Comercio;
  productos: Producto[];
  categorias: Categoria[];
  dtoPagoPublic: number; // % dto por método de pago visible al público
}

type Paso = "tienda" | "checkout" | "listo";

export function StoreClient({ tienda, productos, categorias, dtoPagoPublic }: Props) {
  const t = tienda;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paso, setPaso] = useState<Paso>("tienda");
  const [isPending, start] = useTransition();
  const [error, setError] = useState("");

  // checkout state
  const [modo, setModo] = useState<ModoEntregaId>("retiro");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagoId>("efectivo");
  const [resultado, setResultado] = useState<{ pedido: Pedido; items: ItemPedido[]; waUrl: string; token: string } | null>(null);

  // Persistencia del carrito por tienda (localStorage — offline-friendly)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`nexora-cart-${t.slug}`);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
    if (t.modoEntrega === "envio") setModo("envio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.slug]);
  useEffect(() => {
    try { localStorage.setItem(`nexora-cart-${t.slug}`, JSON.stringify(cart)); } catch {}
  }, [cart, t.slug]);

  const disponibles = useMemo(() => productos.filter((p) => !p.eliminado), [productos]);

  const filtrados = useMemo(() => {
    let list = disponibles;
    if (cat) list = list.filter((p) => p.categoriaId === cat);
    const n = norm(q).trim();
    if (n) {
      list = list.filter((p) => norm(`${p.nombre} ${p.descripcion}`).includes(n));
    }
    return list;
  }, [disponibles, cat, q]);

  const add = (pid: string, delta: number) =>
    setCart((c) => {
      const next = { ...c, [pid]: Math.max(0, (c[pid] || 0) + delta) };
      if (next[pid] === 0) delete next[pid];
      return next;
    });

  const lineas = useMemo(
    () =>
      Object.entries(cart)
        .map(([productoId, cantidad]) => ({ producto: productos.find((p) => p.id === productoId)!, cantidad }))
        .filter((l) => l.producto),
    [cart, productos],
  );
  const cantTotal = lineas.reduce((a, l) => a + l.cantidad, 0);

  const desglose = useMemo(
    () =>
      computeDesglose({
        tienda: t,
        lineas: lineas.map((l) => ({ precio: l.producto.precio, cantidad: l.cantidad })),
        modoEntrega: modo,
        metodoPago: metodo,
        dtoVipPct: 0, // el VIP se aplica en servidor al finalizar (sorpresa positiva)
      }),
    [t, lineas, modo, metodo],
  );

  const puedeConfirmar =
    cantTotal > 0 &&
    nombre.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    celular.replace(/\D/g, "").length >= 8 &&
    (modo === "retiro" || direccion.trim().length >= 4) &&
    !isPending;

  const confirmar = () => {
    setError("");
    start(async () => {
      const res = await crearPedidoAction({
        slug: t.slug,
        lineas: lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
        cliente: { nombre: nombre.trim(), email: email.trim(), telefono: celular.trim() },
        modoEntrega: modo,
        direccionEntrega: direccion,
        notasCliente: notas,
        metodoPago: metodo,
      });
      if (!res.ok || !res.pedido || !res.waUrl) {
        setError(res.error || "No pudimos crear tu pedido. Probá de nuevo.");
        return;
      }
      setResultado({ pedido: res.pedido, items: res.items || [], waUrl: res.waUrl, token: res.tokenSeguimiento || res.pedido.token });
      setCart({});
      setPaso("listo");
    });
  };

  // ============ PANTALLA LISTO ============
  if (paso === "listo" && resultado) {
    const p = resultado.pedido;
    return (
      <main data-tema={t.tema} className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-14 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 size={40} className="text-emerald-600" />
        </div>
        <h1 className="mt-5 text-2xl font-black">¡Pedido {p.numeroOrden} enviado! 🎉</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t.nombre} ya lo recibió. Avisá por WhatsApp para confirmarlo más rápido:
        </p>
        <a href={resultado.waUrl} target="_blank" rel="noreferrer"
           className="mt-6 block rounded-2xl bg-[#25D366] px-4 py-4 text-base font-black text-[#0B3319] shadow-lg shadow-emerald-500/30 transition active:scale-[0.98]">
          💬 Avisar por WhatsApp
        </a>
        <div className="card mt-4 p-4 text-left text-sm">
          <div className="mb-2 flex items-center justify-between font-bold">
            <span>Resumen · {p.numeroOrden}</span>
            <span className="text-brandInk">{fmtMoney(p.totalFinal, t.moneda)}</span>
          </div>
          {resultado.items.map((i) => (
            <div key={i.id} className="flex justify-between py-0.5 text-slate-600 dark:text-slate-300">
              <span>{i.cantidad}× {i.nombreCongelado}</span>
              <span>{fmtMoney(i.subtotal, t.moneda)}</span>
            </div>
          ))}
          {p.descuentoAplicado > 0 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Sparkles size={12} /> Te aplicamos: {textoRegla(p.dtoRegla)} (−{fmtMoney(p.descuentoAplicado, t.moneda)})
            </div>
          )}
        </div>
        <a href={`/pedido/${resultado.token}`} className="btn-soft mt-4 block">
          📄 Ver seguimiento y comprobante
        </a>
        <button onClick={() => setPaso("tienda")} className="mt-3 text-sm font-semibold text-slate-400 underline">
          Volver a la tienda
        </button>
      </main>
    );
  }

  // ============ TIENDA ============
  return (
    <main data-tema={t.tema} className="mx-auto min-h-screen max-w-md pb-40">
      {/* Portada */}
      <div className="relative h-28 bg-gradient-to-br from-brand to-brandAccent">
        <div className="absolute -bottom-7 left-4 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-slate-50 bg-white text-3xl shadow-md dark:border-slate-950 dark:bg-slate-800">
          {t.logoEmoji}
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
          {t.rubro}
        </div>
      </div>
      <div className="px-4 pt-9">
        <h1 className="text-xl font-black">{t.nombre}</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Abierto</span>
          <span>· {t.horarios}</span>
        </p>
        {t.descripcion && (
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{t.descripcion}</p>
        )}
        {dtoPagoPublic > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            <BadgePercent size={15} /> {dtoPagoPublic}% OFF pagando en {t.metodoDescuento}
          </div>
        )}
      </div>

      {/* Buscador (directiva #5: simple y siempre visible) */}
      <div className="sticky top-0 z-20 mt-4 bg-slate-50/90 px-4 pb-2 pt-2 backdrop-blur dark:bg-slate-950/90">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Search size={17} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscá en ${t.nombre}...`}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            aria-label="Buscar productos"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Limpiar">
              <X size={16} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Categorías */}
      {categorias.length > 0 && (
        <div className="chips mt-1 flex gap-2 overflow-x-auto px-4 pb-1 pt-2">
          <button onClick={() => setCat(null)} className={`chip ${cat === null ? "chip-on" : "chip-off"}`}>Todo</button>
          {categorias.map((c) => (
            <button key={c.id} onClick={() => setCat(cat === c.id ? null : c.id)}
              className={`chip ${cat === c.id ? "chip-on" : "chip-off"}`}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Grilla de productos */}
      <div className={`mt-2 grid gap-3 px-4 ${t.diseno === "lista" ? "grid-cols-1" : "grid-cols-2"}`}>
        {filtrados.map((p) => {
          const agotado = !p.disponible || (p.stockNumerico !== null && p.stockNumerico === 0);
          const enCarrito = cart[p.id] || 0;
          return (
            <div key={p.id} className={`card overflow-hidden ${agotado ? "opacity-50" : ""}`}>
              {p.fotos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.fotos[0]} alt={p.nombre} loading="lazy"
                  className="h-24 w-full object-cover" />
              ) : (
                <div className={`flex h-24 items-center justify-center bg-gradient-to-br text-4xl ${GRADIENTES[hashEmoji(p.id) % GRADIENTES.length]}`}>
                  {p.emoji}
                </div>
              )}
              <div className="p-3">
                <div className="truncate text-[13px] font-bold" title={p.nombre}>{p.nombre}</div>
                {agotado ? (
                  <div className="mt-1 text-[11px] font-black text-rose-500">AGOTADO HOY</div>
                ) : (
                  p.stockNumerico !== null && p.stockNumerico <= 5 && (
                    <div className="mt-1 text-[10px] font-bold text-amber-600">¡Quedan {p.stockNumerico}!</div>
                  )
                )}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-black">{fmtMoney(p.precio, t.moneda)}</span>
                  {!agotado && (
                    enCarrito === 0 ? (
                      <button onClick={() => add(p.id, 1)} aria-label={`Agregar ${p.nombre}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white transition active:scale-90">
                        <Plus size={15} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-full bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
                        <button onClick={() => add(p.id, -1)} className="px-1" aria-label="Quitar uno"><Minus size={13} /></button>
                        <span className="text-xs font-black">{enCarrito}</span>
                        <button onClick={() => add(p.id, 1)} className="px-1" aria-label="Agregar uno"><Plus size={13} /></button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filtrados.length === 0 && (
        <div className="px-6 py-14 text-center">
          <div className="text-4xl">🔍</div>
          <p className="mt-3 text-sm font-bold">No encontramos “{q}”</p>
          <p className="mt-1 text-xs text-slate-500">Probá con otra palabra o mirá todas las categorías.</p>
          <button onClick={() => { setQ(""); setCat(null); }} className="btn-soft mt-4 inline-block px-6">Limpiar búsqueda</button>
        </div>
      )}

      {/* WhatsApp + sello */}
      <a href={`https://wa.me/${t.whatsapp}`} target="_blank" rel="noreferrer"
        className="mx-4 mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-sm font-black text-[#0B3319] transition active:scale-[0.98]">
        <MessageCircle size={17} /> Escribinos por WhatsApp
      </a>
      <p className="mt-4 text-center text-[10px] text-slate-400">
        ⚡ Hecho con <Link href="/quiero-tienda" className="font-bold underline decoration-dotted underline-offset-2"><b>Nexora</b></Link> · Términos · Privacidad
      </p>

      {/* Barra de carrito flotante */}
      {cantTotal > 0 && paso === "tienda" && (
        <div className="fixed inset-x-0 bottom-[74px] z-30 px-4" style={{ maxWidth: 448, margin: "0 auto" }}>
          <button onClick={() => setPaso("checkout")}
            className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-2xl transition active:scale-[0.98] dark:bg-white dark:text-slate-900">
            <span className="flex items-center gap-2 text-sm font-bold">
              <ShoppingBag size={17} /> {cantTotal} {cantTotal === 1 ? "ítem" : "ítems"}
            </span>
            <span className="text-sm font-black">{fmtMoney(desglose.subtotal, t.moneda)} → Ver pedido</span>
          </button>
        </div>
      )}

      {/* Chatbot (directiva #2) */}
      <ChatWidget slug={t.slug} audiencia="cliente" nombreTienda={t.nombre} offsetAboveCart={cantTotal > 0} />

      {/* ============ CHECKOUT (sheet) ============ */}
      {paso === "checkout" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPaso("tienda")}>
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-slate-50 p-5 pb-8 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Tu pedido</h2>
              <button onClick={() => setPaso("tienda")} aria-label="Cerrar"><X size={20} className="text-slate-400" /></button>
            </div>

            {/* Ítems */}
            <div className="space-y-2">
              {lineas.map((l) => (
                <div key={l.producto.id} className="card flex items-center gap-3 p-3">
                  {l.producto.fotos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.producto.fotos[0]} alt={l.producto.nombre} className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <span className="text-2xl">{l.producto.emoji}</span>
                  )}
                  <div className="flex-1">
                    <div className="text-[13px] font-bold">{l.producto.nombre}</div>
                    <div className="text-xs text-slate-500">{fmtMoney(l.producto.precio, t.moneda)} c/u</div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                    <button onClick={() => add(l.producto.id, -1)}><Minus size={13} /></button>
                    <span className="text-sm font-black">{l.cantidad}</span>
                    <button onClick={() => add(l.producto.id, 1)}><Plus size={13} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Entrega */}
            <div className="mt-5">
              <span className="label-xs">Entrega</span>
              <div className="grid grid-cols-2 gap-2">
                {(t.modoEntrega === "ambos" ? ["retiro", "envio"] : [t.modoEntrega]).map((m) => {
                  const info = MODOS_ENTREGA.find((x) => x.id === m)!;
                  const costo = m === "envio" ? fmtMoney(t.costoEnvio, t.moneda) : "Gratis";
                  return (
                    <button key={m} onClick={() => setModo(m as ModoEntregaId)}
                      className={`rounded-xl border-2 p-3 text-left text-xs font-bold transition ${
                        modo === m ? "border-brand bg-brand/10" : "border-slate-200 dark:border-slate-700"
                      }`}>
                      <div className="flex items-center gap-1.5">
                        {m === "retiro" ? <StoreIcon size={14} /> : <Truck size={14} />}
                        {info.nombre}
                      </div>
                      <div className="mt-1 font-semibold text-slate-500">{costo}</div>
                    </button>
                  );
                })}
              </div>
              {modo === "envio" && (
                <input className="input mt-2" placeholder="Tu dirección (calle y número)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              )}
              {modo === "retiro" && t.dirRetiro && (
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {t.dirRetiro}</p>
              )}
            </div>

            {/* Datos */}
            <div className="mt-5">
              <span className="label-xs">Tus datos (comprás como invitado)</span>
              <input className="input" placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input" type="tel" placeholder="Celular" value={celular} onChange={(e) => setCelular(e.target.value)} />
              </div>
              <input className="input mt-2" placeholder="Nota (opcional: 'sin cebolla', 'timbre 2'...)" value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>

            {/* Método de pago */}
            <div className="mt-5">
              <span className="label-xs">Método de pago</span>
              <div className="space-y-2">
                {METODOS_PAGO.filter((m) => m.id !== "otro").map((m) => {
                  const esDto = dtoPagoPublic > 0 && m.id === t.metodoDescuento;
                  return (
                    <button key={m.id} onClick={() => setMetodo(m.id)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-sm transition ${
                        metodo === m.id ? "border-brand bg-brand/10" : "border-slate-200 dark:border-slate-700"
                      }`}>
                      <span className="font-bold">{m.emoji} {m.nombre}</span>
                      {esDto && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-600">-{dtoPagoPublic}%</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desglose (siempre visible — transparencia N6) */}
            <div className="card mt-5 space-y-1.5 p-4 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmtMoney(desglose.subtotal, t.moneda)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Envío ({modo})</span><span>{desglose.envio === 0 ? "Gratis" : fmtMoney(desglose.envio, t.moneda)}</span></div>
              {desglose.descuento > 0 && (
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>{textoRegla(desglose.regla)}</span>
                  <span>−{fmtMoney(desglose.descuento, t.moneda)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 text-base font-black dark:border-slate-700">
                <span>TOTAL</span><span>{fmtMoney(desglose.total, t.moneda)}</span>
              </div>
            </div>
            <p className="mt-2 flex items-start gap-1 text-[10.5px] leading-snug text-slate-400">
              <Clock size={11} className="mt-0.5 shrink-0" />
              Recibirás un comprobante de pedido por email (no válido como factura). El comercio emite el comprobante fiscal correspondiente.
            </p>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-600 dark:border-rose-900 dark:bg-rose-950/50">
                {error}
              </div>
            )}
            <button onClick={confirmar} disabled={!puedeConfirmar} className="btn-primary mt-4 w-full text-base">
              {isPending ? "Creando pedido..." : (
                <span className="flex items-center justify-center gap-2"><Send size={16} /> Confirmar pedido · {fmtMoney(desglose.total, t.moneda)}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
