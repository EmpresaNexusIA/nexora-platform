import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, uuid, varchar, text } from "drizzle-orm/pg-core";
import { comercios } from "./comercios.js";
import { categorias } from "./categorias.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

export const productos = pgTable("productos", {
  ...primaryKeyUuidV7,
  comercioId: uuid("comercio_id")
    .references(() => comercios.id, { onDelete: "cascade" })
    .notNull(),
  categoriaId: uuid("categoria_id")
    .references(() => categorias.id, { onDelete: "set null" }),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  precio: numeric("precio", { precision: 10, scale: 2 }).notNull(),
  fotos: jsonb("fotos").notNull().default([]),   // string[] ≤ 3 — URLs del bucket MinIO
  emoji: varchar("emoji", { length: 8 }).notNull().default("🛍️"),
  disponible: boolean("disponible").notNull().default(true),
  stockNumerico: integer("stock_numerico"),      // null = sin control
  descripcion: text("descripcion").notNull().default(""),
  orden: integer("orden").notNull().default(0),
  ...auditFields,
}, (t) => [
  index("idx_productos_comercio_activos")
    .on(t.comercioId)
    .where(sql`${t.deletedAt} IS NULL`),
  check("productos_precio_no_negativo", sql`${t.precio} >= 0`),
  check("productos_stock_no_negativo", sql`${t.stockNumerico} IS NULL OR ${t.stockNumerico} >= 0`),
  check("productos_max_3_fotos", sql`jsonb_array_length(${t.fotos}) <= 3`),
]);
