// NEXORA · Asistente — DIRECTIVA FUNDADOR #2
// Dos personajes NO genéricos (viven de datos reales de la tienda):
//   · "el de la tienda" (cliente): catálogo, precios, stock, envíos, descuentos, pedido
//   · "el contador/copiloto" (vendedor): caja, pendientes, stock bajo, tips
// HOY: motor de reglas + contexto ($0, sin API). MAÑANA: setear LLM_PROVIDER
// en .env y pasar este MISMO contexto como system prompt (ya está preparado).

import type { Comercio, Producto, ResumenCaja } from "../types";
import type { PedidoConItems } from "../data/adapter";
import { fmtMoney } from "../format";
import { descuentoPorPago } from "../money";

export interface RespuestaChat {
  texto: string;
  sugerencias: string[];
}

export interface ContextoTienda {
  tienda: Comercio;
  productos: Producto[];
  caja?: ResumenCaja | null;
  pedidos?: PedidoConItems[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function buscarProductos(productos: Producto[], q: string): Producto[] {
  const n = norm(q);
  const stop = new Set(["el", "la", "de", "del", "en", "un", "una", "cuanto", "cuesta", "vale", "hay", "tienen", "queda", "quiero", "el", "precio", "por", "me", "das"]);
  const tokens = n.split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
  if (!tokens.length) return [];
  return productos.filter((p) => {
    const texto = norm(`${p.nombre} ${p.descripcion}`);
    return tokens.some((t) => texto.includes(t));
  }).slice(0, 3);
}

function fmtDisponible(p: Producto): string {
  if (!p.disponible) return "AGOTADO por hoy";
  if (p.stockNumerico !== null) return `quedan ${p.stockNumerico}`;
  return "disponible";
}

// =================== CLIENTE (lado de la tienda) ===================
export function responderCliente(ctx: ContextoTienda, mensaje: string): RespuestaChat {
  const { tienda: t, productos } = ctx;
  const m = norm(mensaje);

  // Estado de pedido por número: "pedido 42" / "#042"
  const matchPed = m.match(/(\d{1,4})/);
  if ((m.includes("pedid") || m.includes("orden") || m.includes("estad")) && matchPed) {
    const num = `#${matchPed[1].padStart(3, "0")}`;
    return {
      texto: `Para ver el estado de tu pedido ${num}, abrí el link de seguimiento que te llegó con el comprobante 📄. Si no lo encontrás, avisale a ${t.nombre} por WhatsApp y te lo reenvía al toque.`,
      sugerencias: ["¿Cómo pago?", "¿Hacen envíos?", "Horarios"],
    };
  }

  // Producto / precio / stock
  const hallados = buscarProductos(productos, m.replace(/^(tenes|tienen|hay)\s+/, ""));
  if (hallados.length > 0 &&
      (m.includes("precio") || m.includes("cuesta") || m.includes("vale") || m.includes("hay") ||
       m.includes("tienen") || m.includes("stock") || m.includes("queda") || hallados.some((p) => m.includes(norm(p.nombre).split(" ")[0])))) {
    const lineas = hallados
      .map((p) => `• ${p.emoji} ${p.nombre}: ${fmtMoney(p.precio, t.moneda)} (${fmtDisponible(p)})`)
      .join("\n");
    return {
      texto: `${lineas}\n\n¿Te armo el pedido? Tocá "+" en la tienda o contame qué querés llevar.`,
      sugerencias: ["¿Hacen envíos?", "¿Cómo pago?", "Ver descuentos"],
    };
  }

  // Envíos / retiro
  if (m.includes("envio") || m.includes("envian") || m.includes("repart") || m.includes("domicilio") || m.includes("retir")) {
    const envio = t.modoEntrega === "retiro"
      ? `Por ahora solo retiro en el local: 📍 ${t.dirRetiro}.`
      : t.modoEntrega === "envio"
        ? `🛵 Sí, envíos a domicilio por ${fmtMoney(t.costoEnvio, t.moneda)}.`
        : `🛵 Hacemos envíos por ${fmtMoney(t.costoEnvio, t.moneda)} y también podés retirar en 📍 ${t.dirRetiro}.`;
    return { texto: envio, sugerencias: ["¿Horarios?", "¿Cómo pago?", "Ver precios"] };
  }

  // Horarios
  if (m.includes("horario") || m.includes("abren") || m.includes("cierran") || m.includes("abierto")) {
    return {
      texto: `🕐 ${t.horarios || "Consultanos el horario por WhatsApp"}.`,
      sugerencias: ["¿Hacen envíos?", "Ver descuentos", "¿Cómo pago?"],
    };
  }

  // Pagos / descuentos
  if (m.includes("pago") || m.includes("pagar") || m.includes("efectivo") || m.includes("tarjeta") || m.includes("transfer")) {
    const dto = descuentoPorPago(t, t.metodoDescuento as never);
    const extra = dto > 0
      ? `\n\n🔥 Dato: pagando en ${t.metodoDescuento} tenés ${dto}% de descuento.`
      : "";
    return {
      texto: `Podés pagar en efectivo, transferencia o QR de Mercado Pago (te muestro la foto del QR en el checkout).${extra}`,
      sugerencias: ["Ver descuentos", "¿Hacen envíos?", "Ver precios"],
    };
  }
  if (m.includes("descuento") || m.includes("oferta") || m.includes("promo")) {
    const dto = descuentoPorPago(t, t.metodoDescuento as never);
    return {
      texto: dto > 0
        ? `🔥 Ahora hay ${dto}% off pagando en ${t.metodoDescuento}. Además, si comprás seguido te pueden hacer cliente frecuente con descuento VIP.`
        : "Cuando hay promos aparecen en los productos. Y si sos cliente frecuente, la tienda te puede dar un descuento VIP ⭐.",
      sugerencias: ["¿Cómo pago?", "Ver precios", "Horarios"],
    };
  }

  // Saludo
  if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|ey|hey)/.test(m)) {
    return {
      texto: `¡Hola! 👋 Soy el asistente de ${t.nombre}. Te puedo contar precios, stock, envíos, horarios y descuentos. ¿Qué buscás?`,
      sugerencias: ["Ver precios", "¿Hacen envíos?", "Ver descuentos"],
    };
  }

