// NEXORA · Slugs — regla N7 (único, sanitizado, reservadas, casi inmutable)

const RESERVADAS = new Set([
  "admin", "api", "app", "nexora", "soporte", "terminos", "privacidad",
  "panel", "login", "registro", "pedido", "t", "www", "mail", "tienda",
]);

export function normalizarSlug(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // rango Unicode de tildes combinantes
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
  return base || "tienda";
}

export function esReservada(slug: string): boolean {
  return RESERVADAS.has(slug);
}

/** Genera un slug único consultando existentes (sufijo -2, -3... — fix M3) */
export function generarSlugUnico(
  nombre: string,
  existentes: (slug: string) => string | null,
): string {
  const base = normalizarSlug(nombre);
  if (esReservada(base)) return generarSlugUnico(base + "-tol", existentes);
  let candidato = base;
  let i = 2;
  while (existentes(candidato) !== null) {
    candidato = `${base}-${i++}`;
  }
  return candidato;
}
