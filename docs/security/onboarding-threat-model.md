# Modelo de Amenazas y Recuperación del Backend de Onboarding

**Fecha:** 2026-08-14
**Estado:** Activo
**Ámbito:** `feat/0010-onboarding-boundary` — Proceso de Aprovisionamiento Asistido y Activación de Tenants

---

## 1. Contexto de Arquitectura y Seguridad

El backend de onboarding de Nexora permite transformar un cliente CRM en estado `vendido` en un tenant operativo (`active`) con su usuario inicial activado. Se compone de:

1. **Aprovisionamiento Asistido (`apps/admin/scripts/provision-client.ts`):** Herramienta administrativa CLI que crea el tenant en `pending_activation`, el usuario en `invited`, vincula el cliente CRM (`onboarding`) e imprime un enlace con token único.
2. **Token Redis (`activation-token.ts`):** Token de 32 bytes aleatorios (256 bits entropía, Base64URL) con hash SHA-256 almacenado en Redis y TTL de 48 horas.
3. **Endpoint Público (`POST /onboarding/activate`):** Valida token, fuerza política de contraseña Zod, genera hash bcrypt costo 10 y ejecuta la función PostgreSQL `complete_client_activation`.
4. **Función Angosta DB (`public.complete_client_activation`):** `SECURITY DEFINER` ejecutada exclusivamente por `api_user` que actualiza atómicamente en una sola transacción las 3 entidades (cliente, tenant, usuario) verificando precondiciones estrictas.

---

## 2. Análisis de Vectores de Amenaza y Mitigaciones

### T1. Token predecible o entropía insuficiente
- **Riesgo:** Un atacante intenta adivinar tokens de activación mediante fuerza bruta.
- **Mitigación:** Generación criptográficamente segura con `crypto.randomBytes(32)` (256 bits de entropía). Se almacena únicamente el digest SHA-256 en Redis (`activation_token:<sha256>`). Si Redis es comprometido en lectura, el atacante no obtiene el token crudo en texto claro.

### T2. Carrera de condición por peticiones concurrentes (Race Condition)
- **Riesgo:** Múltiples peticiones concurrentes usan el mismo token para activar la cuenta simultáneamente.
- **Mitigación:** Consumo atómico del token en Redis mediante script Lua (`GET` + `DEL` atómico). Adicionalmente, la función PostgreSQL `complete_client_activation` exige que `users.status = 'invited'`, por lo que la segunda transacción fallará y provocará un rollback total.

### T3. Escalación de Privilegios por `api_user`
- **Riesgo:** `api_user` no posee acceso directo SELECT/INSERT/UPDATE a `public.clientes`. Un atacante intenta abusar de la función `SECURITY DEFINER` para alterar registros arbitrarios.
- **Mitigación:** `complete_client_activation` exige precondiciones estrictas:
  - `clientes.estado = 'onboarding'` y `provisioned_tenant_id = p_tenant_id`.
  - `tenants.status = 'pending_activation'`.
  - `users.status = 'invited'` y pertenencia al `p_tenant_id`.
  Si alguna de las 3 verificaciones no coincide con exactamente 1 fila, la función lanza una excepción y aborta la transacción. `REVOKE EXECUTE FROM PUBLIC` evita que otros roles sin privilegios ejecuten la función.

### T4. Divulgación de Información y Timing Attacks
- **Riesgo:** Mensajes de error diferenciados o variaciones de tiempo de respuesta permiten al atacante enumerar si un token existe, expiró o fue usado.
- **Mitigación:**
  - Respuesta HTTP unívoca para cualquier falla de activación: `HTTP 400 Bad Request` con `{"error": "Invitación inválida o expirada"}`.
  - Delay constante anti-timing (~200ms) introducido antes de responder en todos los flujos de activación.
  - Rate-limiting estricto por IP (3 intentos / 15 min) y por hash de token (1 intento / 5 min).

### T5. Denegación de Servicio (DoS)
- **Riesgo:** Generación masiva o consumo malicioso de tokens.
- **Mitigación:**
  - Aprovisionamiento asistido requiere CLI del fundador y valida estado `vendido`.
  - Rate limit en script de aprovisionamiento por `clientId` (1 ejec / min).
  - Rate limit en `POST /onboarding/activate` vía Redis.

### T6. Salto de Aislamiento Multi-Tenant (Tenant Bypass)
- **Riesgo:** Asignación cruzada de un tenant a otro cliente o activación de un usuario en un tenant ajeno.
- **Mitigación:** Restricción de unicidad mediante índice único parcial `idx_clientes_provisioned_tenant_id` WHERE `provisioned_tenant_id IS NOT NULL`. Validación explícita de vinculación en la función de activación DB.

---

## 3. Comportamiento DB ↔ Redis y Plan de Recuperación

### Escenario de Fallo: Consumo de Token en Redis con Fallo en DB
1. El usuario envía `POST /onboarding/activate`.
2. El token se elimina atómicamente de Redis (`GETDEL`).
3. La consulta PostgreSQL falla (por ejemplo, timeout, desconexión de red o fallo de precondición en DB).

**Efecto:**
- En PostgreSQL, los estados de la base de datos no sufrieron cambios (`users.status` permanece `'invited'`). La DB es la fuente única de verdad.
- El token en Redis fue consumido y no puede reutilizarse.
- La API registra un evento `CRITICAL`:
  `CRITICAL: Fallo en DB durante activación post-consumo de token Redis. Se requiere nueva invitación.`
- La API devuelve `HTTP 400 Bad Request` al usuario.

**Mecanismo de Recuperación:**
El administrador fundador reemite la invitación utilizando la herramienta de aprovisionamiento:
```bash
pnpm --filter @nexora/admin provision -- \
  --client-id <CLIENT_UUID> \
  --tenant-name "Nombre Tenant" \
  --tenant-slug "tenant-slug" \
  --user-email "usuario@cliente.com"
```
El script detecta la invitación previa, invalida cualquier residuo previo en Redis y genera un nuevo enlace de activación sin alterar la consistencia de los datos en PostgreSQL.
