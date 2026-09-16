// NEXORA · Implementación DEMO (DEMO_MODE=true): datos en memoria con
// "Panadería María" de ejemplo. Toda la lógica de negocio corre ACÁ con
// las mismas reglas N1-N15 → es el espejo exacto de lo que luego hace
// la Edge Function / SQL en Supabase.

import type {
  Categoria, ClienteFrecuente, Comercio, ItemPedido, Pedido,
  Producto, ResumenCaja, EstadoPedido,
} from "../types";
import type {
  CrearPedidoInput, NexoraDB, PedidoConItems, ResultadoPedido,
} from "./adapter";
import { computeDesglose, round2 } from "../money";
import { TRANSICIONES, ANTISPAM } from "../constants";
import { generarToken, hoyISOlocal, soloDigitos } from "../format";
import { mensajePedido, waLink } from "../wa";

// ---------- utilidades de tiempo (demo siempre "viva") ----------
const haceMin = (m: number) => new Date(Date.now() - m * 60e3).toISOString();
const haceHoras = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const haceDias = (d: number, hora = 12) => {
  const x = new Date(Date.now() - d * 86400e3);
  x.setHours(hora, Math.floor(Math.random() * 40), 0, 0);
  return x.toISOString();
};
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- SEED ----------
const TIENDA_ID = "c1";
const hoyMas = (dias: number) => {
  const x = new Date(Date.now() + dias * 86400e3);
  return x.toISOString().slice(0, 10);
};

const tienda: Comercio = {
  id: TIENDA_ID,
  duenoId: "u1",
  slug: "panaderia-maria",
  nombre: "Panadería María",
  emailDueno: "maria@ejemplo.com",
  emailVerificado: true,
  whatsapp: "5493410000000",
  rubro: "Panadería",
  moneda: "ARS",
  zonaHoraria: "America/Cordoba",
  publicada: true,
  diseno: "cuadricula",
  colorPrincipal: "#f59e0b",
  tema: "ambar",
  logoEmoji: "🍞",
  descripcion: "Panificados artesanales todos los días. Retiro en el local o envíos por la zona.",
  dirRetiro: "Bv. Oroño 1234, Rosario",
  modoEntrega: "ambos",
  costoEnvio: 1500,
  horarios: "Lun a Sáb 8 a 20 h · Dom 8 a 13 h",
  instagram: "panaderia.maria",
  plan: "emprendedor",
  estadoSuscripcion: "trial",
  fechaFinTrial: null,
  linkPago: "https://mpago.la/panaderiamaria",
  qrUrl: "",
  metodoDescuento: "efectivo",
  porcentajeDescuento: 10,
  dtoDesde: hoyMas(-30),
  dtoHasta: hoyMas(16),
  acumularDescuentos: false,
  topeDescuento: 25,
  umbralFrecuente: 5,
  contadorPedidos: 43,
  eliminado: false,
};

const categorias: Categoria[] = [
  { id: "cat1", comercioId: TIENDA_ID, nombre: "Panificados", orden: 1, eliminado: false },
  { id: "cat2", comercioId: TIENDA_ID, nombre: "Facturas", orden: 2, eliminado: false },
  { id: "cat3", comercioId: TIENDA_ID, nombre: "Tortas", orden: 3, eliminado: false },
  { id: "cat4", comercioId: TIENDA_ID, nombre: "Cafetería", orden: 4, eliminado: false },
];

