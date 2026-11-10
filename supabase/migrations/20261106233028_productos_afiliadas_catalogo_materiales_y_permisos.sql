-- Catálogo físico de Afiliadas. No conecta checkout, no genera enlaces,
-- no publica fichas anteriores y no asigna permisos automáticamente.
-- Los recursos sin producto siguen siendo generales para Afiliadas.
alter table public.productos
  add column version integer not null default 1 check (version between 1 and 1000000000),
  add column estado_afiliadas text not null default 'borrador'
    check (estado_afiliadas in ('borrador','publicado','archivado')),
  add column actualizado_en timestamptz not null default now();
-- Una ficha puede prepararse sin definir condiciones comerciales.
-- Se conservan los importes existentes, sin adoptar el 20% heredado en altas.
alter table public.productos alter column precio drop not null;
alter table public.productos alter column comision_pct drop not null;
alter table public.productos alter column comision_pct drop default;

create table public.afiliadas_productos (
  usuaria_id uuid not null references public.perfiles(id),
  producto_id uuid not null references public.productos(id),
  habilitada boolean not null default false,
  version integer not null default 1 check (version between 1 and 1000000000),
  actualizada_en timestamptz not null default now(),
  actualizada_por uuid not null,
  primary key (usuaria_id,producto_id)
);
create index afiliadas_productos_producto_idx
  on public.afiliadas_productos(producto_id,usuaria_id);

alter table public.recursos_afiliadas
  add column producto_id uuid references public.productos(id);
create index recursos_afiliadas_producto_idx
  on public.recursos_afiliadas(producto_id,estado,creado_en desc,id)
  where producto_id is not null;

create table public.afiliadas_productos_historial (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references public.perfiles(id),
  producto_id uuid not null references public.productos(id),
  anterior jsonb,
  nuevo jsonb not null,
  administradora_id uuid not null,
  creado_en timestamptz not null default now()
);
create index afiliadas_productos_historial_producto_idx
  on public.afiliadas_productos_historial(producto_id,creado_en desc,id);
create index afiliadas_productos_historial_usuaria_idx
  on public.afiliadas_productos_historial(usuaria_id,creado_en desc,id);

-- Triggers invoker: no elevan privilegios ni aceptan service_role sin actor.
create function private.proteger_producto_afiliadas()
returns trigger language plpgsql security invoker set search_path='' as $function$
begin
  if auth.uid() is null or not (select public.es_admin()) then
    raise exception using errcode='42501',message='Solo una administradora identificada puede editar productos.';
  end if;
  if tg_table_schema<>'public' or tg_table_name<>'productos' or tg_op not in ('INSERT','UPDATE') then
    raise exception using errcode='42501',message='Operación de producto no permitida.';
  end if;
  if tg_op='INSERT' then
    if new.version is distinct from 1 then
      raise exception using errcode='22023',message='La versión inicial debe ser 1.';
    end if;
    new.created_at:=statement_timestamp();
  else
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception using errcode='42501',message='La identidad y creación del producto no se pueden cambiar.';
    end if;
    if new.version is distinct from old.version or old.version>=1000000000 then
      raise exception using errcode='22023',message='La versión la controla la plataforma.';
    end if;
    if old.tipo='fisico' and new.tipo is distinct from 'fisico' and (
      exists(select 1 from public.afiliadas_productos a where a.producto_id=old.id)
      or exists(select 1 from public.recursos_afiliadas r where r.producto_id=old.id)
    ) then
      raise exception using errcode='22023',message='Este producto tiene permisos o materiales asociados. Conservá su tipo físico.';
    end if;
    new.version:=old.version+1;
  end if;
  if new.estado_afiliadas='publicado' and new.tipo is distinct from 'fisico' then
    raise exception using errcode='22023',message='El catálogo de Afiliadas corresponde a productos físicos.';
  end if;
  -- Validar solo altas o un importe cambiado; no endurecer datos históricos.
  if tg_op='INSERT' or new.precio is distinct from old.precio then
    if new.precio is not null and not (new.precio>=0 and new.precio<=1000000000 and new.precio=round(new.precio,2)) then
      raise exception using errcode='22023',message='Precio no válido.';
    end if;
  end if;
  if tg_op='INSERT' or new.comision_pct is distinct from old.comision_pct then
    if new.comision_pct is not null and not (new.comision_pct>=0 and new.comision_pct<=100) then
      raise exception using errcode='22023',message='Comisión no válida.';
    end if;
  end if;
  new.actualizado_en:=statement_timestamp();
  return new;
