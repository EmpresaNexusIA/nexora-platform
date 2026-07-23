import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenant";
import { roles } from "./role";
import { primaryKeyUuidV7, auditFields } from "./helpers";

export const users = pgTable("users", {
  ...primaryKeyUuidV7,
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  roleId: uuid("role_id")
    .references(() => roles.id), // Rol asignado al usuario
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  ...auditFields,
});
