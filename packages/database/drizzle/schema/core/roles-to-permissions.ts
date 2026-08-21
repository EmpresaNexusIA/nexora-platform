import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { roles } from "./role.js";
import { permissions } from "./permission.js";

export const rolesToPermissions = pgTable(
  "roles_to_permissions",
  {
    roleId: uuid("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: uuid("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    primaryKey({
      name: "roles_to_permissions_pkey",
      columns: [t.roleId, t.permissionId],
    }),
  ]
);