const productos: Producto[] = [
  { id: "p1", comercioId: TIENDA_ID, categoriaId: "cat1", nombre: "Pan de campo (kg)", precio: 3800, fotos: [], emoji: "🥖", disponible: false, stockNumerico: null, descripcion: "De masa madre, corteza crocante.", orden: 1, eliminado: false },
  { id: "p2", comercioId: TIENDA_ID, categoriaId: "cat2", nombre: "Facturas x docena", precio: 5200, fotos: [], emoji: "🥐", disponible: true, stockNumerico: 14, descripcion: "Surtidas: manteca, dulce de leche y membrillo.", orden: 2, eliminado: false },
  { id: "p3", comercioId: TIENDA_ID, categoriaId: "cat3", nombre: "Torta rogel", precio: 12500, fotos: [], emoji: "🍰", disponible: true, stockNumerico: null, descripcion: "8 capas con dulce de leche y merengue.", orden: 3, eliminado: false },
  { id: "p4", comercioId: TIENDA_ID, categoriaId: "cat4", nombre: "Muffins x6", precio: 3800, fotos: [], emoji: "🧁", disponible: true, stockNumerico: 22, descripcion: "Vainilla con chips de chocolate.", orden: 4, eliminado: false },
  { id: "p5", comercioId: TIENDA_ID, categoriaId: "cat1", nombre: "Pan integral con semillas (kg)", precio: 4500, fotos: [], emoji: "🍞", disponible: true, stockNumerico: 8, descripcion: "Semillas de girasol, lino y sésamo.", orden: 5, eliminado: false },
  { id: "p6", comercioId: TIENDA_ID, categoriaId: "cat2", nombre: "Medialunas x docena", precio: 4800, fotos: [], emoji: "🌙", disponible: true, stockNumerico: null, descripcion: "De manteca o de grasa, recién horneadas.", orden: 6, eliminado: false },
  { id: "p7", comercioId: TIENDA_ID, categoriaId: "cat3", nombre: "Chocotorta", precio: 11000, fotos: [], emoji: "🍫", disponible: true, stockNumerico: null, descripcion: "La clásica: chocolinas y dulce de leche.", orden: 7, eliminado: false },
  { id: "p8", comercioId: TIENDA_ID, categoriaId: "cat4", nombre: "Café con leche + 2 medialunas", precio: 3500, fotos: [], emoji: "☕", disponible: true, stockNumerico: null, descripcion: "Promo de la casa.", orden: 8, eliminado: false },
  { id: "p9", comercioId: TIENDA_ID, categoriaId: "cat1", nombre: "Chipá x docena", precio: 5500, fotos: [], emoji: "🧀", disponible: true, stockNumerico: 6, descripcion: "Receta tradicional correntina.", orden: 9, eliminado: false },
  { id: "p10", comercioId: TIENDA_ID, categoriaId: "cat4", nombre: "Alfajores de maicena x6", precio: 6000, fotos: [], emoji: "🍪", disponible: true, stockNumerico: null, descripcion: "Con dulce de leche y coco rallado.", orden: 10, eliminado: false },
];

const clientes: ClienteFrecuente[] = [
  { id: "f1", comercioId: TIENDA_ID, usuarioId: "u101", nombreCliente: "Lucía Pérez", telefonoCliente: "3415000001", esFrecuente: true, descuentoEspecial: 15, origen: "manual", pedidosFinalizados: 8 },
  { id: "f2", comercioId: TIENDA_ID, usuarioId: "u102", nombreCliente: "Marcos Gómez", telefonoCliente: "3415000002", esFrecuente: false, descuentoEspecial: 0, origen: "manual", pedidosFinalizados: 4 },
  { id: "f3", comercioId: TIENDA_ID, usuarioId: "u103", nombreCliente: "Ana Suárez", telefonoCliente: "3415000003", esFrecuente: false, descuentoEspecial: 0, origen: "manual", pedidosFinalizados: 2 },
];

interface PedidoDemo extends PedidoConItems { reintegroHecho: boolean }

function mk(
  nro: number, estado: EstadoPedido, cliente: string, email: string, tel: string,
  itemsDemo: [string, string, number, number][], // [productoId, nombre, precio, cant]
  metodo: Pedido["metodoPago"], entrega: Pedido["modoEntrega"], pagado: boolean,
  creadoEn: string, notas = "", dir = "",
): PedidoDemo {
  const items: ItemPedido[] = itemsDemo.map(([pid, nom, precio, cant], i) => ({
    id: uid(), pedidoId: "", productoId: pid as string, nombreCongelado: nom,
    precioCongelado: precio, cantidad: cant, subtotal: round2(precio * cant),
  }));
  const subtotal = round2(items.reduce((a, i) => a + i.subtotal, 0));
  const envio = entrega === "envio" ? tienda.costoEnvio : 0;
  const dto = email === "lucia@ejemplo.com"
    ? computeDesglose({ tienda, lineas: items.map((i) => ({ precio: i.precioCongelado, cantidad: i.cantidad })), modoEntrega: entrega, metodoPago: metodo, dtoVipPct: 15 })
    : computeDesglose({ tienda, lineas: items.map((i) => ({ precio: i.precioCongelado, cantidad: i.cantidad })), modoEntrega: entrega, metodoPago: metodo, dtoVipPct: 0 });
  const p: PedidoDemo = {
    id: uid(), token: generarToken(), comercioId: TIENDA_ID,
    clienteId: "u" + nro, numeroOrden: `#0${nro}`, estado, pagado, metodoPago: metodo,
    modoEntrega: entrega, direccionEntrega: dir, clienteNombre: cliente,
    clienteEmail: email, clienteTelefono: tel, notasCliente: notas,
    costoEnvio: envio, subtotal, descuentoAplicado: dto.descuento,
    totalFinal: dto.total, dtoRegla: dto.regla, urlPdf: "",
    creadoEn, ultimoCambioEstado: creadoEn, eliminado: false,
    items, reintegroHecho: false,
  };
  items.forEach((i) => (i.pedidoId = p.id));
  return p;
}

