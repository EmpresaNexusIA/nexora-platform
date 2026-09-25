-- ============================================================
-- 0015 — Email opcional en pedidos (fix C1 auditoría UX NEX-26/AUD-01)
--
--  1. Quita el NOT NULL de public.pedidos.cliente_email: el email pasa a
--     ser dato opcional en el checkout.
--  2. Reemplaza public.crear_pedido() por su versión idéntica (copia
--     byte-idéntica de la función en sql/0010_tienda_domain.sql) con SOLO
--     estos dos cambios:
--       a. email_c := nullif(lower(trim(...))): el string vacío pasa a NULL.
--       b. El regex se valida solo si vino un email (email_c is not null) —
--          el pedido sin email es válido.
--     Todo lo demás (validaciones, stock, descuentos, items, insert al
--     outbox, exception) queda intacto.
--
--  Idempotente (ALTER ... DROP NOT NULL / CREATE OR REPLACE).
-- ============================================================

BEGIN;

--> statement-breakpoint
ALTER TABLE public.pedidos ALTER COLUMN cliente_email DROP NOT NULL;

--> statement-breakpoint
create or replace function public.crear_pedido(
  p_slug text, p_cliente jsonb, p_lineas jsonb,
  p_modo_entrega text, p_direccion text, p_notas text, p_metodo_pago text,
  p_base_url text
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  c record; l record; prod record;
  tel text := regexp_replace(coalesce(p_cliente->>'telefono',''), '\D', '', 'g');
  email_c text := nullif(lower(trim(coalesce(p_cliente->>'email',''))), '');
  v_cant int; v_stock int; v_pend int; v_lineas int := 0;
  v_subtotal numeric(10,2) := 0; v_envio numeric(10,2) := 0;
  v_vip numeric(5,2) := 0; v_pago numeric(5,2) := 0; v_ap numeric(5,2) := 0;
  v_regla text := 'ninguna'; v_desc numeric(10,2) := 0; v_total numeric(10,2) := 0;
  v_ped public.pedidos; v_items jsonb := '[]'::jsonb; v_nro text; v_mensaje text;
begin
  select c.*, t.slug, t.status as tenant_status
    into c from public.comercios c join public.tenants t on t.id = c.tenant_id
   where t.slug = p_slug;
  if not found or c.publicada = false or c.tenant_status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Esta tienda está pausada o no existe.');
  end if;
  if length(trim(coalesce(p_cliente->>'nombre',''))) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Decinos tu nombre.'); end if;
  if email_c is not null and email_c !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'Revisá tu email.'); end if;
  if length(tel) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Revisá tu celular.'); end if;
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Tu pedido está vacío.'); end if;
  if (p_modo_entrega = 'envio' and c.modo_entrega = 'retiro')
     or (p_modo_entrega = 'retiro' and c.modo_entrega = 'envio') then
    return jsonb_build_object('ok', false, 'error', 'Ese modo de entrega no está disponible.'); end if;
  if p_modo_entrega = 'envio' and length(trim(coalesce(p_direccion,''))) < 4 then
    return jsonb_build_object('ok', false, 'error', 'Necesitamos tu dirección para el envío.'); end if;

  select count(*) into v_pend from public.pedidos
   where comercio_id = c.id and cliente_telefono = tel and estado = 'pendiente';
  if v_pend >= 3 then
    return jsonb_build_object('ok', false, 'error',
      'Tenés varios pedidos pendientes en esta tienda. Esperá a que los confirmen.'); end if;

  select coalesce(descuento_especial,0) into v_vip from public.clientes_frecuentes
   where comercio_id = c.id and telefono_cliente = tel and es_frecuente;
  v_vip := coalesce(v_vip, 0);

  if c.metodo_descuento <> 'ninguno' and c.porcentaje_descuento > 0
     and p_metodo_pago = c.metodo_descuento
     and (c.dto_desde is null or c.dto_desde <= current_date)
     and (c.dto_hasta is null or c.dto_hasta >= current_date) then
    v_pago := c.porcentaje_descuento;
  end if;
  if c.acumular_descuentos then
    v_ap := least(v_vip + v_pago, c.tope_descuento);
    if v_ap > 0 then v_regla := case when (v_vip + v_pago) > v_ap
                                     then 'acumulado_tope' else 'acumulado' end; end if;
  else
    v_ap := greatest(v_vip, v_pago);
    if v_ap > 0 then v_regla := case when v_vip >= v_pago then 'vip' else 'pago' end; end if;
  end if;

  for l in select value as linea from jsonb_array_elements(p_lineas) loop
    v_lineas := v_lineas + 1;
    if v_lineas > 50 then
      return jsonb_build_object('ok', false, 'error', 'Demasiados ítems.'); end if;
    v_cant := coalesce((l.linea->>'cantidad')::int, 0);
    if v_cant <= 0 or v_cant > 99 then
      return jsonb_build_object('ok', false, 'error', 'Cantidad inválida.'); end if;
    select * into prod from public.productos
     where id = (l.linea->>'productoId')::uuid and comercio_id = c.id
       and deleted_at is null
     for update;
    if not found then
      return jsonb_build_object('ok', false, 'error',
        'Un producto ya no existe. Recargá la tienda.'); end if;
    if not prod.disponible then
      return jsonb_build_object('ok', false, 'error',
        format('"%s" está agotado por hoy.', prod.nombre)); end if;
    v_stock := coalesce(prod.stock_numerico, -1);
    if v_stock >= 0 and v_cant > v_stock then
      return jsonb_build_object('ok', false, 'error',
        format('"%s": quedan solo %s unidades.', prod.nombre, v_stock)); end if;
    v_subtotal := v_subtotal + round(prod.precio * v_cant, 2);
    v_items := v_items || jsonb_build_object(
      'producto_id', prod.id, 'nombre', prod.nombre, 'precio', prod.precio, 'cantidad', v_cant);
  end loop;

  v_envio := case when p_modo_entrega = 'envio' then coalesce(c.costo_envio,0) else 0 end;
  v_desc := round(v_subtotal * v_ap / 100.0, 2);
  v_total := round(v_subtotal + v_envio - v_desc, 2);

  update public.comercios set contador_pedidos = contador_pedidos + 1
   where id = c.id returning contador_pedidos into v_cant;
  v_nro := '#' || lpad(v_cant::text, 3, '0');

  insert into public.pedidos (
    token, comercio_id, numero_orden, estado, pagado, metodo_pago, modo_entrega,
    direccion_entrega, cliente_nombre, cliente_email, cliente_telefono, notas_cliente,
    costo_envio, subtotal, descuento_aplicado, total_final, dto_regla
  ) values (
    encode(gen_random_bytes(9),'hex'), c.id, v_nro, 'pendiente', false,
    p_metodo_pago, p_modo_entrega, trim(coalesce(p_direccion,'')),
    trim(p_cliente->>'nombre'), email_c, tel, coalesce(p_notas,''),
    v_envio, v_subtotal, v_desc, v_total, v_regla
  ) returning * into v_ped;

  update public.pedidos set url_pdf = p_base_url || '/pedido/' || v_ped.token
   where id = v_ped.id returning * into v_ped;

  for l in select * from jsonb_array_elements(v_items) loop
    insert into public.items_pedido
      (pedido_id, producto_id, nombre_congelado, precio_congelado, cantidad, subtotal)
    values (v_ped.id, (l.value->>'producto_id')::uuid, l.value->>'nombre',
      (l.value->>'precio')::numeric, (l.value->>'cantidad')::int,
      round((l.value->>'precio')::numeric * (l.value->>'cantidad')::int, 2));
    update public.productos
       set stock_numerico = stock_numerico - (l.value->>'cantidad')::int,
           disponible = case when stock_numerico - (l.value->>'cantidad')::int <= 0
                             then false else disponible end
     where id = (l.value->>'producto_id')::uuid and stock_numerico is not null;
  end loop;

  insert into public.clientes_frecuentes
    (comercio_id, nombre_cliente, telefono_cliente, es_frecuente, descuento_especial)
  values (c.id, trim(p_cliente->>'nombre'), tel, false, 0)
  on conflict (comercio_id, telefono_cliente) do nothing;

  v_mensaje := 'Hola ' || c.nombre || '! Pedido ' || v_nro || E'\n\n'
    || (select string_agg(format('• %sx %s — $%s', (i.value->>'cantidad'),
          (i.value->>'nombre'),
          ((i.value->>'precio')::numeric * (i.value->>'cantidad')::int)::numeric(10,2)),
          E'\n') from jsonb_array_elements(v_items) i)
    || E'\n\nTOTAL: $' || v_total
    || E'\nPago: ' || p_metodo_pago || ' · ' || p_modo_entrega
    || E'\n\nComprobante: ' || v_ped.url_pdf;

  -- Evento para el orchestrator (outbox pattern ya vigente en la plataforma)
  insert into audit.outbox (id, aggregate_type, aggregate_id, event_type, payload, status, created_at)
  values (gen_random_uuid(), 'pedido', v_ped.id::text, 'pedido.creado',
          jsonb_build_object('comercio_id', c.id, 'tenant_id', c.tenant_id,
            'numero_orden', v_nro, 'total', v_total, 'telegram_chat_id', c.telegram_chat_id,
            'ntfy_topic', c.ntfy_topic),
          'PENDING', now())
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'pedido', to_jsonb(v_ped),
    'numero_orden', v_nro, 'tokenSeguimiento', v_ped.token,
    'waUrl', 'https://wa.me/' || regexp_replace(c.whatsapp,'\D','','g') || '?text=' || v_mensaje);
exception when others then
  return jsonb_build_object('ok', false, 'error', 'No pudimos crear tu pedido. Probá de nuevo.');
end $$;

--> statement-breakpoint
COMMIT;

-- ============================================================
-- DOWN MIGRATION (ROLLBACK):
-- 1. Restaurar la función original: sql/0010_tienda_domain.sql
--    (sección crear_pedido).
-- 2. Si no hay pedidos con cliente_email NULL:
--    ALTER TABLE public.pedidos ALTER COLUMN cliente_email SET NOT NULL;
-- ============================================================