  // Humano / contacto
  if (m.includes("humano") || m.includes("persona") || m.includes("hablar") || m.includes("whatsapp") || m.includes("reclamo")) {
    return {
      texto: `Dale, te comunicás directo: el botón verde de WhatsApp acá en la tienda va al celular de ${t.nombre} 💬. Respondemos rápido.`,
      sugerencias: ["Ver precios", "¿Hacen envíos?"],
    };
  }

  // Recomendación general
  if (m.includes("recomend") || m.includes("que hay") || m.includes("que venden") || m.includes("menu") || m.includes("catalogo") || m.includes("precio")) {
    const disp = productos.filter((p) => p.disponible).slice(0, 4);
    const lineas = disp.map((p) => `• ${p.emoji} ${p.nombre} — ${fmtMoney(p.precio, t.moneda)}`).join("\n");
    return {
      texto: `Mirá lo que tienen hoy:\n${lineas}\n\nUsá el buscador de arriba para encontrar algo puntual 🔍`,
      sugerencias: ["¿Hacen envíos?", "¿Cómo pago?", "Ver descuentos"],
    };
  }

  // Fallback → canal humano (nunca inventar precios ni promesas)
  return {
    texto: `Mmm, eso mejor resolverlo con una persona de ${t.nombre} 😅. Escribiles por el botón de WhatsApp y enseguida te responden.\n\nYo te ayudo con: precios, stock, envíos, horarios y descuentos.`,
    sugerencias: ["Ver precios", "¿Hacen envíos?", "Horarios"],
  };
}

