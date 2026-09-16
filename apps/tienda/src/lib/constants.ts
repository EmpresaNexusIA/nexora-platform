// NEXORA · Constantes de negocio (fuente única de verdad)
// Regla: los límites por plan viven acá y se validan en servidor (N13).

export const PLANES = {
  gratis: {
    nombre: "Gratis",
    precio: 0,
    maxProductos: 30,
    maxFotosPorProducto: 1,
    categorias: false,
    reportes: false,
    descuentosAvanzados: false, // sin VIP ni vigencias
    selloNexora: true, // OBLIGATORIO: "Hecho con Nexora"
    estadisticas: false,
  },
  emprendedor: {
    nombre: "Emprendedor",
    precio: 7900, // ARS/mes (ver Nexora_Planes_y_Precios.txt)
    maxProductos: Infinity,
    maxFotosPorProducto: 3,
    categorias: true,
    reportes: true,
    descuentosAvanzados: true,
    selloNexora: false,
    estadisticas: true,
  },
  pro: {
    nombre: "Pro",
    precio: 14900,
    maxProductos: Infinity,
    maxFotosPorProducto: 3,
    categorias: true,
    reportes: true,
    descuentosAvanzados: true,
    selloNexora: false,
    estadisticas: true,
    // + MP integrado OAuth, dominio propio (FASE 2 real, fuera del MVP)
  },
} as const;
export type PlanId = keyof typeof PLANES;

export const DISEÑOS = [
  { id: "lista", nombre: "Lista", emoji: "📋" },
  { id: "cuadricula", nombre: "Cuadrícula", emoji: "▦" },
  { id: "banners", nombre: "Banners", emoji: "🖼️" },
] as const;
export type DisenoId = (typeof DISEÑOS)[number]["id"];

// DIRECTIVA FUNDADOR #1: solo 3 presets + modo oscuro (sin paleta libre)
export const TEMAS = [
  { id: "ambar", nombre: "Ámbar", brand: "245 158 11", accent: "217 119 6" },
  { id: "esmeralda", nombre: "Esmeralda", brand: "5 150 105", accent: "16 185 129" },
  { id: "azul", nombre: "Azul", brand: "37 99 235", accent: "96 165 250" },
] as const;
export type TemaId = (typeof TEMAS)[number]["id"];

export const ESTADOS_PEDIDO = {
  pendiente: { label: "Pendiente", color: "amber" },
  confirmado: { label: "Confirmado", color: "sky" },
  en_preparacion: { label: "En preparación", color: "indigo" },
  finalizado: { label: "Finalizado", color: "emerald" },
  cancelado: { label: "Cancelado", color: "rose" },
} as const;
export type EstadoPedido = keyof typeof ESTADOS_PEDIDO;

// Transiciones válidas (máquina de estados — regla N5)
export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["en_preparacion", "cancelado"],
  en_preparacion: ["finalizado", "cancelado"],
  finalizado: [],
  cancelado: [],
};

export const METODOS_PAGO = [
  { id: "efectivo", nombre: "Efectivo", emoji: "💵" },
  { id: "transferencia", nombre: "Transferencia", emoji: "🏦" },
  { id: "qr", nombre: "QR Mercado Pago", emoji: "🤳" },
  { id: "otro", nombre: "Otro", emoji: "💳" },
] as const;
export type MetodoPagoId = (typeof METODOS_PAGO)[number]["id"];

export const MODOS_ENTREGA = [
  { id: "retiro", nombre: "Retiro en el local", emoji: "🏪" },
  { id: "envio", nombre: "Envío a domicilio", emoji: "🛵" },
] as const;

// Anti-spam (regla N12)
export const ANTISPAM = {
  maxPendientesPorTelefono: 3,
  pedidosPorDiaAntesDeCaptcha: 2,
} as const;

export const TRIAL_DIAS = 14;
export const GRACIA_DIAS = 7;
export const RETENCION_SUSPENDIDA_DIAS = 90;