end $function$;
revoke all on function private.proteger_producto_afiliadas() from public,anon,authenticated,service_role;
create trigger proteger_producto_afiliadas before insert or update on public.productos
  for each row execute function private.proteger_producto_afiliadas();

create function private.proteger_permiso_producto_afiliadas()
returns trigger language plpgsql security invoker set search_path='' as $function$
declare tipo_producto text;
begin
  if auth.uid() is null or not (select public.es_admin()) then
    raise exception using errcode='42501',message='Solo una administradora identificada puede cambiar permisos.';
  end if;
  if tg_table_schema<>'public' or tg_table_name<>'afiliadas_productos' or tg_op not in ('INSERT','UPDATE') then
    raise exception using errcode='42501',message='Operación de permiso no permitida.';
  end if;
  if tg_op='INSERT' then
    if new.version is distinct from 1 then
      raise exception using errcode='22023',message='La versión inicial debe ser 1.';
    end if;
  else
    if new.usuaria_id is distinct from old.usuaria_id or new.producto_id is distinct from old.producto_id then
      raise exception using errcode='42501',message='La afiliada y el producto del permiso no se pueden cambiar.';
    end if;
    if new.version is distinct from old.version or old.version>=1000000000 then
      raise exception using errcode='22023',message='La versión la controla la plataforma.';
    end if;
    new.version:=old.version+1;
  end if;
  -- Comparte bloqueo con la edición del producto: no crear vínculos mientras
  -- otra transacción convierte esa ficha a un tipo ajeno al catálogo físico.
  select p.tipo into tipo_producto from public.productos p where p.id=new.producto_id for share;
  if not found or tipo_producto is distinct from 'fisico' then
    raise exception using errcode='22023',message='Elegí un producto físico.';
  end if;
  if new.habilitada and not exists(
    select 1 from public.perfiles p join public.accesos_afiliadas a on a.usuaria_id=p.id
    where p.id=new.usuaria_id and p.rol<>'admin' and p.estado='activa' and a.habilitada
  ) then
    raise exception using errcode='22023',message='Primero habilitá Afiliadas para una alumna activa.';
  end if;
  new.actualizada_en:=statement_timestamp();
  new.actualizada_por:=auth.uid();
  return new;
end $function$;
revoke all on function private.proteger_permiso_producto_afiliadas() from public,anon,authenticated,service_role;
create trigger proteger_permiso_producto_afiliadas before insert or update on public.afiliadas_productos
  for each row execute function private.proteger_permiso_producto_afiliadas();

-- Complementa el trigger actual de recursos, que sigue controlando autoría,
-- identidad, versión y fechas. No cambia los recursos generales anteriores.
create function private.proteger_producto_recurso_afiliadas()
returns trigger language plpgsql security invoker set search_path='' as $function$
declare tipo_producto text;
begin
  if auth.uid() is null or not (select public.es_admin()) then
    raise exception using errcode='42501',message='Solo una administradora identificada puede asociar materiales.';
  end if;
  if tg_table_schema<>'public' or tg_table_name<>'recursos_afiliadas' or tg_op not in ('INSERT','UPDATE') then
    raise exception using errcode='42501',message='Operación de material no permitida.';
  end if;
  if new.producto_id is not null then
    select p.tipo into tipo_producto from public.productos p where p.id=new.producto_id for share;
    if not found or tipo_producto is distinct from 'fisico' then
      raise exception using errcode='22023',message='Asociá el material a un producto físico.';
    end if;
  end if;
  return new;
end $function$;
revoke all on function private.proteger_producto_recurso_afiliadas() from public,anon,authenticated,service_role;
create trigger proteger_producto_recurso_afiliadas before insert or update on public.recursos_afiliadas
  for each row execute function private.proteger_producto_recurso_afiliadas();