// =================== VENDEDOR (copiloto del panel) ===================
export function responderVendedor(ctx: ContextoTienda, mensaje: string): RespuestaChat {
  const { tienda: t, productos, caja, pedidos = [] } = ctx;
  const m = norm(mensaje);

  const pendientes = pedidos.filter((p) => p.estado === "pendiente");
  const enCurso = pedidos.filter((p) => p.estado === "confirmado" || p.estado === "en_preparacion");
  const stockBajo = productos.filter((p) => p.stockNumerico !== null && p.stockNumerico > 0 && p.stockNumerico <= 5);
  const agotados = productos.filter((p) => !p.disponible);

  if (m.includes("vendi") || m.includes("venta") || m.includes("caja") || m.includes("recaudad") || m.includes("hoy")) {
    if (!caja) return { texto: "Todavía no tengo datos de tu caja.", sugerencias: ["Pedidos pendientes"] };
    const porCobrar = caja.porCobrar > 0 ? `\n⏳ Por cobrar: ${fmtMoney(caja.porCobrar, t.moneda)}` : "";
    return {
      texto:
        `📊 Hoy vendiste ${fmtMoney(caja.total, t.moneda)} en ${caja.pedidos} pedidos (ticket promedio ${fmtMoney(caja.ticketPromedio, t.moneda)}).\n` +
        `✓ Cobrado: ${fmtMoney(caja.cobrado, t.moneda)}${porCobrar}\n` +
        (caja.topProductos[0] ? `🏆 Top del día: ${caja.topProductos[0].nombre} (${caja.topProductos[0].cantidad} u.)` : ""),
      sugerencias: ["Pedidos pendientes", "Stock bajo", "Tips para vender más"],
    };
  }
  if (m.includes("pendiente") || m.includes("pedido") || m.includes("sin atender")) {
    if (!pendientes.length && !enCurso.length) {
      return { texto: "✅ Tenés todo al día: no hay pedidos pendientes ni en curso. ¡Tiempo de promocionar tu link!", sugerencias: ["Ventas de hoy", "Tips para vender más"] };
    }
    const lista = [...pendientes, ...enCurso].slice(0, 4)
      .map((p) => `• ${p.numeroOrden} · ${p.clienteNombre} · ${fmtMoney(p.totalFinal, t.moneda)} (${p.estado})`).join("\n");
    return {
      texto: `📋 Tenés ${pendientes.length} pendiente(s) y ${enCurso.length} en curso:\n${lista}\nLos pendientes hace rato sin confirmar asustan al cliente: ¡a darles! 💪`,
      sugerencias: ["Ventas de hoy", "Stock bajo"],
    };
  }
  if (m.includes("stock") || m.includes("agotado") || m.includes("faltante")) {
    const partes: string[] = [];
    if (agotados.length) partes.push(`🔴 Agotados: ${agotados.map((p) => p.nombre).join(", ")}.`);
    if (stockBajo.length) partes.push(`🟡 Stock bajo: ${stockBajo.map((p) => `${p.nombre} (${p.stockNumerico})`).join(", ")}.`);
    if (!partes.length) partes.push("✅ Stock saludable en todo el catálogo.");
    return { texto: partes.join("\n"), sugerencias: ["Ventas de hoy", "Pedidos pendientes"] };
  }
  if (m.includes("descuento") || m.includes("promo") || m.includes("oferta")) {
    return {
      texto: `Tu promo actual: ${t.porcentajeDescuento}% pagando en ${t.metodoDescuento} (vigente hasta ${t.dtoHasta || "sin fin"}).\n` +
        (t.acumularDescuentos
          ? `Acumulable con VIP, con tope de ${t.topeDescuento}%.`
          : `No acumulable: siempre se aplica la mejor oferta para el cliente (Max), que es lo que más fideliza.`) +
        `\nTip: una promo con fecha de fin crea urgencia real 🔥`,
      sugerencias: ["¿Cómo van los frecuentes?", "Tips para vender más"],
    };
  }
  if (m.includes("frecuente") || m.includes("cliente vip") || m.includes("vip") || m.includes("fidel")) {
    return {
      texto: `El programa de frecuentes es tu máquina de recurrentes ⭐. Marcá VIPs desde la pestaña Clientes o dejá la regla automática (tuya: cada ${t.umbralFrecuente || "—"} pedidos).\nLos VIPs ven su descuento solo al pagar: sorpresa positiva = recompra.`,
      sugerencias: ["Tips para vender más", "Ventas de hoy"],
    };
  }
  if (m.includes("tip") || m.includes("vender mas") || m.includes("mejorar") || m.includes("crecer") || m.includes("ayuda")) {
    return {
      texto:
        `📈 3 palancas para HOY:\n` +
        `1️⃣ Compartí tu link en el estado de WhatsApp + bio de Instagram (es tu canal #1).\n` +
        `2️⃣ Los pendientes confirmalos rápido: pedido sin respuesta = venta muerta.\n` +
        `3️⃣ Promo con fecha de fin (${t.porcentajeDescuento}% en ${t.metodoDescuento}): contala en tus historias.`,
      sugerencias: ["Pedidos pendientes", "Ventas de hoy", "Stock bajo"],
    };
  }
  if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|ey|hey)/.test(m)) {
    return {
      texto: `¡Hola! 👋 Soy tu copiloto Nexora. Te aviso cómo va el día, qué pedidos esperan y qué conviene revisar. ¿Qué miramos?`,
      sugerencias: ["Ventas de hoy", "Pedidos pendientes", "Tips para vender más"],
    };
  }
  return {
    texto: `Puedo ayudarte con: ventas del día, pedidos pendientes, stock, promos y tips de venta. Probá: "¿cuánto vendí hoy?" o "stock bajo" 📊`,
    sugerencias: ["Ventas de hoy", "Pedidos pendientes", "Stock bajo"],
  };
}

// =================== PROMPT PARA LLM (futuro enchufe) ===================
// Cuando LLM_PROVIDER != none, usar ESTE builder como system prompt y el
// historial del chat como mensajes. El motor de reglas queda de fallback.
export function buildSystemPrompt(ctx: ContextoTienda, audiencia: "cliente" | "vendedor"): string {
  const { tienda: t, productos } = ctx;
  const catalogo = productos
    .filter((p) => !p.eliminado)
    .map((p) => `- ${p.nombre}: $${p.precio} (${p.disponible ? (p.stockNumerico != null ? `quedan ${p.stockNumerico}` : "disponible") : "agotado"})`)
    .join("\n");
  return [
    `Sos el asistente ${audiencia === "cliente" ? "de la tienda " + t.nombre : "copiloto del vendedor de " + t.nombre}.`,
    `Respondé en español argentino (voseo), breve, cálido y con datos reales. NUNCA inventes precios ni promesas.`,
    `Datos de la tienda: envío $${t.costoEnvio} (modo ${t.modoEntrega}), retiro en ${t.dirRetiro}, horarios: ${t.horarios}.`,
    `Promo: ${t.porcentajeDescuento}% en ${t.metodoDescuento}${t.acumularDescuentos ? ` (acumulable hasta ${t.topeDescuento}%)` : " (no acumulable, se aplica la mejor)"}.`,
    `Catálogo actual:\n${catalogo}`,
    audiencia === "cliente"
      ? `Si no sabés algo, derivá al WhatsApp de la tienda.`
      : `Priorizá: pedidos pendientes, stock bajo y acciones para vender más hoy.`,
  ].join("\n");
}
