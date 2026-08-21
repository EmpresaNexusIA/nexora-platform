import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { randomUUID } from "crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";

if (process.env.ALLOW_DEV_SEED !== "true") {
  throw new Error("Seed bloqueado: definir ALLOW_DEV_SEED=true de forma explicita");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL para ejecutar el seed");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const db = drizzle(pool, { schema });

async function main() {
  console.log("🌱 Iniciando la siembra de base de datos (Seeding)...");

  const identity = await pool.query<{ current_user: string }>("SELECT current_user");
  if (identity.rows[0]?.current_user !== "nexora_admin") {
    throw new Error("El seed debe ejecutarse como nexora_admin");
  }

  // 1. Buscar si ya existe el Tenant 'acme-corp'
  let tenantId: string;
  const existingTenants = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, "acme-corp"))
    .limit(1);

  if (existingTenants.length > 0) {
    tenantId = existingTenants[0].id;
    console.log(`🏢 Tenant 'Acme Corp' ya existía en la DB. Usando ID existente: ${tenantId}`);
  } else {
    tenantId = randomUUID();
    await db.insert(schema.tenants).values({
      id: tenantId,
      name: "Acme Corp SaaS",
      slug: "acme-corp",
    });
    console.log(`🏢 Tenant 'Acme Corp' creado con éxito con ID: ${tenantId}`);
  }

  // 2. Crear Permisos del sistema
  const permissionsToCreate = [
    { id: randomUUID(), name: "users:read", description: "Ver lista de usuarios" },
    { id: randomUUID(), name: "users:write", description: "Crear, editar y eliminar usuarios" },
    { id: randomUUID(), name: "tenant:settings", description: "Configurar opciones de la empresa y facturación" },
  ];

  for (const perm of permissionsToCreate) {
    await db.insert(schema.permissions).values(perm).onConflictDoNothing();
  }
  console.log("🔑 Permisos base creados o verificados.");

  // Recuperamos los permisos reales de la base de datos para mapear sus IDs reales
  const dbPermissions = await db
    .select()
    .from(schema.permissions)
    .where(
      and(
        inArray(schema.permissions.name, ["users:read", "users:write", "tenant:settings"]),
        isNull(schema.permissions.deletedAt),
      ),
    );
  const permMap = Object.fromEntries(dbPermissions.map(p => [p.name, p.id]));

  // 3. Crear Roles Globales (tenant_id en null)
  const adminRoleId = randomUUID();
  const memberRoleId = randomUUID();

  await db.insert(schema.roles).values([
    {
      id: adminRoleId,
      tenantId: null,
      name: "Administrador",
      description: "Acceso total a todos los recursos del tenant",
    },
    {
      id: memberRoleId,
      tenantId: null,
      name: "Miembro",
      description: "Acceso de lectura. No puede modificar configuraciones críticas",
    }
  ]).onConflictDoNothing();
  console.log("👑 Roles globales 'Administrador' y 'Miembro' listos/verificados.");

  // Recuperamos los roles de la base de datos
  const dbRoles = await db
    .select()
    .from(schema.roles)
    .where(
      and(
        isNull(schema.roles.tenantId),
        isNull(schema.roles.deletedAt),
        inArray(schema.roles.name, ["Administrador", "Miembro"]),
      ),
    );
  const adminRole = dbRoles.find(r => r.name === "Administrador");
  const memberRole = dbRoles.find(r => r.name === "Miembro");

  if (adminRole && memberRole) {
    // 4. Relacionar Roles con Permisos
    const rolePermissions = [
      { roleId: adminRole.id, permissionId: permMap["users:read"] },
      { roleId: adminRole.id, permissionId: permMap["users:write"] },
      { roleId: adminRole.id, permissionId: permMap["tenant:settings"] },
      { roleId: memberRole.id, permissionId: permMap["users:read"] },
    ].filter(rp => rp.permissionId !== undefined);

    for (const rp of rolePermissions) {
      await db.insert(schema.rolesToPermissions).values(rp).onConflictDoNothing();
    }
    console.log("🔗 Relaciones entre Roles y Permisos configuradas.");

    // 5. Crear Usuarios de prueba asignándoles sus respectivos roles reales
    await db.insert(schema.users).values([
      {
        id: randomUUID(),
        tenantId: tenantId,
        roleId: adminRole.id,
        email: "admin@acme.com",
        name: "Clara Admin",
        status: "active",
      },
      {
        id: randomUUID(),
        tenantId: tenantId,
        roleId: memberRole.id,
        email: "juan@acme.com",
        name: "Juan Miembro",
        status: "active",
      }
    ]).onConflictDoNothing();
    console.log("👥 Usuarios de prueba creados y enlazados a sus roles.");
  }

  console.log("✅ ¡Base de datos sembrada con éxito!");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seeding:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
