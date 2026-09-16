// NEXORA · DataAdapter PLATFORM (Postgres self-hosted del monorepo).
// Reemplaza a supabase.ts. Mismo contrato, cero cambios en UI/actions.
// PRECONDICIÓN: npm i pg (o pnpm add pg) + correr packages/database/sql/0010_tienda_domain.sql
// + migraciones drizzle del schema tienda (pnpm db:generate && pnpm db:migrate).

import { Pool } from "pg";
import type { NexoraDB, CrearPedidoInput, ResultadoPedido, PedidoConItems } from "./adapter";
import type { Comercio, EstadoPedido } from "../types";

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 6,
    });
  }
  return _pool;
}

// snake_case (DB self-hosted) → camelCase (tipos de la app)
function aComercio(r: Record<string, unknown>): Comercio {
  return {
    id: r.id as string, slug: r.slug as string, nombre: r.nombre as string,
    // Campos que en la plataforma no viven en comercios (auth = users de platform):
    duenoId: "", emailDueno: "", emailVerificado: true, fechaFinTrial: null,
    contadorPedidos: Number(r.contador_pedidos ?? 0), eliminado: Boolean(r.deleted_at),
    whatsapp: (r.whatsapp as string) ?? "", rubro: (r.rubro as string) ?? "",
    moneda: (r.moneda as string) ?? "ARS", zonaHoraria: (r.zona_horaria as string) ?? "America/Cordoba",
    publicada: Boolean(r.publicada),
    diseno: r.diseno as Comercio["diseno"], tema: r.tema as Comercio["tema"],
    colorPrincipal: (r.color_principal as string) ?? "#f59e0b",
    logoEmoji: (r.logo_emoji as string) ?? "🛍️",
    portadaUrl: (r.portada_url as string) ?? "", descripcion: (r.descripcion as string) ?? "",
    dirRetiro: (r.dir_retiro as string) ?? "",
    modoEntrega: r.modo_entrega as Comercio["modoEntrega"],
    costoEnvio: Number(r.costo_envio ?? 0), horarios: (r.horarios as string) ?? "",
    instagram: (r.instagram as string) ?? "",
    plan: (r.plan as string) as Comercio["plan"], estadoSuscripcion: "activa",
    linkPago: (r.link_pago as string) ?? "", qrUrl: (r.qr_url as string) ?? "",
    metodoDescuento: r.metodo_descuento as Comercio["metodoDescuento"],
    porcentajeDescuento: Number(r.porcentaje_descuento ?? 0),
    dtoDesde: (r.dto_desde as string) ?? null, dtoHasta: (r.dto_hasta as string) ?? null,
    acumularDescuentos: Boolean(r.acumular_descuentos),
    topeDescuento: Number(r.tope_descuento ?? 100),
    umbralFrecuente: Number(r.umbral_frecuente ?? 0),
    telegramChatId: (r.telegram_chat_id as string) ?? null,
    ntfyTopic: (r.ntfy_topic as string) ?? null,
  };
}

function aProducto(r: Record<string, unknown>) {
  return {
    id: r.id as string, comercioId: r.comercio_id as string,
    categoriaId: (r.categoria_id as string) ?? null,
    nombre: r.nombre as string, precio: Number(r.precio),
    fotos: Array.isArray(r.fotos) ? (r.fotos as string[]) : [],
    emoji: (r.emoji as string) ?? "🛍️",
    disponible: Boolean(r.disponible),
    stockNumerico: r.stock_numerico === null ? null : Number(r.stock_numerico),
    descripcion: (r.descripcion as string) ?? "", orden: Number(r.orden ?? 0),
    eliminado: Boolean(r.deleted_at),
  };
}

function aPedido(r: Record<string, unknown>) {
  return {
    id: r.id as string, token: r.token as string, comercioId: r.comercio_id as string,
    clienteId: (r.cliente_id as string) ?? "",
    numeroOrden: r.numero_orden as string,
    estado: r.estado as EstadoPedido, pagado: Boolean(r.pagado),
    eliminado: Boolean(r.deleted_at),
    metodoPago: r.metodo_pago as never, modoEntrega: r.modo_entrega as never,
    direccionEntrega: (r.direccion_entrega as string) ?? "",
    clienteNombre: r.cliente_nombre as string, clienteEmail: r.cliente_email as string,
    clienteTelefono: r.cliente_telefono as string,
    notasCliente: (r.notas_cliente as string) ?? "",
    costoEnvio: Number(r.costo_envio), subtotal: Number(r.subtotal),
    descuentoAplicado: Number(r.descuento_aplicado), totalFinal: Number(r.total_final),
    dtoRegla: (r.dto_regla as string) ?? "ninguna",
    urlPdf: (r.url_pdf as string) ?? "",
    creadoEn: new Date(r.created_at as string).toISOString(),
    ultimoCambioEstado: new Date(r.ultimo_cambio_estado as string).toISOString(),
  };
}

