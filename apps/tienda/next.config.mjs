// NEXORA · Config de Next (apps/tienda)
// U2-2 (issue #11 punto 1): CSP + security headers estrictos.
// - ntfy.sh / mpago.la / wa.me son llamadas SERVER-SIDE o links de
//   navegación → no se abren en la CSP del navegador.
// - Fotos de productos: /uploads/ locales → img-src 'self' alcanza.
// - Next App Router requiere 'unsafe-inline' en script/style salvo nonce
//   por request (que desactiva el prerender estático).

const isDev = process.env.NODE_ENV === "development";
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Fix de seguridad #4: sin el origen de la API el login y la landing de
  // leads (fetch del navegador a NEXT_PUBLIC_API_URL) serían bloqueados.
  `connect-src 'self'${apiOrigin ? " " + apiOrigin : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
