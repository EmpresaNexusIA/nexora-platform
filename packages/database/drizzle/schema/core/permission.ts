import { pgTable, varchar } from "drizzle-orm/pg-core";
import { primaryKeyUuidV7, auditFields } from "./helpers.js";

export const permissions = pgTable("permissions", {
  ...primaryKeyUuidV7,
  name: varchar("name", { length: 255 }).notNull().unique(), // Ej: "users:write", "settings:read"
  description: varchar("description", { length: 500 }),
  ...auditFields,
});
