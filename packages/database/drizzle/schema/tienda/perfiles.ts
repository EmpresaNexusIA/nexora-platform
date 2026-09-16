import { sql } from "drizzle-orm";
import { boolean, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { primaryKeyUuidV7, auditFields } from "../core/helpers.js";

// Clientes FINALES (compran sin login — compra discreta, regla N2).
// NO son usuarios de la plataforma: jamás tocar public.users acá.
export const perfiles = pgTable("perfiles", {
  ...primaryKeyUuidV7,
  email: varchar("email", { length: 255 }).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull().default(""),
  telefono: varchar("telefono", { length: 32 }).notNull().default(""),
  esInvitado: boolean("es_invitado").notNull().default(true),
  ...auditFields,
}, (t) => [
  uniqueIndex("perfiles_email_unique_activos")
    .on(sql`lower(${t.email})`)
    .where(sql`${t.deletedAt} IS NULL`),
]);
