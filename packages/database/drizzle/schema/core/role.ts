import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenant";
import { primaryKeyUuidV7, auditFields } from "./helpers";

export const roles = pgTable("roles", {
  ...primaryKeyUuidV7,
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // Null para roles globales del sistema
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  ...auditFields,
});
