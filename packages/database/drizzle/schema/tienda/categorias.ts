import { sql } from "drizzle-orm";
import { integer, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { comercios } from "./comercios.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

export const categorias = pgTable("categorias", {
  ...primaryKeyUuidV7,
  comercioId: uuid("comercio_id")
    .references(() => comercios.id, { onDelete: "cascade" })
    .notNull(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  orden: integer("orden").notNull().default(0),
  ...auditFields,
}, (t) => [
  uniqueIndex("categorias_nombre_unique_activas")
    .on(t.comercioId, sql`lower(${t.nombre})`)
    .where(sql`${t.deletedAt} IS NULL`),
]);
