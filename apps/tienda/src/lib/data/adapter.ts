// NEXORA · Capa de datos — CONTRATO único para toda la app.
// Regla de arquitectura: la UI y las actions SOLO conocen esta interfaz.
// Hoy la implementa `demo.ts` (preview sin backend); mañana `supabase.ts`
// usando las migraciones 0001-0003. CERO cambios en pantallas al migrar.

import type {
  Categoria, ClienteFrecuente, Comercio, ItemPedido, Pedido,
  Producto, ResumenCaja, EstadoPedido, MetodoPagoId, ModoEntregaId, LineaCarrito,
} from "../types";

export interface CrearPedidoInput {
  slug: string;
  lineas: LineaCarrito[];
  cliente: { nombre: string; email: string; telefono: string };
  modoEntrega: ModoEntregaId;
  direccionEntrega: string;
  notasCliente: string;
  metodoPago: MetodoPagoId;
  baseUrl: string; // para el link del PDF en el WhatsApp
}

export interface PedidoConItems extends Pedido {
  items: ItemPedido[];
}

export interface ResultadoPedido {
  ok: boolean;
  error?: string; // mensaje listo para mostrar (es-AR)
  pedido?: Pedido;
  items?: ItemPedido[];
  waUrl?: string;
  tokenSeguimiento?: string;
}

export interface NexoraDB {
  // --- Tienda ---
  getTiendaPorSlug(slug: string): Promise<Comercio | null>;
  getTiendaPorId(id: string): Promise<Comercio | null>;
  updateComercio(id: string, patch: Partial<Comercio>): Promise<void>;
  registrarVisita(slug: string): Promise<void>;

  // --- Catálogo ---
  getCategorias(comercioId: string): Promise<Categoria[]>;
  crearCategoria(comercioId: string, nombre: string): Promise<Categoria>;
  getProductos(comercioId: string): Promise<Producto[]>;
  crearProducto(
    data: Pick<Producto, "comercioId" | "nombre" | "precio" | "emoji" | "categoriaId" | "stockNumerico" | "fotos">,
  ): Promise<{ ok: boolean; error?: string; producto?: Producto }>;
  setDisponible(productoId: string, v: boolean): Promise<void>;

  // --- Pedidos (reglas N3-N6, N12 viven ACÁ) ---
  crearPedido(input: CrearPedidoInput): Promise<ResultadoPedido>;
  getPedidos(comercioId: string): Promise<PedidoConItems[]>;
  getPedidoPorToken(token: string): Promise<{ pedido: Pedido; items: ItemPedido[]; tienda: Comercio } | null>;
  cambiarEstado(pedidoId: string, nuevo: EstadoPedido, reintegrarStock: boolean): Promise<{ ok: boolean; error?: string }>;
  marcarPagado(pedidoId: string, v: boolean): Promise<void>;

  // --- Clientes ---
  getClientes(comercioId: string): Promise<ClienteFrecuente[]>;
  setFrecuente(id: string, esFrecuente: boolean, descuento: number): Promise<void>;

  // --- Finanzas ---
  getCaja(comercioId: string): Promise<ResumenCaja>;
}
