# FASE 1 · Onboarding real — tenant ⇄ comercio ⇄ CRM

**Rama:** `feat/fase1-onboarding` (encima de `feat/tienda-app`)

## Qué agrega este cambio

| Pieza | Cambio | Archivo |
|---|---|---|
| **Provisionar con comercio** | `provision-client` ahora crea también la fila `comercios` (plan gratis, `publicada=false`, whatsapp/rubro heredados del CRM) y lo imprime al final | `apps/admin/scripts/provision-client.ts` |
| **Leads desde la landing** | Nuevo endpoint público `POST /crm/leads` (zod + honeypot `empresa` + rate-limit 5/min/IP), escribe en `crm/clientes` estado `nuevo` | `apps/api/src/plugins/leads.ts` + registro en `apps/api/src/index.ts` |
| **Página de captación** | `/quiero-tienda` en la app Next (form con honeypot oculto, estados de éxito/error) | `apps/tienda/src/app/quiero-tienda/page.tsx` |
| **Config** | `NEXT_PUBLIC_API_URL` para que la landing sepa dónde postea | `apps/tienda/.env.example` |

## El funnel completo que queda

```
Cliente potencial → Landing / → "Quiero mi tienda" (/quiero-tienda)
   → POST /crm/leads (apps/api) → crm/clientes [estado: nuevo]
      ↓ (vos cerrás la venta; crm/clientes.estado → vendido)
   → corré provision-client --client-id <uuid> --tenant-name X --tenant-slug x
      → tenant (pending_activation) + user (invited) + COMERCIO listo
      → link de activación 48 hs
   → cliente abre el link, crea contraseña → complete_client_activation()
      → tenant active + user active + lead activo en CRM
   → la tienda /t/{slug} ya existe (publicada=false) → el vendedor publica
```

## Smoke tests

```bash
# 1 · Lead (con la api corriendo)
curl -X POST http://localhost:3001/crm/leads \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"María Demo","telefono":"3415551234","rubro":"Panadería"}'
# → 201 {"ok":true}  ·   verificar:  SELECT * FROM clientes ORDER BY creado_en DESC LIMIT 1;

# 2 · Honeypot (finge éxito, no guarda nada)
curl -X POST http://localhost:3001/crm/leads \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Bot","telefono":"111","empresa":"spam"}'
# → 202 y NO aparece en la tabla

# 3 · Rate limit: correr el test 1 seis veces seguidas → la última da 429
```

## Lo que NO toca este cambio (a propósito)

- La activación ya existente (`consumeActivationToken` + `complete_client_activation`)
  queda intacta: funciona igual, solo que ahora el tenant ya trae su comercio.
- El panel del comercio sigue en demo hasta la Fase 1.5 (auth JWT en apps/tienda
  con el middleware que valide tu `access_token` y derive `tenant_id`).
- La landing `/` tíada a `/quiero-tienda` queda como cambio de una línea
  (buscar el CTA principal y apuntar `href="/quiero-tienda"`).
