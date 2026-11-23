-- Admin-only removal of empty Farmasi organizational metadata.
-- No data is changed during migration; class FK and visibility stay untouched.
grant delete on public.farmasi_submodulos to service_role;

create or replace function public.gestionar_farmasi_submodulos(
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
  elsif p_accion = 'eliminar' and p_nombre is null and p_id is not null and p_direccion is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public.farmasi_submodulos', 0));
    -- The existing ON DELETE RESTRICT FK is the atomic empty guard, including
    -- classes assigned by a concurrent request. Never update or delete a class.
    delete from public.farmasi_submodulos where id = p_id;
    if not found then
      raise exception 'Submódulo no encontrado' using errcode = 'P0002';
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
