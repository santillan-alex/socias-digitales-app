-- Organizational metadata. This migration changes no class audience or grants.
create table public.farmasi_submodulos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden integer not null,
  constraint farmasi_submodulos_nombre_valido check (
    char_length(nombre) between 1 and 75 and nombre = btrim(nombre)
    and nombre !~ '[[:cntrl:]]'
  ),
  constraint farmasi_submodulos_orden_valido check (orden >= 0),
  constraint farmasi_submodulos_orden_unico unique (orden) deferrable initially immediate
);

create unique index farmasi_submodulos_nombre_unico
  on public.farmasi_submodulos (lower(nombre));

-- Group configuration is never directly exposed to the student client. Both
-- admin and eligible student projections run server-side and check permissions.
alter table public.farmasi_submodulos enable row level security;
revoke all on public.farmasi_submodulos from public, anon, authenticated, service_role;
grant select, insert, update on public.farmasi_submodulos to service_role;

alter table public.clases
  add column farmasi_submodulo_id uuid references public.farmasi_submodulos(id) on delete restrict,
  add constraint clases_submodulo_exige_farmasi check (farmasi_submodulo_id is null or solo_farmaci is true);
create index clases_farmasi_submodulo_idx on public.clases(farmasi_submodulo_id)
  where farmasi_submodulo_id is not null;

-- The app checks the signed-in admin and same origin before calling this
-- service-only invoker. Serialize order changes and return one coherent list.
create function public.gestionar_farmasi_submodulos(
  p_accion text, p_nombre text, p_id uuid, p_direccion text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text;
  v_actual integer;
  v_vecino integer;
begin
  if p_accion = 'crear' and p_id is null and p_direccion is null then
    v_nombre := regexp_replace(btrim(p_nombre), '[[:space:]]+', ' ', 'g');
    if v_nombre is null or char_length(v_nombre) not between 1 and 75 or p_nombre ~ '[[:cntrl:]]' then
      raise exception 'Nombre inválido' using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public.farmasi_submodulos', 0));
    if (select count(*) from public.farmasi_submodulos) >= 200 then
      raise exception 'Límite de submódulos' using errcode = '54000';
    end if;
    insert into public.farmasi_submodulos (nombre, orden)
      select v_nombre, coalesce(max(orden) + 1, 0) from public.farmasi_submodulos;
  elsif p_accion = 'mover' and p_nombre is null and p_id is not null and p_direccion in ('arriba', 'abajo') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public.farmasi_submodulos', 0));
    select orden into v_actual from public.farmasi_submodulos where id = p_id;
    if not found then
      raise exception 'Submódulo no encontrado' using errcode = 'P0002';
    end if;
    if p_direccion = 'arriba' then
      select max(orden) into v_vecino from public.farmasi_submodulos where orden < v_actual;
    else
      select min(orden) into v_vecino from public.farmasi_submodulos where orden > v_actual;
    end if;
    if v_vecino is not null then
      update public.farmasi_submodulos
        set orden = case when orden = v_actual then v_vecino else v_actual end
        where orden in (v_actual, v_vecino);
    end if;
  else
    raise exception 'Acción inválida' using errcode = '22023';
  end if;

  return coalesce((select jsonb_agg(
    jsonb_build_object('id', id, 'nombre', nombre, 'orden', orden) order by orden
  ) from public.farmasi_submodulos), '[]'::jsonb);
end;
$$;
revoke all on function public.gestionar_farmasi_submodulos(text, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.gestionar_farmasi_submodulos(text, text, uuid, text)
  to service_role;
