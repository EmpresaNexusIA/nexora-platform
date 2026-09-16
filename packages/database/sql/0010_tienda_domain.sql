-- =====================================================================
-- NEXORA · 0010 · DOMINIO TIENDA (Postgres self-hosted, SIN Supabase)
-- Tablas: espejo de drizzle/schema/tienda/*.ts (si drizzle-kit ya las creó,
-- estos CREATE TABLE IF NOT EXISTS son inofensivos).
-- Funciones (recomendado ejecutar): crear_pedido(), cambiar_estado_pedido(),
-- resumen_caja(), registrar_visita().
-- RLS: usa current_setting('app.tenant_id') — lo setea apps/api por request
-- con SET LOCAL dentro de la transacción. ANON (checkout público) solo pasa
-- por funciones SECURITY DEFINER, que validan todo adentro.
-- USUARIO QUE EJECUTA: nexora_admin (o DATABASE_ADMIN_URL).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- ROL DE APLICACIÓN (si no existe) ----------
do $$ begin
  if not exists (select from pg_roles where rolname = 'nexora_tienda') then
    create role nexora_tienda nologin;
  end if;
end $$;

-- ---------- RLS: cabo y políticas ----------
-- Tabla puente comercio_id→tenant_id reutilizable
create or replace function public.tenant_de_comercio(p_comercio uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from public.comercios where id = p_comercio $$;

-- Macro de política: dueño tenant vía claim de sesión
alter table public.comercios          enable row level security;
alter table public.categorias         enable row level security;
alter table public.productos          enable row level security;
alter table public.clientes_frecuentes enable row level security;
alter table public.pedidos            enable row level security;
alter table public.items_pedido       enable row level security;
alter table public.suscripciones      enable row level security;
alter table public.metricas_tienda    enable row level security;

create policy comercios_tenant on public.comercios using (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
);
create policy categorias_tenant on public.categorias using (
  public.tenant_de_comercio(comercio_id) = nullif(current_setting('app.tenant_id', true), '')::uuid
);
create policy productos_tenant on public.productos using (
  public.tenant_de_comercio(comercio_id) = nullif(current_setting('app.tenant_id', true), '')::uuid
);
create policy frecuentes_tenant on public.clientes_frecuentes using (
  public.tenant_de_comercio(comercio_id) = nullif(current_setting('app.tenant_id', true), '')::uuid
);
create policy pedidos_tenant on public.pedidos using (
  public.tenant_de_comercio(comercio_id) = nullif(current_setting('app.tenant_id', true), '')::uuid
);
create policy items_tenant on public.items_pedido using (
  pedido_id in (select p.id from public.pedidos p
    where public.tenant_de_comercio(p.comercio_id)
        = nullif(current_setting('app.tenant_id', true), '')::uuid)
);
create policy suscripciones_tenant on public.suscripciones using (
  public.tenant_de_comercio(comercio_id) = nullif(current_setting('app.tenant_id', true), '')::uuid
);
create policy metricas_tenant on public.metricas_tienda using (
  public.tenant_de_comercio(comercio_id) = nullif(current_setting('app.tenant_id', true), '')::uuid
);

-- ---------- registrar_visita ----------
create or replace function public.registrar_visita(p_slug text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.metricas_tienda (comercio_id, fecha, visitas)
  select c.id, current_date, 1
  from public.comercios c join public.tenants t on t.id = c.tenant_id
  where t.slug = p_slug
  on conflict (comercio_id, fecha) do update set visitas = metricas_tienda.visitas + 1;
end $$;

-- ---------- crear_pedido (workflow rey — reglas N3,N4,N6,N12) ----------
create or replace function public.crear_pedido(
  p_slug text, p_cliente jsonb, p_lineas jsonb,
  p_modo_entrega text, p_direccion text, p_notas text, p_metodo_pago text,
  p_base_url text
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  c record; l record; prod record;
  tel text := regexp_replace(coalesce(p_cliente->>'telefono',''), '\D', '', 'g');
  email_c text := lower(trim(coalesce(p_cliente->>'email','')));
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
  if email_c !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
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

-- NOTA outbox: si tu tabla audit.outbox tiene columnas distintas, ajustá este
-- INSERT (o dejalo comentado y hacé el evento desde apps/api). Borrar el insert
-- NO afecta nada del negocio (después del return igual funciona el pedido).

-- ---------- cambiar_estado_pedido (máquina de estados N5 + reintegro stock) ----------
create or replace function public.cambiar_estado_pedido(
  p_pedido uuid, p_nuevo text, p_reintegrar boolean
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  p record; it record; permitido text[];
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pedido no encontrado.'); end if;
  permitido := case p.estado
    when 'pendiente' then array['confirmado','cancelado']
    when 'confirmado' then array['en_preparacion','cancelado']
    when 'en_preparacion' then array['finalizado','cancelado']
    else array[]::text[] end;
  if not (p_nuevo = any(permitido)) then
    return jsonb_build_object('ok', false, 'error',
      format('No se puede pasar de "%s" a "%s".', p.estado, p_nuevo)); end if;

  if p_nuevo = 'cancelado' and p_reintegrar
     and exists (select 1 from public.items_pedido
                 where pedido_id = p.id and producto_id is not null) then
    for it in select * from public.items_pedido where pedido_id = p.id loop
      update public.productos
         set stock_numerico = stock_numerico + it.cantidad, disponible = true
       where id = it.producto_id and stock_numerico is not null;
    end loop;
    update public.items_pedido set producto_id = null where pedido_id = p.id;
  end if;

  update public.pedidos set estado = p_nuevo, ultimo_cambio_estado = now()
   where id = p.id;

  if p_nuevo = 'finalizado' then
    update public.clientes_frecuentes cf
       set pedidos_finalizados = cf.pedidos_finalizados + 1,
           es_frecuente = case when c.umbral_frecuente > 0
                and cf.pedidos_finalizados + 1 >= c.umbral_frecuente
                then true else cf.es_frecuente end,
           origen = case when c.umbral_frecuente > 0
                and cf.pedidos_finalizados + 1 >= c.umbral_frecuente
                then 'auto' else cf.origen end
      from public.comercios c
     where cf.comercio_id = p.comercio_id
       and cf.telefono_cliente = p.cliente_telefono
       and c.id = p.comercio_id;
  end if;

  insert into public.metricas_tienda (comercio_id, fecha, pedidos, total_vendido)
  values (p.comercio_id, current_date, 1, p.total_final)
  on conflict (comercio_id, fecha) do update
    set pedidos = metricas_tienda.pedidos + 1,
        total_vendido = metricas_tienda.total_vendido + p.total_final;

  return jsonb_build_object('ok', true);
end $$;

-- ---------- resumen_caja ----------
create or replace function public.resumen_caja(p_comercio uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v record;
begin
  select current_date::text as fecha,
    coalesce(sum(total_final),0)::numeric(12,2) as total,
    coalesce(sum(total_final) filter (where pagado),0)::numeric(12,2) as cobrado,
    count(*)::int as pedidos,
    coalesce(avg(total_final),0)::numeric(12,2) as ticket_promedio
   into v from public.pedidos
  where comercio_id = p_comercio and estado <> 'cancelado'
    and created_at::date = current_date;

  return jsonb_build_object('fecha', v.fecha, 'total', v.total, 'cobrado', v.cobrado,
    'porCobrar', v.total - v.cobrado, 'pedidos', v.pedidos, 'ticketPromedio', v.ticket_promedio,
    'porMetodo', (
      select coalesce(jsonb_object_agg(metodo_pago, s), '{}'::jsonb) from (
        select metodo_pago, sum(total_final)::numeric(12,2) s
          from public.pedidos
         where comercio_id = p_comercio and estado <> 'cancelado'
           and created_at::date = current_date group by metodo_pago) x),
    'topProductos', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cant)), '[]'::jsonb) from (
        select nombre_congelado as nombre, sum(cantidad)::int as cant
          from public.items_pedido i join public.pedidos p on p.id = i.pedido_id
         where p.comercio_id = p_comercio and p.estado <> 'cancelado'
           and p.created_at::date = current_date
         group by nombre_congelado order by cant desc limit 5) y),
    'ultimos7Dias', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d_letra, 'total', tot) order by f), '[]'::jsonb) from (
        select d::date as f,
          (array['D','L','M','M','J','V','S'])[extract(dow from d)::int + 1] as d_letra,
          coalesce(sum(p.total_final),0)::numeric(12,2) as tot
        from generate_series(current_date - 6, current_date, '1 day') d
        left join public.pedidos p
          on p.comercio_id = p_comercio and p.estado <> 'cancelado'
         and p.created_at::date = d::date
        group by f, d_letra) z));
end $$;

-- ---------- Límite Plan Gratis (30 productos, forzado en servidor — N13) ----------
create or replace function public.validar_limite_productos()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_plan text; v_cant int;
begin
  select plan into v_plan from public.comercios where id = new.comercio_id;
  if v_plan = 'gratis' then
    select count(*) into v_cant from public.productos
     where comercio_id = new.comercio_id and deleted_at is null;
    if v_cant >= 30 then
      raise exception 'Límite del Plan Gratis: 30 productos. Pasate a Emprendedor.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_limite_productos on public.productos;
create trigger trg_limite_productos before insert on public.productos
  for each row execute function public.validar_limite_productos();
