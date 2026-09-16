// NEXORA · Tipos de dominio (espejo de supabase/migrations/0001_schema.sql)
import type { EstadoPedido, MetodoPagoId, PlanId, TemaId } from "./constants";

// Re-export de los tipos "option set" para que toda la app importe de un solo lugar
export type { EstadoPedido, MetodoPagoId, PlanId, TemaId } from "./constants";

export type ModoEntregaId = "retiro" | "envio";
export type ModoEntregaTienda = ModoEntregaId | "ambos";
export type EstadoSuscripcion = "trial" | "activa" | "vencida" | "suspendida";
export type Diseno = "lista" | "cuadricula" | "banners";

export interface Comercio {
  id: string;
  duenoId: string;
  slug: string;
  nombre: string;
  emailDueno: string;
  emailVerificado: boolean;
  whatsapp: string; // solo dígitos, con código de país
  rubro: string;
  moneda: string; // "ARS"
  zonaHoraria: string; // "America/Cordoba"
  publicada: boolean;
  diseno: Diseno;
  colorPrincipal: string; // legacy visual; ver `tema`
  tema: TemaId; // DIRECTIVA #1: presets + dark mode
  logoEmoji: string;
  descripcion: string;
  dirRetiro: string;
  modoEntrega: ModoEntregaTienda;
  costoEnvio: number;
  horarios: string;
  instagram: string;
  plan: PlanId;
  estadoSuscripcion: EstadoSuscripcion;
  fechaFinTrial: string | null;
  linkPago: string;
  qrUrl: string;
  metodoDescuento: MetodoPagoId | "ninguno";
  porcentajeDescuento: number;
  dtoDesde: string | null; // YYYY-MM-DD
  dtoHasta: string | null;
  acumularDescuentos: boolean;
  topeDescuento: number; // %
  umbralFrecuente: number; // 0 = desactivado
  // Push al vendedor (PLATFORM: orchestrator/Telegram y/o ntfy.sh)
  telegramChatId?: string | null;
  ntfyTopic?: string | null;
  contadorPedidos: number;
  eliminado: boolean;
}

export interface Categoria {
  id: string;
  comercioId: string;
  nombre: string;
  orden: number;
  eliminado: boolean;
}

export interface Producto {
  id: string;
  comercioId: string;
  categoriaId: string | null;
  nombre: string;
  precio: number;
  fotos: string[]; // máx según plan
  emoji: string; // placeholder visual (demo / fallback)
  disponible: boolean;
  stockNumerico: number | null; // null = sin control
  descripcion: string;
  orden: number;
  eliminado: boolean;
}

export interface PerfilCliente {
  id: string;
  email: string;
  nombre: string;
  telefono: string;
  esInvitado: boolean;
}

export interface ClienteFrecuente {
  id: string;
  comercioId: string;
  usuarioId: string;
  nombreCliente: string; // denormalizado para el panel
  telefonoCliente: string;
  esFrecuente: boolean;
  descuentoEspecial: number; // %
  origen: "manual" | "auto";
  pedidosFinalizados: number;
}

export interface Pedido {
  id: string;
  token: string; // link de seguimiento no adivinable
  comercioId: string;
  clienteId: string;
  numeroOrden: string; // "#043"
  estado: EstadoPedido;
  pagado: boolean;
  metodoPago: MetodoPagoId;
  modoEntrega: ModoEntregaId;
  direccionEntrega: string;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  notasCliente: string;
  costoEnvio: number;
  subtotal: number;
  descuentoAplicado: number;
  totalFinal: number;
  dtoRegla: string; // 'vip' | 'pago' | 'acumulado' | 'acumulado_tope' | 'ninguna'
  urlPdf: string;
  creadoEn: string; // ISO
  ultimoCambioEstado: string;
  eliminado: boolean;
}

export interface ItemPedido {
  id: string;
  pedidoId: string;
  productoId: string | null;
  nombreCongelado: string;
  precioCongelado: number;
  cantidad: number;
  subtotal: number;
}

export interface LineaCarrito {
  productoId: string;
  cantidad: number;
}

export interface DesgloseCarrito {
  subtotal: number;
  envio: number;
  dtoVip: number; // % calculado (0 si no aplica)
  dtoPago: number; // % calculado (0 si no aplica)
  dtoAplicadoPct: number;
  descuento: number; // $ (siempre sobre subtotal, NUNCA envío — regla N6)
  total: number;
  regla: Pedido["dtoRegla"];
}

export interface ResumenCaja {
  fecha: string;
  total: number;
  cobrado: number;
  porCobrar: number;
  pedidos: number;
  ticketPromedio: number;
  porMetodo: Record<string, number>;
  topProductos: { nombre: string; cantidad: number }[];
  ultimos7Dias: { dia: string; total: number }[];
}
