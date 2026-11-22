-- Permiso complementario: no cambia planes ni modifica los avances guardados.
begin;
create schema if not exists private;
alter table public.perfiles
  add column socias_farmaci_habilitada boolean not null default false,
  add column socias_farmaci_habilitada_at timestamptz,
  add column socias_farmaci_habilitada_por uuid,
  add constraint perfiles_farmaci_auditoria_check check (
    (socias_farmaci_habilitada_at is null) = (socias_farmaci_habilitada_por is null)
    and (not socias_farmaci_habilitada or socias_farmaci_habilitada_at is not null)
  );
alter table public.clases
  add column solo_farmaci boolean not null default false,
  add constraint clases_farmaci_fuente_check check (
    not solo_farmaci or (
      acceso_gratuito is false and vimeo_url is null and (not activo or video_key is not null)
    )
  );

-- También protege el alta: una alumna no puede autoasignarse el permiso.
create function private.proteger_acceso_farmaci()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not new.socias_farmaci_habilitada
       and new.socias_farmaci_habilitada_at is null
       and new.socias_farmaci_habilitada_por is null then return new; end if;
  else
    if new.socias_farmaci_habilitada is not distinct from old.socias_farmaci_habilitada
       and new.socias_farmaci_habilitada_at is not distinct from old.socias_farmaci_habilitada_at
       and new.socias_farmaci_habilitada_por is not distinct from old.socias_farmaci_habilitada_por then
      return new;
    end if;
  end if;
  if (select auth.role()) = 'service_role' then return new; end if;
  if (select public.es_admin()) and new.socias_farmaci_habilitada_por = (select auth.uid()) then return new; end if;
  raise exception 'Solo administración puede modificar el acceso Socias Farmaci' using errcode = '42501';
end;
$$;
revoke all on function private.proteger_acceso_farmaci() from public, anon, authenticated;
create trigger proteger_acceso_farmaci_perfiles
  before insert or update on public.perfiles for each row execute function private.proteger_acceso_farmaci();

-- Las políticas existentes siguen vigentes para las clases ordinarias.
-- La restricción se combina con todas las políticas permissive existentes.
create policy "Separar clases Socias Farmaci"
  on public.clases as restrictive for select to authenticated
  using (
    not solo_farmaci or (select public.es_admin()) or (activo and
      exists (select 1 from public.perfiles p where p.id = (select auth.uid())
        and p.estado = 'activa' and p.socias_farmaci_habilitada))
  );
create policy "Farmaci habilitada ve clases exclusivas"
  on public.clases for select to authenticated
  using (solo_farmaci and activo and
    exists (select 1 from public.perfiles p where p.id = (select auth.uid())
      and p.estado = 'activa' and p.socias_farmaci_habilitada));
create policy "Anónimo no ve clases Socias Farmaci"
  on public.clases as restrictive for select to anon
  using (not solo_farmaci);

-- La RLS anterior conserva propiedad y administración; al revocar, los avances
-- no se eliminan, pero no revelan el ID de una clase inaccesible.
create policy "Progreso solo de clases visibles"
  on public.progreso_clases as restrictive for select to authenticated
  using ((select public.es_admin()) or
    exists (select 1 from public.clases c where c.id = progreso_clases.clase_id));

-- El acceso se verifica de nuevo en el servidor de base de datos.
create or replace function public.guardar_progreso_clase(
  p_alumna uuid, p_clase uuid, p_action text,
  p_posicion integer default null, p_duracion integer default null,
  p_completada boolean default null
) returns setof public.progreso_clases
language plpgsql security invoker set search_path = '' as $$
declare revision text;
begin
  select md5(coalesce(c.video_key,c.vimeo_url,'')) into revision
  from public.clases c join public.perfiles p on p.id=p_alumna
  where c.id=p_clase and c.activo and p.rol <> 'admin'
    and (c.video_key is not null or c.vimeo_url is not null)
    and (case when c.solo_farmaci then
      p.estado = 'activa' and p.socias_farmaci_habilitada
    else
      c.acceso_gratuito or (p.estado = 'activa' and
        (p.desafio_socias_habilitada or p.tipo_usuario = 'socia'))
    end)
  for share of p, c;
  if revision is null then raise exception 'Clase no disponible' using errcode='42501'; end if;
  if p_action='posicion' and p_posicion is not null and p_duracion between 1 and 172800 and p_posicion between 0 and p_duracion then
    return query insert into public.progreso_clases as pc
      (alumna_id,clase_id,video_revision,posicion_seg,duracion_seg)
      values(p_alumna,p_clase,revision,p_posicion,p_duracion)
      on conflict(alumna_id,clase_id) do update set
        posicion_seg=excluded.posicion_seg, duracion_seg=excluded.duracion_seg,
        completada=case when pc.video_revision=revision then pc.completada else false end,
        completado_en=case when pc.video_revision=revision then pc.completado_en else null end,
        video_revision=revision, actualizado_en=now()
      returning pc.*;
  elsif p_action='completada' and p_completada is not null then
    return query insert into public.progreso_clases as pc
      (alumna_id,clase_id,video_revision,completada,completado_en)
      values(p_alumna,p_clase,revision,p_completada,case when p_completada then now() else null end)
      on conflict(alumna_id,clase_id) do update set
        completada=excluded.completada, completado_en=excluded.completado_en,
        posicion_seg=case when pc.video_revision=revision then pc.posicion_seg else 0 end,
        duracion_seg=case when pc.video_revision=revision then pc.duracion_seg else 0 end,
        video_revision=revision, actualizado_en=now()
      returning pc.*;
  else raise exception 'Progreso inválido' using errcode='22023'; end if;
end;
$$;
revoke all on function public.guardar_progreso_clase(uuid,uuid,text,integer,integer,boolean) from public, anon, authenticated;
grant execute on function public.guardar_progreso_clase(uuid,uuid,text,integer,integer,boolean) to service_role;

commit;
