import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { comercios } from "./comercios.js";
import { perfiles } from "./perfiles.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

// Pedidos: los montos que guarda la DB son la ÚNICA verdad (regla N3).
// dto_regla registra CÓMO se calculó el descuento (auditoría del motor).
export const pedidos = pgTable("pedidos", {
  ...primaryKeyUuidV7,
  token: varchar("token", { length: 32 }).notNull().unique(), // link no adivinable (lo genera la app)
  comercioId: uuid("comercio_id")
    .references(() => comercios.id, { onDelete: "cascade" })
    .notNull(),
  clienteId: uuid("cliente_id")
    .references(() => perfiles.id, { onDelete: "set null" }),
  numeroOrden: varchar("numero_orden", { length: 12 }).notNull(),
  estado: varchar("estado", { length: 24 }).notNull().default("pendiente"),
  pagado: boolean("pagado").notNull().default(false),
  metodoPago: varchar("metodo_pago", { length: 24 }).notNull(),
  modoEntrega: varchar("modo_entrega", { length: 12 }).notNull(),
  direccionEntrega: text("direccion_entrega").notNull().default(""),
  clienteNombre: varchar("cliente_nombre", { length: 255 }).notNull(),
  clienteEmail: varchar("cliente_email", { length: 255 }).notNull(),
  clienteTelefono: varchar("cliente_telefono", { length: 32 }).notNull(),
  notasCliente: text("notas_cliente").notNull().default(""),
  costoEnvio: numeric("costo_envio", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  descuentoAplicado: numeric("descuento_aplicado", { precision: 10, scale: 2 }).notNull().default("0"),
  totalFinal: numeric("total_final", { precision: 10, scale: 2 }).notNull(),
  dtoRegla: varchar("dto_regla", { length: 24 }).notNull().default("ninguna"),
  urlPdf: text("url_pdf").notNull().default(""),
  pagadoMarcadoEn: timestamp("pagado_marcado_en", { withTimezone: true }),
  pagadoMarcadoPor: uuid("pagado_marcado_por"),  // user del panel que lo marcó (N15)
  ultimoCambioEstado: timestamp("ultimo_cambio_estado", { withTimezone: true })
    .defaultNow().notNull(),
  ...auditFields,
}, (t) => [
  index("idx_pedidos_comercio_fecha")
    .on(t.comercioId, t.createdAt)
    .where(sql`${t.deletedAt} IS NULL`),
  index("idx_pedidos_telefono").on(t.clienteTelefono),
  check("pedidos_estado_check",
    sql`${t.estado} IN ('pendiente','confirmado','en_preparacion','finalizado','cancelado')`),
  check("pedidos_pago_check", sql`${t.metodoPago} IN ('efectivo','transferencia','qr','otro')`),
  check("pedidos_entrega_check", sql`${t.modoEntrega} IN ('retiro','envio')`),
  check("pedidos_dto_regla_check",
    sql`${t.dtoRegla} IN ('vip','pago','acumulado','acumulado_tope','ninguna')`),
]);
