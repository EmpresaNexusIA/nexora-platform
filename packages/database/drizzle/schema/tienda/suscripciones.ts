import { sql } from "drizzle-orm";
import { check, date, index, numeric, pgTable, uuid, varchar, text } from "drizzle-orm/pg-core";
import { comercios } from "./comercios.js";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

// Cobro a comercios (tarjeta del modelo F1). Fase 2: webhook Mercado Pago
// actualiza estado; tenants.status refleja mora (suspended).
export const suscripciones = pgTable("suscripciones", {
  ...primaryKeyUuidV7,
  comercioId: uuid("comercio_id")
    .references(() => comercios.id, { onDelete: "cascade" })
    .notNull(),
  plan: varchar("plan", { length: 16 }).notNull(),
  precio: numeric("precio", { precision: 10, scale: 2 }).notNull().default("0"),
  estado: varchar("estado", { length: 16 }).notNull().default("activa"),
  desde: date("desde", { mode: "string" }).notNull(),
  hasta: date("hasta", { mode: "string" }).notNull(),
  idExternoMp: text("id_externo_mp"),
  ...auditFields,
}, (t) => [
  index("idx_suscripciones_comercio_activas")
    .on(t.comercioId)
    .where(sql`${t.deletedAt} IS NULL`),
  check("suscripciones_plan_check", sql`${t.plan} IN ('gratis','emprendedor','pro')`),
  check("suscripciones_estado_check", sql`${t.estado} IN ('activa','vencida','cancelada')`),
]);
