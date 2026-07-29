// Ejecutor oficial de migraciones @nexora/database
// Usa drizzle-orm/migrator (runtime) en lugar del CLI drizzle-kit migrate,
// que en este entorno finalizaba con exit 0 sin aplicar nada y sin mensaje
// (silent failure sobre bases vacías — incidente 2026-07-28).
// Formato idéntico (migrations/*.sql + meta/_journal.json + breakpoints).
// Uso:  DATABASE_URL=postgresql://... node migrate.mjs

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] ERROR: falta DATABASE_URL.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('[migrate] OK — migraciones aplicadas correctamente.');
} catch (err) {
  console.error('[migrate] ERROR aplicando migraciones:');
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
