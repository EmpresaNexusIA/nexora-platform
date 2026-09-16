import type { Config } from "tailwindcss";

/**
 * Sistema de color por TEMAS (directiva del fundador):
 * solo 3 presets de marca (ambair/esmeralda/azul) + modo oscuro global.
 * Los presets inyectan variables CSS --brand/--brand-accent (canales RGB).
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "rgb(var(--brand) / <alpha-value>)",
        brandAccent: "rgb(var(--brand-accent) / <alpha-value>)",
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        card: "0 6px 24px -8px rgb(15 23 42 / 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
