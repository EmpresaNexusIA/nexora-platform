import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexora · Tu tienda online en 5 minutos",
  description: "Creá tu tienda, recibí pedidos por WhatsApp y vendé más. Sin comisiones.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

// Script anti-FOUC: aplica modo claro/oscuro antes de pintar
const themeScript = `
(function(){
  try {
    var m = localStorage.getItem("nexora-modo");
    if (m === "oscuro" || (!m && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
