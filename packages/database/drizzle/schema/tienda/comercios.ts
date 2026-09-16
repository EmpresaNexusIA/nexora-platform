import { sql } from "drizzle-orm";
import { boolean, check, date, integer, numeric, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "../core/tenant.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

// Dominio TIENDA · Comercio: extiende al tenant con todo lo vendible.
// El slug NO se repite acá: vive en tenants (JOIN para leerlo).
export const comercios = pgTable("comercios", {
  ...primaryKeyUuidV7,
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull()
    .unique(),                                    // 1 tenant = 1 comercio (multi-tienda: sacar unique)
  nombre: varchar("nombre", { length: 255 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().default(""),
  rubro: varchar("rubro", { length: 120 }).notNull().default(""),
  moneda: varchar("moneda", { length: 3 }).notNull().default("ARS"),
  zonaHoraria: varchar("zona_horaria", { length: 48 }).notNull().default("America/Cordoba"),
  publicada: boolean("publicada").notNull().default(false),

  // Presentación (3 diseños fijos + 3 temas marca — directiva fundador #1)
  diseno: varchar("diseno", { length: 24 }).notNull().default("cuadricula"),
  tema: varchar("tema", { length: 24 }).notNull().default("ambar"),
  colorPrincipal: varchar("color_principal", { length: 7 }).notNull().default("#f59e0b"),
  logoEmoji: varchar("logo_emoji", { length: 8 }).notNull().default("🛍️"),
  portadaUrl: text("portada_url").notNull().default(""),
  descripcion: text("descripcion").notNull().default(""),

  // Entrega
  dirRetiro: text("dir_retiro").notNull().default(""),
  modoEntrega: varchar("modo_entrega", { length: 12 }).notNull().default("ambos"),
  costoEnvio: numeric("costo_envio", { precision: 10, scale: 2 }).notNull().default("0"),
  horarios: text("horarios").notNull().default(""),
  instagram: varchar("instagram", { length: 120 }).notNull().default(""),

  // Cobro y descuentos (números: SIEMPRE validados acá Y en crear_pedido())
  plan: varchar("plan", { length: 16 }).notNull().default("gratis"),
  linkPago: text("link_pago").notNull().default(""),
  qrUrl: text("qr_url").notNull().default(""),
  metodoDescuento: varchar("metodo_descuento", { length: 24 }).notNull().default("ninguno"),
  porcentajeDescuento: numeric("porcentaje_descuento", { precision: 5, scale: 2 }).notNull().default("0"),
  dtoDesde: date("dto_desde", { mode: "string" }),
  dtoHasta: date("dto_hasta", { mode: "string" }),
  acumularDescuentos: boolean("acumular_descuentos").notNull().default(false),
  topeDescuento: numeric("tope_descuento", { precision: 5, scale: 2 }).notNull().default("100"),
  umbralFrecuente: integer("umbral_frecuente").notNull().default(0),
  contadorPedidos: integer("contador_pedidos").notNull().default(0),

  // Push al vendedor (orchestrator lo consume; null = sin aviso)
  telegramChatId: varchar("telegram_chat_id", { length: 64 }),
  ntfyTopic: varchar("ntfy_topic", { length: 96 }),

  // Legal (contratos de adhesión)
  tycAceptadosEn: text("tyc_aceptados_en"),
  tycVersion: varchar("tyc_version", { length: 16 }),

  ...auditFields,
}, (t) => [
  check("comercios_diseno_check", sql`${t.diseno} IN ('lista','cuadricula','banners')`),
  check("comercios_tema_check", sql`${t.tema} IN ('ambar','esmeralda','azul')`),
  check("comercios_modo_entrega_check", sql`${t.modoEntrega} IN ('retiro','envio','ambos')`),
  check("comercios_plan_check", sql`${t.plan} IN ('gratis','emprendedor','pro')`),
  check("comercios_metodo_dto_check", sql`${t.metodoDescuento} IN ('efectivo','transferencia','qr','ninguno')`),
  check("comercios_pct_dto_rango", sql`${t.porcentajeDescuento} BETWEEN 0 AND 90`),
  check("comercios_tope_dto_rango", sql`${t.topeDescuento} BETWEEN 0 AND 100`),
  check("comercios_envio_no_negativo", sql`${t.costoEnvio} >= 0`),
  check("comercios_umbral_no_negativo", sql`${t.umbralFrecuente} >= 0`),
]);
