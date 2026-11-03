-- Acceso explícito a Afiliadas y seguimiento operativo de Socias.
-- No migra roles heredados, no otorga accesos, no crea cobros ni cambia perfiles.
-- Los cobros son anotaciones administrativas: no representan una integración
-- con Mercado Pago ni renuevan o suspenden automáticamente una membresía.
create schema if not exists private;

create table public.accesos_afiliadas (
  usuaria_id uuid primary key references public.perfiles(id),
  habilitada boolean not null default false,
  version integer not null default 1 check (version between 1 and 1000000000),
  actualizada_en timestamptz not null default now()
);

create table public.recursos_afiliadas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo))>0 and char_length(titulo)<=140
    and titulo !~ '[[:cntrl:]]'),
  cuerpo text not null default '' check (char_length(cuerpo)<=12000
    and translate(cuerpo,E'\n\t','') !~ '[[:cntrl:]]'),
  tipo text not null check (tipo in ('aviso','copy','video','archivo','enlace')),
  campana text check (campana is null or (char_length(btrim(campana))>0 and char_length(campana)<=120
    and campana !~ '[[:cntrl:]]')),
  url text check (url is null or (
    char_length(url)<=2000
    and url ~ '^https://[^/@[:space:][:cntrl:]]+([/?#]|$)'
    and url !~ '[[:space:][:cntrl:]]'
    and url !~ '^https://[^/]*@'
  )),
  estado text not null default 'borrador' check (estado in ('borrador','publicado','archivado')),
  destacado boolean not null default false,
  version integer not null default 1 check (version between 1 and 1000000000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint recursos_afiliadas_contenido check (
    (tipo in ('aviso','copy') and char_length(btrim(cuerpo))>0)
    or (tipo in ('video','archivo','enlace') and url is not null)
  )
);
create index recursos_afiliadas_publicados_idx
  on public.recursos_afiliadas(destacado desc,creado_en desc,id)
  where estado='publicado';

create table public.acompanamientos_socias (
  usuaria_id uuid primary key references public.perfiles(id),
  inicio date not null check (inicio between date '2000-01-01' and date '2099-12-31'),
  fin date not null,
  version integer not null default 1 check (version between 1 and 1000000000),
  actualizado_en timestamptz not null default now(),
  constraint acompanamientos_socias_seis_meses check (fin=(inicio+interval '6 months')::date)
);
comment on column public.acompanamientos_socias.fin is
  'Fin exclusivo: seis meses calendario desde inicio; no modifica el acceso de la socia.';
create index acompanamientos_socias_fin_idx on public.acompanamientos_socias(fin,usuaria_id);