const pedidos: PedidoDemo[] = [
  mk(43, "pendiente", "Lucía Pérez", "lucia@ejemplo.com", "3415000001",
    [["p3", "Torta rogel", 12500, 2]], "qr", "envio", true, haceMin(4),
    "Es para un cumple, ¿puede ser hoy?", "San Luis 450, Rosario"),
  mk(42, "en_preparacion", "Marcos Gómez", "marcos@ejemplo.com", "3415000002",
    [["p2", "Facturas x docena", 5200, 1], ["p4", "Muffins x6", 3800, 1]],
    "efectivo", "retiro", false, haceHoras(1)),
  mk(41, "finalizado", "Ana Suárez", "ana@ejemplo.com", "3415000003",
    [["p3", "Torta rogel", 12500, 1]], "transferencia", "retiro", true, haceHoras(3)),
  mk(40, "finalizado", "Pedro Luna", "pedro@ejemplo.com", "3415000004",
    [["p2", "Facturas x docena", 5200, 2], ["p6", "Medialunas x docena", 4800, 1]],
    "efectivo", "envio", true, haceHoras(5), "", "Roca 88, Rosario"),
  mk(39, "cancelado", "Sofía Ríos", "sofia@ejemplo.com", "3415000005",
    [["p7", "Chocotorta", 11000, 1]], "qr", "retiro", false, haceHoras(6), "Ya no lo necesito"),
  mk(38, "finalizado", "Juan Paz", "juan@ejemplo.com", "3415000006",
    [["p8", "Café con leche + 2 medialunas", 3500, 3], ["p9", "Chipá x docena", 5500, 1]],
    "efectivo", "retiro", true, haceDias(1, 9)),
  mk(37, "finalizado", "Lucía Pérez", "lucia@ejemplo.com", "3415000001",
    [["p10", "Alfajores de maicena x6", 6000, 2]], "efectivo", "retiro", true, haceDias(1, 18)),
  mk(36, "finalizado", "Marcos Gómez", "marcos@ejemplo.com", "3415000002",
    [["p5", "Pan integral con semillas (kg)", 4500, 2]], "transferencia", "envio", true, haceDias(2, 11)),
  mk(35, "finalizado", "Ana Suárez", "ana@ejemplo.com", "3415000003",
    [["p6", "Medialunas x docena", 4800, 1], ["p8", "Café con leche + 2 medialunas", 3500, 2]],
    "efectivo", "retiro", true, haceDias(3, 10)),
  mk(34, "finalizado", "Pedro Luna", "pedro@ejemplo.com", "3415000004",
    [["p1", "Pan de campo (kg)", 3600, 3]], "efectivo", "envio", true, haceDias(4, 12)), // precio viejo congelado 3600 vs 3800 actual ✓
  mk(33, "finalizado", "Juan Paz", "juan@ejemplo.com", "3415000006",
    [["p4", "Muffins x6", 3800, 4]], "qr", "retiro", true, haceDias(5, 16)),
  mk(32, "finalizado", "Sofía Ríos", "sofia@ejemplo.com", "3415000005",
    [["p2", "Facturas x docena", 5000, 1]], "efectivo", "retiro", true, haceDias(6, 9)),
];

const metricas: Record<string, number> = {}; // "slug@fecha" → visitas

