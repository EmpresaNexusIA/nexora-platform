import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "Nexora",
    short_name: "Nexora",
    description: "Tu tienda online en 5 minutos",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#f59e0b",
    icons: [],
  });
}
