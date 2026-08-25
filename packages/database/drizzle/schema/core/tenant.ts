import { sql } from "drizzle-orm";
import { check, pgTable, varchar } from "drizzle-orm/pg-core";
import { primaryKeyUuidV7, auditFields } from "./helpers.js";

export const tenants = pgTable("tenants", {
  ...primaryKeyUuidV7,
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  ...auditFields,
}, (t) => [
  check(
    "tenants_status_check",
    sql`${t.status} IN ('pending_activation', 'active', 'suspended', 'cancelled', 'maintenance')`,
  ),
]);
