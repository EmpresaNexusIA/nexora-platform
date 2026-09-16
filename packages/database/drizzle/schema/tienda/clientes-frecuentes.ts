import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { comercios } from "./comercios.js";
import { perfiles } from "./perfiles.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

// Puente comercio ↔ cliente final: VIPS con % propio (nunca visible al cliente).
export const clientesFrecuentes = pgTable("clientes_frecuentes", {
  ...primaryKeyUuidV7,
  comercioId: uuid("comercio_id")
    .references(() => comercios.id, { onDelete: "cascade" })
    .notNull(),
  perfilId: uuid("perfil_id")
    .references(() => perfiles.id, { onDelete: "set null" }),
  nombreCliente: varchar("nombre_cliente", { length: 255 }).notNull().default(""),
  telefonoCliente: varchar("telefono_cliente", { length: 32 }).notNull().default(""),
  esFrecuente: boolean("es_frecuente").notNull().default(false),
  descuentoEspecial: numeric("descuento_especial", { precision: 5, scale: 2 }).notNull().default("0"),
  origen: varchar("origen", { length: 12 }).notNull().default("manual"),
  pedidosFinalizados: integer("pedidos_finalizados").notNull().default(0),
  ...auditFields,
}, (t) => [
  unique("frecuentes_comercio_tel_unique").on(t.comercioId, t.telefonoCliente),
  index("idx_frecuentes_comercio_activos")
    .on(t.comercioId)
    .where(sql`${t.deletedAt} IS NULL`),
  check("frecuentes_dto_rango", sql`${t.descuentoEspecial} BETWEEN 0 AND 90`),
  check("frecuentes_origen_check", sql`${t.origen} IN ('manual','auto')`),
]);
