# 🛍️ Nexora — Tu tienda por WhatsApp, lista en 5 minutos

SaaS multi-tenant de marca blanca para comercios chicos que venden por Instagram y WhatsApp.
Next.js 14 (App Router) + TypeScript estricto + Tailwind + Supabase (listo para enchufar).

## Correr ahora (modo demo, sin base de datos)

```bash
npm install
npm run dev -- -p 3001
```

Abrí:

| URL | Qué es |
|---|---|
| `/` | Landing de Nexora (para conseguir comercios) |
| `/t/panaderia-maria` | **Tienda del cliente** — buscador, carrito, checkout, chat de ayuda |
| `/panel/pedidos` | **Panel del vendedor** — pedidos en tiempo real |
| `/panel/catalogo` | Catálogo con switch de stock y alta rápida |
| `/panel/caja` | Cierre de caja del día + CSV para Excel + gráfico 7 días |
| `/panel/clientes` | Clientes frecuentes (VIP con % oculto al cliente) |
| `/panel/config` | Diseño (lista/cuadrícula/banners), 3 temas color, descuentos, entrega, suscripción |
| `/api/reporte` | Descarga CSV del cierre (con BOM, abre bien en Excel) |

**Modo oscuro:** luna/sol arriba a la derecha del panel.
**Temas:** Ámbar / Esmeralda / Azul (se cambian en Config → "Diseño y color").
**Fotos de producto:** en Catálogo → botón naranja ➕ → "SUBIR" (hasta 3 fotos, JPG/PNG/WebP ≤ 3 MB, validado del lado del servidor). En demo se guardan en `public/uploads/{comercio}/`; en producción el endpoint `/api/upload` va al bucket `productos` de Supabase Storage sin tocar el front. Si un producto no tiene foto, cae al ícono-emoji de siempre.

## Cómo probar el flujo completo

1. Entrá a `/t/panaderia-maria`, buscá "rogel", sumá al carrito.
2. Checkout: elegí **efectivo** → te aplica **15% de descuento** (vigente hoy).
3. Confirmá → te genera pedido `#XXX` y abre WhatsApp con el resumen + link del comprobante.
4. En `/panel/pedidos` aparece al instante → confirmálo, pasalo a preparación, finalizá.
5. En `/panel/caja` se suma al cierre del día. Bajá el CSV.

## Modo producción (Supabase)

1. Creá proyecto en supabase.com → SQL Editor.
2. Ejecutá en orden:
   ```
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_rls.sql
   supabase/migrations/0003_functions.sql
   ```
3. Copiá las credenciales a `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   DEMO_MODE=false
   ```
4. Reiniciá — el adaptador cambia automáticamente de memoria a Postgres (`src/lib/data/index.ts`).

## Arquitectura en 30 segundos

```
src/
├── lib/
│   ├── constants.ts     ← reglas de negocio (planes, estados, temas)
│   ├── types.ts         ← tipos de dominio (espejo del SQL)
│   ├── money.ts         ← motor de descuentos (Max/tope/vigencia — N6)
│   └── data/
│       ├── adapter.ts   ← DataAdapter: contrato que cumplen demo y supabase
│       ├── demo.ts      ← base en memoria con estados persistentes
│       ├── supabase.ts  ← adapter real (llama a RPCs del 0003)
│       └── index.ts     ← getDB(): elige adapter según env
├── app/
│   ├── t/[slug]/        ← tienda pública (server component + StoreClient)
│   ├── panel/           ← panel del vendedor (5 pestañas)
│   ├── pedido/[token]/  ← seguimiento del cliente (link no adivinable)
│   └── api/
│       ├── assistant/   ← chat dual: cliente y vendedor (reglas hoy, LLM enchufable)
│       └── reporte/     ← CSV cierre de caja
└── supabase/migrations/ ← 0001 schema · 0002 RLS multi-tenant · 0003 funciones
```

## Reglas de negocio implementadas (N1–N15)

- **N1** Multi-tenant total: RLS en Postgres, cada comercio solo ve lo suyo.
- **N3** El navegador nunca calcula dinero: el total lo recalcula el servidor.
- **N4** Ítems congelados: si cambiás el precio del pan, pedidos viejos no cambian.
- **N5** Máquina de estados de pedidos validada (no hay saltos).
- **N6** Descuentos: mejor oferta gana (o acumulan con tope), nunca sobre el envío, con vigencia por fechas.
- **N7** Slug único e inmutable (el link de la bio es un activo).
- **N8** Mercado Pago: no arranca checkout hasta email verificado.
- **M8** wa.me no adjunta archivos; el comprobante viaja como LINK.
- **N12** Anti-spam: máx. 3 pedidos pendientes por teléfono.
- **N13** Plan Gratis: tope 30 productos forzado **en servidor** (trigger).
- **N15** Toda acción de dinero recalculada y logueada en el backend.

## Pendiente (fases siguientes del plan maestro)

- **Fase 1**: Auth real Supabase (hoy el panel usa la tienda demo fija), registro de comercios, onboarding.
- **Fase 2**: Mercado Pago Suscripciones (cobro a comercios), integración LLM al asistente (`LLM_PROVIDER`), emails Resend, PDF del comprobante, plan Pro activado.
- **Fase 3**: QA en Vercel + analytics.

---

_Hecho en una sola conversación con IA — como el plan maestro anticipaba: el costo de construir el MVP fue el tiempo de la conversación._
