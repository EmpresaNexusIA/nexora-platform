// NEXORA · Selector de capa de datos.
// DEMO_MODE=true        → demoDB (en memoria, para preview sin backend)
// DEMO_MODE distinto    → platformDB (Postgres del monorepo + funciones 0010)
// Fail-closed (fix P1): la demo solo se activa con "true" EXPLÍCITO —
// variable ausente o typo → producción. Vercel demo y los builds locales
// la setean explícita (DEMO_MODE=true).

import type { NexoraDB } from "./adapter";
import { demoDB } from "./demo";

const DEMO = process.env.DEMO_MODE === "true";

let _plat: NexoraDB | null = null;
async function loadPlatform(): Promise<NexoraDB> {
  if (!_plat) {
    const mod = await import("./platform");
    _plat = mod.platformDB;
  }
  return _plat;
}

export async function getDB(): Promise<NexoraDB> {
  if (DEMO) return demoDB;
  return loadPlatform();
}

export const ES_DEMO = DEMO;
