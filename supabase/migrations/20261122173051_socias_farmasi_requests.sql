-- A request is deliberately NOT an entitlement.
create table public.solicitudes_socias_farmasi (
  usuaria_id uuid primary key references public.perfiles(id) on delete cascade,
  solicitada_at timestamptz not null default now()
);
alter table public.solicitudes_socias_farmasi enable row level security;
revoke all on public.solicitudes_socias_farmasi from public, anon, authenticated, service_role;
grant select on public.solicitudes_socias_farmasi to authenticated;
grant insert, select on public.solicitudes_socias_farmasi to service_role;
create policy "La alumna ve su solicitud y el equipo revisa todas"
  on public.solicitudes_socias_farmasi for select to authenticated
  using (usuaria_id = (select auth.uid()) or (select public.es_admin()));
create index solicitudes_socias_farmasi_fecha_idx
  on public.solicitudes_socias_farmasi (solicitada_at, usuaria_id);

-- Accessible only to the server route, after auth.getUser() and email verification.
-- Lock the same profile row as approval so that simultaneous actions cannot leave
-- an already approved account with a pending request.
create function public.solicitar_socias_farmasi(p_usuaria_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cuenta record;
begin
  select estado, rol, socias_farmaci_habilitada into cuenta
    from public.perfiles where id = p_usuaria_id for update;
  if not found or cuenta.estado is distinct from 'activa' or cuenta.rol = 'admin' then
    return 'no_elegible';
  end if;
  if cuenta.socias_farmaci_habilitada then return 'habilitada'; end if;
  insert into public.solicitudes_socias_farmasi (usuaria_id)
    values (p_usuaria_id) on conflict (usuaria_id) do nothing;
  return 'pendiente';
end;
$$;
revoke all on function public.solicitar_socias_farmasi(uuid) from public, anon, authenticated, service_role;
grant execute on function public.solicitar_socias_farmasi(uuid) to service_role;

-- The existing protected grant remains the only way to approve. A private,
-- non-callable trigger discards the request at the moment the grant commits.
create function private.cerrar_solicitud_socias_farmasi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.solicitudes_socias_farmasi where usuaria_id = new.id;
  return new;
end;
$$;
revoke all on function private.cerrar_solicitud_socias_farmasi() from public, anon, authenticated, service_role;
create trigger cerrar_solicitud_socias_farmasi
  after update of socias_farmaci_habilitada on public.perfiles for each row
  when (new.socias_farmaci_habilitada and not old.socias_farmaci_habilitada)
  execute function private.cerrar_solicitud_socias_farmasi();