function aItem(r: Record<string, unknown>) {
  return {
    id: r.id as string, pedidoId: r.pedido_id as string,
    productoId: (r.producto_id as string) ?? null,
    nombreCongelado: r.nombre_congelado as string, precioCongelado: Number(r.precio_congelado),
    cantidad: Number(r.cantidad), subtotal: Number(r.subtotal),
  };
}

export const platformDB: NexoraDB = {
  async getTiendaPorSlug(slug) {
    const { rows } = await pool().query(
      `select c.*, t.slug from comercios c join tenants t on t.id = c.tenant_id
       where t.slug = $1 and c.deleted_at is null and t.deleted_at is null limit 1`, [slug]);
    return rows[0] ? aComercio(rows[0]) : null;
  },

  async getTiendaPorId(id) {
    const { rows } = await pool().query(
      `select c.*, t.slug from comercios c join tenants t on t.id = c.tenant_id
       where c.id = $1 and c.deleted_at is null limit 1`, [id]);
    return rows[0] ? aComercio(rows[0]) : null;
  },

  async getTiendaPorTenantId(tenantId) {
    const { rows } = await pool().query(
      `select c.*, t.slug from comercios c join tenants t on t.id = c.tenant_id
       where c.tenant_id = $1 and c.deleted_at is null limit 1`, [tenantId]);
    return rows[0] ? aComercio(rows[0]) : null;
  },

  async updateComercio(id, patch) {
    // Patch ya viene SANITIZADO desde guardarConfigAction (whitelist server-side)
    const mapa: Record<string, string> = {
      diseno: "diseno", tema: "tema", metodoDescuento: "metodo_descuento",
      porcentajeDescuento: "porcentaje_descuento", dtoDesde: "dto_desde", dtoHasta: "dto_hasta",
      acumularDescuentos: "acumular_descuentos", topeDescuento: "tope_descuento",
      umbralFrecuente: "umbral_frecuente", modoEntrega: "modo_entrega", costoEnvio: "costo_envio",
      dirRetiro: "dir_retiro", horarios: "horarios", linkPago: "link_pago",
      descripcion: "descripcion", whatsapp: "whatsapp",
    };
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const [k, columna] of Object.entries(mapa)) {
      const v = (patch as Record<string, unknown>)[k];
      if (v !== undefined) { sets.push(`${columna} = $${i++}`); vals.push(v); }
    }
    if (!sets.length) return;
    vals.push(id);
    await pool().query(`update comercios set ${sets.join(", ")}, updated_at = now() where id = $${i}`, vals);
  },

  async registrarVisita(slug) {
    await pool().query(`select public.registrar_visita($1)`, [slug]);
  },

  async getCategorias(comercioId) {
    const { rows } = await pool().query(
      `select * from categorias where comercio_id = $1 and deleted_at is null
       order by orden, nombre`, [comercioId]);
    return rows.map((r) => ({
      id: r.id, comercioId: r.comercio_id, nombre: r.nombre,
      orden: Number(r.orden), eliminado: Boolean(r.deleted_at),
    }));
  },

  async crearCategoria(comercioId, nombre) {
    const { rows } = await pool().query(
      `insert into categorias (comercio_id, nombre) values ($1, $2) returning *`,
      [comercioId, nombre]);
    const r = rows[0];
    return { id: r.id, comercioId: r.comercio_id, nombre: r.nombre, orden: Number(r.orden), eliminado: false };
  },

  async getProductos(comercioId) {
    const { rows } = await pool().query(
      `select * from productos where comercio_id = $1 and deleted_at is null order by orden`, [comercioId]);
    return rows.map(aProducto);
  },

  async crearProducto(data) {
    try {
      const { rows: altos } = await pool().query(
        `select count(*)::int as n from productos where comercio_id = $1 and deleted_at is null`,
        [data.comercioId]);
      const { rows } = await pool().query(
        `insert into productos
         (comercio_id, categoria_id, nombre, precio, fotos, emoji, stock_numerico, orden)
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) returning *`,
        [data.comercioId, data.categoriaId, data.nombre, data.precio,
         JSON.stringify(data.fotos ?? []), data.emoji, data.stockNumerico, altos[0].n + 1]);
      return { ok: true, producto: aProducto(rows[0]) };
    } catch (e) {
      // El trigger trg_limite_productos (N13) tira acá con mensaje listo (es-AR)
      return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear." };
    }
  },

  async setDisponible(comercioId, productoId, v) {
    // Fase 1.6 · P1: scoping por comercio de la sesión.
    await pool().query(
      `update productos set disponible = $3, updated_at = now()
       where id = $2 and comercio_id = $1`, [comercioId, productoId, v]);
  },

  async crearPedido(input: CrearPedidoInput): Promise<ResultadoPedido> {
    // TODA la lógica vive en la función SQL (N3: el server es la única verdad)
    const { rows } = await pool().query(
      `select public.crear_pedido($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8) as res`,
      [input.slug, JSON.stringify(input.cliente), JSON.stringify(input.lineas),
       input.modoEntrega, input.direccionEntrega, input.notasCliente,
       input.metodoPago, input.baseUrl]);
    const res = rows[0].res;
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      pedido: aPedido(res.pedido) as never,
      waUrl: res.waUrl, tokenSeguimiento: res.tokenSeguimiento,
    };
  },

  async getPedidos(comercioId) {
    const { rows } = await pool().query(
      `select * from pedidos where comercio_id = $1 and deleted_at is null
       order by created_at desc limit 200`, [comercioId]);
    const out: PedidoConItems[] = [];
    for (const r of rows) {
      const items = await pool().query(
        `select * from items_pedido where pedido_id = $1 order by id`, [r.id]);
      out.push({ ...aPedido(r), items: items.rows.map(aItem) } as PedidoConItems);
    }
    return out;
  },

  async getPedidoPorToken(token) {
    const { rows } = await pool().query(`select * from pedidos where token = $1 limit 1`, [token]);
    if (!rows[0]) return null;
    const items = await pool().query(`select * from items_pedido where pedido_id = $1`, [rows[0].id]);
    const tienda = await this.getTiendaPorId(rows[0].comercio_id);
    if (!tienda) return null;
    return { pedido: aPedido(rows[0]) as never, items: items.rows.map(aItem) as never, tienda };
  },

  async cambiarEstado(comercioId, pedidoId, nuevo, reintegrarStock) {
    // Fase 1.6 · P1: la función SQL es SECURITY DEFINER y recibe solo el id
    // del pedido, así que validamos la pertenencia ANTES. comercio_id es
    // inmutable (se fija en el insert), así que no hay TOCTOU entre el
    // chequeo y la llamada.
    const { rows: dueno } = await pool().query(
      `select comercio_id from pedidos where id = $1 and deleted_at is null`, [pedidoId]);
    if (!dueno[0] || (dueno[0].comercio_id as string) !== comercioId) {
      return { ok: false, error: "Pedido no encontrado." };
    }
    const { rows } = await pool().query(
      `select public.cambiar_estado_pedido($1, $2, $3) as res`, [pedidoId, nuevo, reintegrarStock]);
    return rows[0].res;
  },

  async marcarPagado(comercioId, pedidoId, v) {
    // Fase 1.6 · P1: scoping por comercio de la sesión.
    await pool().query(
      `update pedidos set pagado = $3, pagado_marcado_en = case when $3 then now() else null end,
       updated_at = now() where id = $2 and comercio_id = $1`, [comercioId, pedidoId, v]);
  },

  async getClientes(comercioId) {
    const { rows } = await pool().query(
      `select * from clientes_frecuentes where comercio_id = $1 and deleted_at is null
       order by pedidos_finalizados desc`, [comercioId]);
    return rows.map((r) => ({
      id: r.id, comercioId: r.comercio_id, usuarioId: (r.perfil_id as string) ?? "",
      nombreCliente: r.nombre_cliente, telefonoCliente: r.telefono_cliente,
      esFrecuente: Boolean(r.es_frecuente), descuentoEspecial: Number(r.descuento_especial),
      origen: r.origen, pedidosFinalizados: Number(r.pedidos_finalizados),
    }));
  },

  async setFrecuente(comercioId, id, esFrecuente, descuento) {
    // Fase 1.6 · P1: scoping por comercio de la sesión.
    await pool().query(
      `update clientes_frecuentes set es_frecuente = $2, descuento_especial = $3,
       origen = 'manual', updated_at = now() where id = $4 and comercio_id = $1`,
      [comercioId, esFrecuente, Math.max(0, Math.min(90, descuento)), id]);
  },

  async getCaja(comercioId) {
    const { rows } = await pool().query(`select public.resumen_caja($1) as res`, [comercioId]);
    return rows[0].res;
  },
};