-- Mismo patrón de auditoría que seguimientos_socias_historial. La elevación
-- queda dentro de este trigger privado, sin RPC ni INSERT directo del cliente.
-- Solo se copian UUID, habilitación, versión, actor y fecha; no hay contactos.
create function private.auditar_permiso_producto_afiliadas()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null or not (select public.es_admin()) then
    raise exception using errcode='42501',message='El historial requiere una administradora identificada.';
  end if;
  if tg_table_schema<>'public' or tg_table_name<>'afiliadas_productos' or tg_op not in ('INSERT','UPDATE') then
    raise exception using errcode='42501',message='Origen de auditoría no permitido.';
  end if;
  insert into public.afiliadas_productos_historial(usuaria_id,producto_id,anterior,nuevo,administradora_id,creado_en)
  values(new.usuaria_id,new.producto_id,case when tg_op='UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),auth.uid(),statement_timestamp());
  return new;
end $function$;
revoke all on function private.auditar_permiso_producto_afiliadas() from public,anon,authenticated,service_role;
create trigger auditar_permiso_producto_afiliadas after insert or update on public.afiliadas_productos
  for each row execute function private.auditar_permiso_producto_afiliadas();

alter table public.afiliadas_productos enable row level security;
alter table public.afiliadas_productos_historial enable row level security;
revoke all on public.afiliadas_productos,public.afiliadas_productos_historial from public,anon,authenticated,service_role;
grant select,insert,update on public.afiliadas_productos to authenticated,service_role;
grant select on public.afiliadas_productos_historial to authenticated;

-- Sin consulta a productos aquí: evita recursión producto → permiso → producto.
create policy afiliadas_productos_lectura on public.afiliadas_productos for select to authenticated
  using (usuaria_id=(select auth.uid()) or (select public.es_admin()));
create policy afiliadas_productos_creacion_admin on public.afiliadas_productos for insert to authenticated
  with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy afiliadas_productos_edicion_admin on public.afiliadas_productos for update to authenticated
  using ((select public.es_admin())) with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy afiliadas_productos_historial_admin on public.afiliadas_productos_historial for select to authenticated
  using ((select public.es_admin()));

-- Conservar las permisivas legadas. La restricción de lectura nueva limita
-- la visibilidad y las otras tres mantienen toda escritura para administración.
drop policy "Modulos Socias en preparacion" on public.productos;
create policy productos_afiliadas_lectura_restringida on public.productos as restrictive for select to anon,authenticated
  using ((select public.es_admin()) or (
    tipo='fisico' and activo is true and estado_afiliadas='publicado' and exists(
      select 1 from public.afiliadas_productos ap
      join public.accesos_afiliadas a on a.usuaria_id=ap.usuaria_id
      join public.perfiles p on p.id=ap.usuaria_id
      where ap.producto_id=productos.id and ap.usuaria_id=(select auth.uid())
        and ap.habilitada and a.habilitada and p.estado='activa' and p.rol<>'admin'
    )
  ));
create policy productos_afiliadas_creacion_admin on public.productos as restrictive for insert to anon,authenticated
  with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy productos_afiliadas_edicion_admin on public.productos as restrictive for update to anon,authenticated
  using ((select public.es_admin())) with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy productos_afiliadas_borrado_admin on public.productos as restrictive for delete to anon,authenticated
  using ((select auth.uid()) is not null and (select public.es_admin()));

-- El producto se consulta con su RLS propia: la afiliada debe tener también
-- habilitación específica. Un material publicado no vuelve público su producto.
alter policy recursos_afiliadas_lectura_alumna on public.recursos_afiliadas
  using (estado='publicado' and exists(
    select 1 from public.accesos_afiliadas a join public.perfiles p on p.id=a.usuaria_id
    where a.usuaria_id=(select auth.uid()) and a.habilitada and p.estado='activa'
  ) and (producto_id is null or exists(
    select 1 from public.productos p where p.id=recursos_afiliadas.producto_id
      and p.tipo='fisico' and p.activo is true and p.estado_afiliadas='publicado'
  )));
