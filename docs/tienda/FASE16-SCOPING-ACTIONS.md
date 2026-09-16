# Fase 1.6 · Fix P1 — Scoping de las server actions del panel

> Estado: ✅ implementado. Resuelve el P1 detectado por el bot Codex sobre el
> código de la Fase 1.5 (ver `FASE15-AUTH-PANEL.md`).

## Qué estaba mal

Cuatro server actions del panel recibían un ID de registro y mutaban directo,
**sin verificar que el registro perteneciera al comercio de la sesión**:

| Action                | Método del adapter | Riesgo                                                    |
| --------------------- | ------------------ | --------------------------------------------------------- |
| `cambiarEstadoAction` | `cambiarEstado`    | cambiar/cancelar pedidos de OTRO comercio                 |
| `marcarPagadoAction`  | `marcarPagado`     | marcar pagado/impago pedidos de otro comercio             |
| `toggleDisponibleAction` | `setDisponible` | apagar/prender productos de otro catálogo                 |
| `setFrecuenteAction`  | `setFrecuente`     | tocar la lista de clientes frecuentes ajena               |

Los IDs son uuidv7 (secuenciales y predecibles en el tiempo), así que el
ataque era realista: cualquier vendedor logueado podía operar sobre otro
comercio conociendo o estimando IDs.

## El fix

Regla N1 en serio: **cada comercio toca solo lo suyo**.

1. Las 4 actions ahora arrancan con `getTiendaActual()` (sesión → JWT →
   tenant → comercio). Sin tienda de sesión → `{ ok: false, error: "Sin tienda" }`
   y no se toca la base.
2. El `comercioId` baja al DataAdapter como primer parámetro. Se deriva de la
   cookie `nx_session` en el servidor; **nunca** viene del cliente.
3. Las queries de escritura filtran por comercio:
   - `productos`: `where id = $2 and comercio_id = $1`
   - `pedidos`: `where id = $2 and comercio_id = $1`
   - `clientes_frecuentes`: `where id = $4 and comercio_id = $1`
4. `demo.ts` aplica el mismo chequeo en memoria (paridad de contrato, la
   preview se comporta igual que producción).

### Caso particular: `cambiarEstado`

La máquina de estados vive en la función SQL `public.cambiar_estado_pedido`
(`SECURITY DEFINER`, recibe solo el id del pedido). En vez de tocar la
migración, `platform.ts` valida la pertenencia **antes** de llamarla:

```sql
select comercio_id from pedidos where id = $1 and deleted_at is null
```

Si no coincide con el comercio de la sesión → `{ ok: false, error: "Pedido no
encontrado." }` (el mismo error que un id inexistente: no filtrar información).
No hay TOCTOU: `comercio_id` es inmutable, se fija en el insert y nada lo
actualiza.

Las firmas de las actions **no cambiaron**: el panel (PedidosClient,
ClientesClient) no se toca. El control es 100% server-side.

## Queda pendiente de la Fase 1.6

- Refresh token (rotación) y logout real de la cookie `nx_session`.
- Roles de empleado (dueño vs. empleado) para restringir `config`/`caja`.

## Cómo probarlo

- Demo (`DEMO_MODE=true`): todo sigue igual, la tienda demo es `c1` y el
  chequeo pasa siempre → el panel funciona idéntico.
- Producción (`DEMO_MODE=false`): con dos comercios dados de alta, intentar
  desde el panel del comercio A pasarle a `cambiarEstadoAction` un `pedidoId`
  del comercio B → tiene que devolver `{ ok: false, error: "Pedido no encontrado." }`
  y no mutar nada (se puede verificar con `select estado from pedidos where id = ...`).
