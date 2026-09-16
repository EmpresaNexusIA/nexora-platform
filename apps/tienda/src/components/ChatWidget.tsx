"use client";

// NEXORA · ChatWidget — el asistente (directiva fundador #2, NO genérico:
// consume la API /api/assistant con contexto real de la tienda/cuenta).

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";

interface Msg { rol: "bot" | "user"; texto: string }

interface Props {
  slug: string;
  audiencia: "cliente" | "vendedor";
  nombreTienda: string;
  offsetAboveCart?: boolean;
}

const SALUDOS_INICIALES: Record<string, (n: string) => string> = {
  cliente: (n) => `¡Hola! 👋 Soy el asistente de ${n}. Te cuento precios, stock, envíos y descuentos. ¿Qué buscás?`,
  vendedor: () => `¡Hola! 👋 Soy tu copiloto Nexora. Preguntame por ventas, pedidos pendientes o stock.`,
};

export function ChatWidget({ slug, audiencia, nombreTienda, offsetAboveCart }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ rol: "bot", texto: SALUDOS_INICIALES[audiencia](nombreTienda) }]);
  const [input, setInput] = useState("");
  const [sugerencias, setSugerencias] = useState<string[]>(audiencia === "cliente" ? ["Ver precios", "¿Hacen envíos?", "Ver descuentos"] : ["Ventas de hoy", "Pedidos pendientes", "Stock bajo"]);
  const [escribiendo, setEscribiendo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, escribiendo]);

  const enviar = async (texto: string) => {
    const clean = texto.trim();
    if (!clean || escribiendo) return;
    setMsgs((m) => [...m, { rol: "user", texto: clean }]);
    setInput("");
    setEscribiendo(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, audiencia, mensaje: clean }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsgs((m) => [...m, { rol: "bot", texto: data.texto }]);
        if (data.sugerencias?.length) setSugerencias(data.sugerencias);
      } else {
        setMsgs((m) => [...m, { rol: "bot", texto: "Uf, me trabé 😅 Probá de nuevo." }]);
      }
    } catch {
      setMsgs((m) => [...m, { rol: "bot", texto: "Sin conexión por acá. Probá en un toque." }]);
    } finally {
      setEscribiendo(false);
    }
  };

  return (
    <>
      {abierto && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto w-[92%] max-w-sm md:bottom-24" style={{ maxWidth: 340, marginRight: 16, marginLeft: "auto" }}>
          <div className="card flex h-[380px] flex-col overflow-hidden !shadow-2xl">
            <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
              <div className="flex items-center gap-2 text-sm font-black">
                <Sparkles size={15} />
                {audiencia === "cliente" ? `Asistente de ${nombreTienda}` : "Copiloto Nexora"}
              </div>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar chat"><X size={17} /></button>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.rol === "user"
                        ? "rounded-br-sm bg-brand text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {m.texto}
                  </div>
                </div>
              ))}
              {escribiendo && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-400 dark:bg-slate-800">escribiendo…</div>
                </div>
              )}
            </div>
            <div className="chips flex gap-1.5 overflow-x-auto px-3 pb-1.5">
              {sugerencias.map((s) => (
                <button key={s} onClick={() => enviar(s)} className="chip chip-off !py-1 text-[11px]">{s}</button>
              ))}
            </div>
            <form
              className="flex items-center gap-2 border-t border-slate-200 p-2.5 dark:border-slate-800"
              onSubmit={(e) => { e.preventDefault(); enviar(input); }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={audiencia === "cliente" ? "Preguntá por productos..." : "Preguntame lo que necesites..."}
                className="w-full bg-transparent px-2 text-sm outline-none placeholder:text-slate-400"
              />
              <button type="submit" aria-label="Enviar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition active:scale-90">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
      <button
        onClick={() => setAbierto(!abierto)}
        aria-label="Abrir asistente"
        className={`fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-xl shadow-brand/40 transition hover:scale-105 active:scale-95 ${
          offsetAboveCart ? "bottom-[138px]" : "bottom-5"
        }`}
      >
        {abierto ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