// ---------- helpers internos ----------
const pedOrdenado = () =>
  [...pedidos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

function dtoVipPorEmail(tiendaId: string, email: string): number {
  const map: Record<string, string> = {
    "3415000001": "f1", "3415000002": "f2", "3415000003": "f3",
  };
  void map;
  const c = clientes.find((x) => x.comercioId === tiendaId);
  void c;
  // Demo: VIP por email conocido (Lucía)
  if (email === "lucia@ejemplo.com") {
    const lucia = clientes.find((x) => x.id === "f1");
    return lucia && lucia.esFrecuente ? lucia.descuentoEspecial : 0;
  }
  return 0;
}

function upsertClientePorPedido(p: Pedido) {
  // Regla demo: si no está, se agrega a la lista de clientes de la tienda.
  const existe = clientes.some(
    (c) => c.telefonoCliente === soloDigitos(p.clienteTelefono) && c.comercioId === p.comercioId,
  );
  if (!existe) {
    clientes.push({
      id: uid(), comercioId: p.comercioId, usuarioId: uid(),
      nombreCliente: p.clienteNombre, telefonoCliente: soloDigitos(p.clienteTelefono),
      esFrecuente: false, descuentoEspecial: 0, origen: "manual", pedidosFinalizados: 0,
    });
  }
}

// ---------- IMPLEMENTACIÓN DEL CONTRATO ----------
export const demoDB: NexoraDB = {
  async getTiendaPorSlug(slug) {
    return slug === tienda.slug && !tienda.eliminado ? { ...tienda } : null;
  },
  async getTiendaPorId(id) {
    return id === tienda.id ? { ...tienda } : null;
  },
  async updateComercio(_id, patch) {
    Object.assign(tienda, patch);
  },
  async registrarVisita(slug) {
    const k = `${slug}@${hoyISOlocal()}`;
    metricas[k] = (metricas[k] || 0) + 1;
  },

  async getCategorias(id) {
    return id === TIENDA_ID ? categorias.filter((c) => !c.eliminado) : [];
  },
  async crearCategoria(id, nombre) {
    const c: Categoria = { id: uid(), comercioId: id, nombre, orden: categorias.length + 1, eliminado: false };
    categorias.push(c);
    return c;
  },
  async getProductos(id) {
    return id === TIENDA_ID
      ? productos.filter((p) => !p.eliminado).sort((a, b) => a.orden - b.orden)
      : [];
  },
  async crearProducto(data) {
    const creados = productos.filter((p) => p.comercioId === data.comercioId && !p.eliminado).length;
    if (creados >= 999) return { ok: false, error: "Límite de productos alcanzado para tu plan." };
    const p: Producto = {
      id: uid(), comercioId: data.comercioId, categoriaId: data.categoriaId,
      nombre: data.nombre, precio: Math.max(0, round2(data.precio)),
      fotos: (data.fotos || []).slice(0, 3).filter((f) => typeof f === "string" && f.startsWith("/uploads/")),
      emoji: data.emoji || "🛍️", disponible: true, stockNumerico: data.stockNumerico,
      descripcion: "", orden: creados + 1, eliminado: false,
    };
    productos.push(p);
    return { ok: true, producto: p };
  },
  async setDisponible(comercioId, productoId, v) {
    // Fase 1.6 · P1: scoping por comercio (paridad con platform.ts).
    const p = productos.find((x) => x.id === productoId && x.comercioId === comercioId);
    if (p) p.disponible = v;
  },

  async getPedidos(id) {
    return id === TIENDA_ID ? pedOrdenado().map((p) => ({ ...p })) : [];
  },
  async getPedidoPorToken(token) {
    const p = pedidos.find((x) => x.token === token);
    return p ? { pedido: { ...p }, items: [...p.items], tienda: { ...tienda } } : null;
  },

  // =========================================================
  //  crearPedido — EL WORKFLOW REY (N3, N4, N5, N6, N12)
  // =========================================================
  async crearPedido(input: CrearPedidoInput): Promise<ResultadoPedido> {
    const t = tienda;
    if (input.slug !== t.slug || !t.publicada || t.eliminado) {
      return { ok: false, error: "Esta tienda está pausada o no existe." };
    }
    const lineas = input.lineas.filter((l) => l.cantidad > 0);
    if (lineas.length === 0) return { ok: false, error: "Tu pedido está vacío." };

    // N12 · Anti-spam por teléfono
    const tel = soloDigitos(input.cliente.telefono);
    const pendientesTel = pedidos.filter(
      (p) => soloDigitos(p.clienteTelefono) === tel && p.estado === "pendiente",
    ).length;
    if (pendientesTel >= ANTISPAM.maxPendientesPorTelefono) {
      return { ok: false, error: "Tenés varios pedidos pendientes en esta tienda. Esperá a que los confirmen 🙏" };
    }

    // Validar productos contra DB y calcular con precios ACTUALES de servidor (N3)
    const detalles: { producto: Producto; cantidad: number }[] = [];
    for (const l of lineas) {
      const prod = productos.find((p) => p.id === l.productoId && !p.eliminado);
      if (!prod) return { ok: false, error: "Un producto ya no existe. Recargá la tienda." };
      if (!prod.disponible) return { ok: false, error: `"${prod.nombre}" está agotado por hoy.` };
      if (prod.stockNumerico !== null && l.cantidad > prod.stockNumerico) {
        return { ok: false, error: `"${prod.nombre}": quedan solo ${prod.stockNumerico} unidades.` };
      }
      if (l.cantidad > 99) return { ok: false, error: "Cantidad máxima por producto: 99." };
      detalles.push({ producto: prod, cantidad: l.cantidad });
    }

    // Validar entrega
    if ((input.modoEntrega === "envio" && t.modoEntrega === "retiro") ||
        (input.modoEntrega === "retiro" && t.modoEntrega === "envio")) {
      return { ok: false, error: "Ese modo de entrega no está disponible en esta tienda." };
    }
    if (input.modoEntrega === "envio" && !input.direccionEntrega.trim()) {
      return { ok: false, error: "Necesitamos tu dirección para el envío." };
    }

    // CLIENTE + VIP (buscar por email/teléfono en clientes de ESTA tienda)
    let dtoVip = dtoVipPorEmail(t.id, input.cliente.email);
    const telLimpio = tel;
    const vip = clientes.find((c) => c.telefonoCliente === telLimpio && c.esFrecuente && c.comercioId === t.id);
    if (vip) dtoVip = Math.max(dtoVip, vip.descuentoEspecial);

    // N6 · El servidor calcula TODO (nunca lo que viene del front)
    const desglose = computeDesglose({
      tienda: t,
      lineas: detalles.map((d) => ({ precio: d.producto.precio, cantidad: d.cantidad })),
      modoEntrega: input.modoEntrega,
      metodoPago: input.metodoPago,
      dtoVipPct: dtoVip,
    });

    // N4 · Congelar ítems
    const items: ItemPedido[] = detalles.map((d) => ({
      id: uid(), pedidoId: "", productoId: d.producto.id,
      nombreCongelado: d.producto.nombre, precioCongelado: d.producto.precio,
      cantidad: d.cantidad, subtotal: round2(d.producto.precio * d.cantidad),
    }));

    // Numeración atómica
    t.contadorPedidos += 1;
    const numeroOrden = `#${String(t.contadorPedidos).padStart(3, "0")}`;

    const ahora = new Date().toISOString();
    const pedido: PedidoDemo = {
      id: uid(), token: generarToken(), comercioId: t.id, clienteId: "",
      numeroOrden, estado: "pendiente", pagado: false, metodoPago: input.metodoPago,
      modoEntrega: input.modoEntrega, direccionEntrega: input.direccionEntrega.trim(),
      clienteNombre: input.cliente.nombre.trim(), clienteEmail: input.cliente.email.trim().toLowerCase(),
      clienteTelefono: tel, notasCliente: input.notasCliente.trim(),
      costoEnvio: desglose.envio, subtotal: desglose.subtotal,
      descuentoAplicado: desglose.descuento, totalFinal: desglose.total,
      dtoRegla: desglose.regla, urlPdf: `${input.baseUrl}/pedido/${0}`, // placeholder, abajo va el token
      creadoEn: ahora, ultimoCambioEstado: ahora, eliminado: false,
      items, reintegroHecho: false,
    };
    items.forEach((i) => (i.pedidoId = pedido.id));
    pedido.urlPdf = `${input.baseUrl}/pedido/${pedido.token}`;

    // Stock: descontar (sin negativos; en 0 queda no disponible)
    for (const d of detalles) {
      if (d.producto.stockNumerico !== null) {
        d.producto.stockNumerico = Math.max(0, d.producto.stockNumerico - d.cantidad);
        if (d.producto.stockNumerico === 0) d.producto.disponible = false;
      }
    }

    pedidos.push(pedido);
    upsertClientePorPedido(pedido);
    const waUrl = waLink(t.whatsapp, mensajePedido(pedido, items, t, pedido.urlPdf));
    return { ok: true, pedido, items, waUrl, tokenSeguimiento: pedido.token };
  },

  async cambiarEstado(comercioId, pedidoId, nuevo, reintegrarStock) {
    // Fase 1.6 · P1: scoping por comercio (paridad con platform.ts).
    const p = pedidos.find((x) => x.id === pedidoId);
    if (!p || p.comercioId !== comercioId) return { ok: false, error: "Pedido no encontrado." };
    if (!TRANSICIONES[p.estado].includes(nuevo)) {
      return { ok: false, error: `No se puede pasar de "${p.estado}" a "${nuevo}".` };
    }
    // Cancelar → reintegrar stock UNA sola vez
    if (nuevo === "cancelado" && reintegrarStock && !p.reintegroHecho) {
      for (const it of p.items) {
        const prod = productos.find((x) => x.id === it.productoId);
        if (prod && prod.stockNumerico !== null) {
          prod.stockNumerico += it.cantidad;
          prod.disponible = true;
        }
      }
      p.reintegroHecho = true;
    }
    p.estado = nuevo;
    p.ultimoCambioEstado = new Date().toISOString();

    // N5 · Finalizado → suma al vínculo cliente-tienda + regla frecuente auto
    if (nuevo === "finalizado") {
      const tel = soloDigitos(p.clienteTelefono);
      const cf = clientes.find((c) => c.telefonoCliente === tel);
      if (cf) {
        cf.pedidosFinalizados += 1;
        if (!cf.esFrecuente && tienda.umbralFrecuente > 0 && cf.pedidosFinalizados >= tienda.umbralFrecuente) {
          cf.esFrecuente = true;
          cf.descuentoEspecial = cf.descuentoEspecial || 10;
          cf.origen = "auto";
        }
      }
    }
    return { ok: true };
  },

  async marcarPagado(comercioId, pedidoId, v) {
    // Fase 1.6 · P1: scoping por comercio (paridad con platform.ts).
    const p = pedidos.find((x) => x.id === pedidoId && x.comercioId === comercioId);
    if (p) p.pagado = v;
  },

  async getClientes(id) {
    return id === TIENDA_ID
      ? [...clientes].sort((a, b) => b.pedidosFinalizados - a.pedidosFinalizados)
      : [];
  },
  async setFrecuente(comercioId, id, esFrecuente, descuento) {
    // Fase 1.6 · P1: scoping por comercio (paridad con platform.ts).
    const c = clientes.find((x) => x.id === id && x.comercioId === comercioId);
    if (c) {
      c.esFrecuente = esFrecuente;
      c.descuentoEspecial = descuento;
      if (esFrecuente) c.origen = "manual";
    }
  },

  async getCaja(id): Promise<ResumenCaja> {
    if (id !== TIENDA_ID) throw new Error("sin tienda");
    const hoy = hoyISOlocal();
    const deHoy = pedidos.filter((p) => p.estado !== "cancelado" && p.creadoEn.slice(0, 10) === hoy);
    const cobrado = round2(deHoy.filter((p) => p.pagado).reduce((a, p) => a + p.totalFinal, 0));
    const total = round2(deHoy.reduce((a, p) => a + p.totalFinal, 0));
    const porMetodo: Record<string, number> = {};
    deHoy.forEach((p) => {
      porMetodo[p.metodoPago] = round2((porMetodo[p.metodoPago] || 0) + p.totalFinal);
    });
    const top = new Map<string, number>();
    deHoy.forEach((p) => p.items.forEach((i) => top.set(i.nombreCongelado, (top.get(i.nombreCongelado) || 0) + i.cantidad)));
    const topProductos = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    const ultimos7Dias = Array.from({ length: 7 }, (_, k) => {
      const fecha = new Date(Date.now() - (6 - k) * 86400e3).toISOString().slice(0, 10);
      const dia = ["D", "L", "M", "M", "J", "V", "S"][new Date(fecha).getDay()];
      const t = round2(
        pedidos.filter((p) => p.estado !== "cancelado" && p.creadoEn.slice(0, 10) === fecha)
          .reduce((a, p) => a + p.totalFinal, 0),
      );
      return { dia, total: t };
    });

    return {
      fecha: hoy, total, cobrado, porCobrar: round2(total - cobrado),
      pedidos: deHoy.length, ticketPromedio: deHoy.length ? round2(total / deHoy.length) : 0,
      porMetodo, topProductos, ultimos7Dias,
    };
  },
};
