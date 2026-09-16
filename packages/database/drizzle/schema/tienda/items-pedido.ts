import { sql } from "drizzle-orm";
import { check, index, integer, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { pedidos } from "./pedidos.js";
import { productos } from "./productos.js";
import { primaryKeyUuidV7 } from "../core/helpers.js";

// Ítems CONGELADOS (regla N4): nombre y precio viajan acá;
// editar el producto jamás reescribe un pedido viejo.
export const itemsPedido = pgTable("items_pedido", {
  ...primaryKeyUuidV7,
  pedidoId: uuid("pedido_id")
    .references(() => pedidos.id, { onDelete: "cascade" })
    .notNull(),
  productoId: uuid("producto_id")
    .references(() => productos.id, { onDelete: "set null" }),
  nombreCongelado: varchar("nombre_congelado", { length: 255 }).notNull(),
  precioCongelado: numeric("precio_congelado", { precision: 10, scale: 2 }).notNull(),
  cantidad: integer("cantidad").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
}, (t) => [
  index("idx_items_pedido").on(t.pedidoId),
  check("items_cantidad_valida", sql`${t.cantidad} > 0 AND ${t.cantidad} <= 99`),
]);