create table public.cobros_socias (
  id uuid primary key default gen_random_uuid(),
  socia_id uuid not null references public.perfiles(id),
  concepto text not null check (char_length(btrim(concepto)) between 1 and 160),
  vencimiento date not null check (vencimiento between date '2000-01-01' and date '2099-12-31'),
  monto numeric check (monto is null or (monto>0 and monto<=1000000000 and monto=round(monto,2))),
  moneda text check (moneda in ('ARS','USD')),
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','anulado')),
  pagado_en date check (pagado_en between date '2000-01-01' and date '2099-12-31'),
  nota text check (nota is null or char_length(nota)<=1200),
  version integer not null default 1 check (version between 1 and 1000000000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cobros_socias_monto_moneda check ((monto is null)=(moneda is null)),
  constraint cobros_socias_fecha_pago check ((estado='pagado')=(pagado_en is not null))
);
create index cobros_socias_socia_idx on public.cobros_socias(socia_id,vencimiento,id);
create index cobros_socias_pendientes_idx on public.cobros_socias(vencimiento,socia_id)
  where estado='pendiente';

create table public.seguimientos_socias_historial (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null references public.perfiles(id),
  entidad text not null check (entidad in ('acompanamiento','cobro')),
  registro_id uuid not null,
  anterior jsonb,
  nuevo jsonb not null,
  -- Conserva la identidad que hizo el cambio aunque luego deje de ser admin.
  administradora_id uuid not null,
  creado_en timestamptz not null default now()
);
create index seguimientos_socias_historial_usuaria_idx
  on public.seguimientos_socias_historial(usuaria_id,creado_en desc,id);

-- Las mismas comprobaciones se aplican a llamadas autenticadas y service_role:
-- ningún proceso sin una administradora identificada puede escribir estos datos.
create function private.proteger_afiliadas_y_seguimiento()
returns trigger language plpgsql security invoker set search_path='' as $function$
declare
  perfil public.perfiles%rowtype;
  hoy date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
  momento timestamptz := statement_timestamp();
  destino uuid;
begin
  if auth.uid() is null or not (select public.es_admin()) then
    raise exception using errcode='42501',message='Solo una administradora identificada puede hacer este cambio.';
  end if;
  if tg_table_schema<>'public' or tg_table_name not in
      ('accesos_afiliadas','recursos_afiliadas','acompanamientos_socias','cobros_socias')
    or tg_op not in ('INSERT','UPDATE') then
    raise exception using errcode='42501',message='Operación no permitida.';
  end if;

  if tg_op='INSERT' then
    if new.version is distinct from 1 then
      raise exception using errcode='22023',message='La versión inicial debe ser 1.';
    end if;
  else
    if new.version is distinct from old.version or old.version>=1000000000 then
      raise exception using errcode='22023',message='La versión la controla la plataforma.';
    end if;
    new.version:=old.version+1;
  end if;

  if tg_table_name='accesos_afiliadas' then
    if tg_op='UPDATE' and new.usuaria_id is distinct from old.usuaria_id then
      raise exception using errcode='42501',message='La usuaria del acceso no se puede cambiar.';
    end if;
    if new.habilitada then
      select * into perfil from public.perfiles where id=new.usuaria_id;
      if not found or perfil.rol='admin' or perfil.estado is distinct from 'activa' then
        raise exception using errcode='22023',message='Habilitá Afiliadas solo para una alumna activa.';
      end if;
    end if;
    new.actualizada_en:=momento;
  elsif tg_table_name='recursos_afiliadas' then
    if tg_op='INSERT' then
      new.creado_en:=momento;
    elsif new.id is distinct from old.id or new.creado_en is distinct from old.creado_en then
      raise exception using errcode='42501',message='La identidad y creación del recurso no se pueden cambiar.';
    end if;
    new.actualizado_en:=momento;
  else
    if tg_table_name='acompanamientos_socias' then
      destino:=new.usuaria_id;
      if tg_op='UPDATE' and new.usuaria_id is distinct from old.usuaria_id then
        raise exception using errcode='42501',message='La socia del acompañamiento no se puede cambiar.';
      end if;
    else
      destino:=new.socia_id;
      if tg_op='INSERT' then
        new.creado_en:=momento;
      elsif new.id is distinct from old.id or new.socia_id is distinct from old.socia_id
        or new.creado_en is distinct from old.creado_en then
        raise exception using errcode='42501',message='La identidad, socia y creación del cobro no se pueden cambiar.';
      end if;
    end if;
    select * into perfil from public.perfiles where id=destino;
    if not found or perfil.rol='admin' or perfil.tipo_usuario is distinct from 'socia' then
      raise exception using errcode='22023',message='El seguimiento corresponde únicamente a una cuenta Socias.';
    end if;
    if tg_table_name='acompanamientos_socias' then
      if perfil.created_at is null or new.inicio>hoy
        or new.inicio<(perfil.created_at at time zone 'America/Argentina/Cordoba')::date then
        raise exception using errcode='22023',message='El inicio debe estar entre el alta de la cuenta y hoy en Argentina.';
      end if;
      new.fin:=(new.inicio+interval '6 months')::date;
    elsif new.pagado_en>hoy then
      raise exception using errcode='22023',message='La fecha de pago no puede estar en el futuro.';
    end if;
    new.actualizado_en:=momento;
  end if;
  return new;
end $function$;
revoke all on function private.proteger_afiliadas_y_seguimiento() from public,anon,authenticated,service_role;

create trigger proteger_accesos_afiliadas before insert or update on public.accesos_afiliadas
  for each row execute function private.proteger_afiliadas_y_seguimiento();
create trigger proteger_recursos_afiliadas before insert or update on public.recursos_afiliadas
  for each row execute function private.proteger_afiliadas_y_seguimiento();
create trigger proteger_acompanamientos_socias before insert or update on public.acompanamientos_socias
  for each row execute function private.proteger_afiliadas_y_seguimiento();
create trigger proteger_cobros_socias before insert or update on public.cobros_socias
  for each row execute function private.proteger_afiliadas_y_seguimiento();

-- El historial no ofrece INSERT al cliente. Esta función privada solo puede
-- ejecutarse por los dos triggers auditados, comprueba nuevamente la identidad
-- y evita dar a la aplicación un RPC o permiso para falsificar auditorías.
create function private.auditar_seguimientos_socias()
returns trigger language plpgsql security definer set search_path='' as $function$
declare
  destino uuid;
  registro uuid;
  nombre_entidad text;
begin
  if auth.uid() is null or not (select public.es_admin()) then
    raise exception using errcode='42501',message='El historial requiere una administradora identificada.';
  end if;
  if tg_table_schema<>'public' or tg_table_name not in ('acompanamientos_socias','cobros_socias')
    or tg_op not in ('INSERT','UPDATE') then
    raise exception using errcode='42501',message='Origen de auditoría no permitido.';
  end if;
  if tg_table_name='acompanamientos_socias' then
    destino:=new.usuaria_id; registro:=new.usuaria_id; nombre_entidad:='acompanamiento';
  else
    destino:=new.socia_id; registro:=new.id; nombre_entidad:='cobro';
  end if;
  insert into public.seguimientos_socias_historial
    (usuaria_id,entidad,registro_id,anterior,nuevo,administradora_id,creado_en)
  values (destino,nombre_entidad,registro,
    case when tg_op='UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),auth.uid(),statement_timestamp());
  return new;
end $function$;
revoke all on function private.auditar_seguimientos_socias() from public,anon,authenticated,service_role;
create trigger auditar_acompanamientos_socias after insert or update on public.acompanamientos_socias
  for each row execute function private.auditar_seguimientos_socias();
create trigger auditar_cobros_socias after insert or update on public.cobros_socias
  for each row execute function private.auditar_seguimientos_socias();

alter table public.accesos_afiliadas enable row level security;
alter table public.recursos_afiliadas enable row level security;
alter table public.acompanamientos_socias enable row level security;
alter table public.cobros_socias enable row level security;
alter table public.seguimientos_socias_historial enable row level security;

revoke all on public.accesos_afiliadas,public.recursos_afiliadas,
  public.acompanamientos_socias,public.cobros_socias,public.seguimientos_socias_historial
  from public,anon,authenticated,service_role;
grant select,insert,update on public.accesos_afiliadas,public.recursos_afiliadas,
  public.acompanamientos_socias,public.cobros_socias to authenticated,service_role;
grant select on public.seguimientos_socias_historial to authenticated;

create policy accesos_afiliadas_lectura on public.accesos_afiliadas for select to authenticated
  using ((select auth.uid())=usuaria_id or (select public.es_admin()));
create policy accesos_afiliadas_creacion_admin on public.accesos_afiliadas for insert to authenticated
  with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy accesos_afiliadas_edicion_admin on public.accesos_afiliadas for update to authenticated
  using ((select public.es_admin())) with check ((select auth.uid()) is not null and (select public.es_admin()));

create policy recursos_afiliadas_lectura_admin on public.recursos_afiliadas for select to authenticated
  using ((select public.es_admin()));
create policy recursos_afiliadas_lectura_alumna on public.recursos_afiliadas for select to authenticated
  using (estado='publicado' and exists (
    select 1 from public.accesos_afiliadas a join public.perfiles p on p.id=a.usuaria_id
    where a.usuaria_id=(select auth.uid()) and a.habilitada and p.estado='activa'
  ));
create policy recursos_afiliadas_creacion_admin on public.recursos_afiliadas for insert to authenticated
  with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy recursos_afiliadas_edicion_admin on public.recursos_afiliadas for update to authenticated
  using ((select public.es_admin())) with check ((select auth.uid()) is not null and (select public.es_admin()));

create policy acompanamientos_socias_lectura_admin on public.acompanamientos_socias for select to authenticated
  using ((select public.es_admin()));
create policy acompanamientos_socias_creacion_admin on public.acompanamientos_socias for insert to authenticated
  with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy acompanamientos_socias_edicion_admin on public.acompanamientos_socias for update to authenticated
  using ((select public.es_admin())) with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy cobros_socias_lectura_admin on public.cobros_socias for select to authenticated
  using ((select public.es_admin()));
create policy cobros_socias_creacion_admin on public.cobros_socias for insert to authenticated
  with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy cobros_socias_edicion_admin on public.cobros_socias for update to authenticated
  using ((select public.es_admin())) with check ((select auth.uid()) is not null and (select public.es_admin()));
create policy seguimientos_socias_historial_lectura_admin on public.seguimientos_socias_historial for select to authenticated
  using ((select public.es_admin()));
