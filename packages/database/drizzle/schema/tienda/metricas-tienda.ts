import { sql } from "drizzle-orm";
import { date, index, integer, numeric, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { comercios } from "./comercios.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

export const metricasTienda = pgTable("metricas_tienda", {
  ...primaryKeyUuidV7,
  comercioId: uuid("comercio_id")
    .references(() => comercios.id, { onDelete: "cascade" })
    .notNull(),
  fecha: date("fecha", { mode: "string" }).notNull(),
  visitas: integer("visitas").notNull().default(0),
  pedidos: integer("pedidos").notNull().default(0),
  totalVendido: numeric("total_vendido", { precision: 12, scale: 2 }).notNull().default("0"),
  ...auditFields,
}, (t) => [
  unique("metricas_comercio_fecha_unique").on(t.comercioId, t.fecha),
  index("idx_metricas_comercio_activas")
    .on(t.comercioId)
    .where(sql`${t.deletedAt} IS NULL`),
]);
