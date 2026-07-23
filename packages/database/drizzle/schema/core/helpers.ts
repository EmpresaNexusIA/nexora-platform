import { timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// Helper para ID Primario usando UUID v7 generado en la app
export const primaryKeyUuidV7 = {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
};

// Helper para campos de auditoría con actualización automática en updatedAt
export const auditFields = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),

  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  deletedBy: uuid("deleted_by"),
};
