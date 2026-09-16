// NEXORA · Formato (ARS por defecto, voseo-friendly)

export const fmtMoney = (n: number, moneda = "ARS"): string =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export const fmtHora = (iso: string): string =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

export const fmtFechaCorta = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

export const fmtFechaLarga = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });

export const soloDigitos = (s: string): string => s.replace(/\D/g, "");

export const generarToken = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);

export const hashEmoji = (id: string): number => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

export const hoyISOlocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};
