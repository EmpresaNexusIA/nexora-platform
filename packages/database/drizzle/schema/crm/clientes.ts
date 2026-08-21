import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "../core/tenant.js";

export const clientes = pgTable("clientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  rubro: text("rubro"),
  direccion: text("direccion"),
  telefono: text("telefono"),
  tieneWeb: boolean("tiene_web").default(false).notNull(),
  servicioVendido: text("servicio_vendido").default("ninguno"),
  estado: text("estado").default("nuevo").notNull(),
  notas: text("notas"),
  provisionedTenantId: uuid("provisioned_tenant_id").references(() => tenants.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check(
    "clientes_servicio_vendido_check",
    sql`${t.servicioVendido} IN ('ninguno', 'web', 'bot', 'combo')`,
  ),
  check(
    "clientes_estado_check",
    sql`${t.estado} IN ('nuevo', 'contactado', 'presupuestando', 'vendido', 'onboarding', 'activo')`,
  ),
  index("idx_clientes_estado").on(t.estado),
  index("idx_clientes_nombre").on(t.nombre),
  index("idx_clientes_provisioned_tenant_id").on(t.provisionedTenantId),
]);
