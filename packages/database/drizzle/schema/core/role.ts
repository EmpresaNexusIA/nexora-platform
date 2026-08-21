import { sql } from "drizzle-orm";
import { pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenant.js";
import { primaryKeyUuidV7, auditFields } from "./helpers.js";

export const roles = pgTable("roles", {
  ...primaryKeyUuidV7,
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Null para roles globales del sistema
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  ...auditFields,
}, (t) => [
  uniqueIndex("roles_global_name_active_unique")
    .on(sql`lower(${t.name})`)
    .where(sql`${t.tenantId} IS NULL AND ${t.deletedAt} IS NULL`),
  uniqueIndex("roles_tenant_name_active_unique")
    .on(t.tenantId, sql`lower(${t.name})`)
    .where(sql`${t.tenantId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
]);
