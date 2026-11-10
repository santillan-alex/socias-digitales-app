-- Ejecutar completa después de la migración, con un rol de mantenimiento
-- capaz de SET LOCAL ROLE. Solo usa el espacio ficticio reservado; no crea
-- usuarios por red, no envía mensajes y termina siempre en ROLLBACK.
-- Ante una excepción, hacer ROLLBACK; nunca confirmar estas filas.
begin;
set local statement_timeout='30s';
set local request.jwt.claims='{"role":"service_role"}';

do $qa$
declare tabla text;
begin
  if exists(select 1 from auth.users where id::text like '14000000-0000-4000-8000-%'
      or email like 'qa-productos-afiliadas-%@example.invalid')
    or exists(select 1 from public.perfiles where id::text like '14000000-0000-4000-8000-%')
    or exists(select 1 from public.productos where id::text like '24000000-0000-4000-8000-%')
    or exists(select 1 from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')
  then raise exception 'QA: espacio reservado ocupado; no se tocaron filas existentes.'; end if;
  if exists(select 1 from pg_catalog.pg_policies
      where schemaname='public' and tablename='productos' and policyname='Modulos Socias en preparacion')
    or (select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename='productos'
      and policyname in ('productos_afiliadas_lectura_restringida','productos_afiliadas_creacion_admin',
        'productos_afiliadas_edicion_admin','productos_afiliadas_borrado_admin') and permissive='RESTRICTIVE')<>4
  then raise exception 'QA: faltan las cuatro restricciones específicas de Productos.'; end if;
  if (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('productos','recursos_afiliadas','afiliadas_productos',
        'afiliadas_productos_historial') and c.relrowsecurity)<>4
  then raise exception 'QA: falta RLS.'; end if;
  foreach tabla in array array['afiliadas_productos','afiliadas_productos_historial'] loop
    if has_table_privilege('anon','public.'||tabla,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('authenticated','public.'||tabla,'DELETE,TRUNCATE')
      or has_table_privilege('service_role','public.'||tabla,'DELETE,TRUNCATE')
    then raise exception 'QA: privilegios excesivos en %.',tabla; end if;
  end loop;
  if has_table_privilege('authenticated','public.afiliadas_productos_historial','INSERT,UPDATE')
    or has_table_privilege('service_role','public.afiliadas_productos_historial','INSERT,UPDATE')
    or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in ('proteger_producto_afiliadas',
        'proteger_permiso_producto_afiliadas','proteger_producto_recurso_afiliadas','auditar_permiso_producto_afiliadas')
      and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('service_role',p.oid,'EXECUTE')))
  then raise exception 'QA: cliente puede falsificar auditoría o invocar triggers.'; end if;
  if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in ('proteger_producto_afiliadas',
        'proteger_permiso_producto_afiliadas','proteger_producto_recurso_afiliadas') and p.prosecdef)
    or not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname='auditar_permiso_producto_afiliadas' and p.prosecdef
        and p.proconfig @> array['search_path=""'])
  then raise exception 'QA: elevación/search_path de triggers no válidos.'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='productos'
      and column_name in ('precio','comision_pct') and is_nullable<>'YES')
    or exists(select 1 from information_schema.columns where table_schema='public' and table_name='productos'
      and column_name='comision_pct' and column_default is not null)
  then raise exception 'QA: ficha sin condiciones comerciales fuerza importes heredados.'; end if;
end $qa$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('14000000-0000-4000-8000-000000000001','qa-productos-afiliadas-admin@example.invalid','{"nombre":"QA Admin Productos"}'),
 ('14000000-0000-4000-8000-000000000002','qa-productos-afiliadas-a@example.invalid','{"nombre":"QA Afiliada A"}'),
 ('14000000-0000-4000-8000-000000000003','qa-productos-afiliadas-b@example.invalid','{"nombre":"QA Afiliada B"}'),
 ('14000000-0000-4000-8000-000000000004','qa-productos-afiliadas-sin-grant@example.invalid','{"nombre":"QA Sin grant","rol":"afiliada"}'),
 ('14000000-0000-4000-8000-000000000005','qa-productos-afiliadas-pausada@example.invalid','{"nombre":"QA Pausada"}');
update public.perfiles set estado='activa' where id::text like '14000000-0000-4000-8000-%';
update public.perfiles set rol='admin' where id='14000000-0000-4000-8000-000000000001';
update public.perfiles set rol='afiliada' where id='14000000-0000-4000-8000-000000000004';

set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
insert into public.accesos_afiliadas(usuaria_id,habilitada) values
 ('14000000-0000-4000-8000-000000000002',true),
 ('14000000-0000-4000-8000-000000000003',true),
 ('14000000-0000-4000-8000-000000000005',true);
insert into public.productos(id,nombre,tipo,precio,comision_pct,activo,estado_afiliadas,created_at,actualizado_en) values
 ('24000000-0000-4000-8000-000000000001','QA Producto A','fisico',null,null,true,'publicado','2001-01-01','2001-01-01'),
 ('24000000-0000-4000-8000-000000000002','QA Producto B','fisico',24.50,12,true,'publicado','2001-01-01','2001-01-01'),
 ('24000000-0000-4000-8000-000000000003','QA Borrador','fisico',null,null,true,'borrador','2001-01-01','2001-01-01'),
 ('24000000-0000-4000-8000-000000000004','QA Inactivo','fisico',null,null,false,'publicado','2001-01-01','2001-01-01'),
 ('24000000-0000-4000-8000-000000000005','QA Digital','digital',5,10,true,'borrador','2001-01-01','2001-01-01');
insert into public.afiliadas_productos(usuaria_id,producto_id,habilitada,actualizada_en,actualizada_por) values
 ('14000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001',true,'2001-01-01','14000000-0000-4000-8000-000000000003'),
 ('14000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000002',true,'2001-01-01','14000000-0000-4000-8000-000000000003'),
 ('14000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000003',true,'2001-01-01','14000000-0000-4000-8000-000000000003'),
 ('14000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000004',true,'2001-01-01','14000000-0000-4000-8000-000000000003'),
 ('14000000-0000-4000-8000-000000000005','24000000-0000-4000-8000-000000000001',true,'2001-01-01','14000000-0000-4000-8000-000000000003');
insert into public.recursos_afiliadas(id,titulo,cuerpo,tipo,url,estado,producto_id) values
 ('44000000-0000-4000-8000-000000000001','QA General','Copy general','copy',null,'publicado',null),
 ('44000000-0000-4000-8000-000000000002','QA Material A','Copy A','copy',null,'publicado','24000000-0000-4000-8000-000000000001'),
 ('44000000-0000-4000-8000-000000000003','QA Archivo B','','archivo','https://example.invalid/qa-b.pdf','publicado','24000000-0000-4000-8000-000000000002'),
 ('44000000-0000-4000-8000-000000000004','QA Video borrador','','video','https://example.invalid/qa-a.mp4','borrador','24000000-0000-4000-8000-000000000001'),
 ('44000000-0000-4000-8000-000000000005','QA Material archivado','Copy anterior','copy',null,'archivado','24000000-0000-4000-8000-000000000001'),
 ('44000000-0000-4000-8000-000000000006','QA Material de borrador','Copy privado','copy',null,'publicado','24000000-0000-4000-8000-000000000003'),
 ('44000000-0000-4000-8000-000000000007','QA Material de inactivo','Copy retirado','copy',null,'publicado','24000000-0000-4000-8000-000000000004'),
 ('44000000-0000-4000-8000-000000000008','QA General borrador','Copy no publicado','copy',null,'borrador',null);

do $qa$
begin
  if (select count(*) from public.productos where id::text like '24000000-0000-4000-8000-%')<>5
    or (select count(*) from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')<>8
    or (select count(*) from public.afiliadas_productos where usuaria_id::text like '14000000-0000-4000-8000-%')<>5
  then raise exception 'QA: administración no ve el catálogo y sus permisos completos.'; end if;
  if exists(select 1 from public.productos where id::text like '24000000-0000-4000-8000-%'
      and (version<>1 or created_at<transaction_timestamp() or actualizado_en<transaction_timestamp()))
    or exists(select 1 from public.afiliadas_productos where usuaria_id::text like '14000000-0000-4000-8000-%'
      and (version<>1 or actualizada_por<>auth.uid() or actualizada_en<transaction_timestamp()))
    or not exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001'
      and precio is null and comision_pct is null)
  then raise exception 'QA: versiones, actor, fechas o importes desconocidos incorrectos.'; end if;
  if (select count(*) from public.afiliadas_productos_historial where usuaria_id::text like '14000000-0000-4000-8000-%')<>5
    or exists(select 1 from public.afiliadas_productos_historial where usuaria_id::text like '14000000-0000-4000-8000-%'
      and (anterior is not null or administradora_id<>auth.uid() or creado_en<transaction_timestamp()
        or (nuevo->>'version')::integer<>1 or nuevo ? 'email' or nuevo ? 'nombre'))
  then raise exception 'QA: historial inicial incorrecto.'; end if;
end $qa$;

-- Rechazos exactos; los cambios fallidos no deben dejar historial parcial.
do $qa$
declare caso record;
begin
  for caso in select * from (values
    ($sql$insert into public.afiliadas_productos(usuaria_id,producto_id,habilitada) values('14000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000001',true)$sql$,'22023','habilitar sin acceso general'),
    ($sql$insert into public.afiliadas_productos(usuaria_id,producto_id,habilitada) values(auth.uid(),'24000000-0000-4000-8000-000000000001',true)$sql$,'22023','habilitar administradora'),
    ($sql$insert into public.afiliadas_productos(usuaria_id,producto_id) values('14000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000005')$sql$,'22023','permiso a digital'),
    ($sql$insert into public.afiliadas_productos(usuaria_id,producto_id,version) values('14000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000001',2)$sql$,'22023','versión inicial del permiso'),
    ($sql$update public.afiliadas_productos set usuaria_id='14000000-0000-4000-8000-000000000004' where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001'$sql$,'42501','mover permiso a otra usuaria'),
    ($sql$update public.afiliadas_productos set producto_id='24000000-0000-4000-8000-000000000002' where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001'$sql$,'42501','mover permiso a otro producto'),
    ($sql$update public.afiliadas_productos set version=2 where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001'$sql$,'22023','manipular versión de permiso'),
    ($sql$update public.productos set id=gen_random_uuid() where id='24000000-0000-4000-8000-000000000001'$sql$,'42501','mover identidad de producto'),
    ($sql$update public.productos set created_at='2001-01-01' where id='24000000-0000-4000-8000-000000000001'$sql$,'42501','mover fecha de creación'),
    ($sql$update public.productos set version=2 where id='24000000-0000-4000-8000-000000000001'$sql$,'22023','manipular versión de producto'),
    ($sql$update public.productos set tipo='digital' where id='24000000-0000-4000-8000-000000000001'$sql$,'22023','convertir producto con vínculos'),
    ($sql$update public.productos set estado_afiliadas='publicado' where id='24000000-0000-4000-8000-000000000005'$sql$,'22023','publicar digital en Afiliadas'),
    ($sql$update public.productos set precio=-1 where id='24000000-0000-4000-8000-000000000001'$sql$,'22023','precio negativo'),
    ($sql$update public.productos set precio='NaN'::numeric where id='24000000-0000-4000-8000-000000000001'$sql$,'22023','precio NaN'),
    ($sql$update public.productos set comision_pct=101 where id='24000000-0000-4000-8000-000000000001'$sql$,'22023','comisión mayor a cien'),
    ($sql$update public.productos set comision_pct='NaN'::numeric where id='24000000-0000-4000-8000-000000000001'$sql$,'22023','comisión NaN'),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo,producto_id) values('QA','QA','copy','24000000-0000-4000-8000-000000000005')$sql$,'22023','material de digital'),
    ($sql$delete from public.afiliadas_productos where usuaria_id='14000000-0000-4000-8000-000000000002'$sql$,'42501','borrar permisos'),
    ($sql$insert into public.afiliadas_productos_historial(usuaria_id,producto_id,nuevo,administradora_id) values('14000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','{}',auth.uid())$sql$,'42501','falsificar historial'),
    ($sql$update public.afiliadas_productos_historial set nuevo='{}' where usuaria_id='14000000-0000-4000-8000-000000000002'$sql$,'42501','reescribir historial')
  ) as casos(sentencia,esperado,etiqueta) loop
    begin
      execute caso.sentencia;
      raise exception 'QA: se permitió %.',caso.etiqueta;
    exception when others then
      if sqlstate<>caso.esperado then raise exception 'QA: % esperaba %, recibió %: %',caso.etiqueta,caso.esperado,sqlstate,sqlerrm; end if;
    end;
  end loop;
end $qa$;

set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
declare cambiadas integer;
begin
  if (select count(*) from public.productos where id::text like '24000000-0000-4000-8000-%')<>1
    or not exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000002')
    or (select count(*) from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')<>2
    or not exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000001')
    or not exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
    or exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000003')
    or (select count(*) from public.afiliadas_productos where usuaria_id::text like '14000000-0000-4000-8000-%')<>3
    or exists(select 1 from public.afiliadas_productos_historial where usuaria_id::text like '14000000-0000-4000-8000-%')
  then raise exception 'QA: aislamiento de A falló.'; end if;
  update public.productos set nombre='NO' where id='24000000-0000-4000-8000-000000000001';
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 then raise exception 'QA: A editó un producto.'; end if;
  update public.afiliadas_productos set habilitada=false where usuaria_id=auth.uid();
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 then raise exception 'QA: A editó sus propios permisos.'; end if;
  update public.recursos_afiliadas set cuerpo='NO' where id='44000000-0000-4000-8000-000000000002';
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 then raise exception 'QA: A editó materiales.'; end if;
end $qa$;
do $qa$
declare caso record;
begin
  for caso in select * from (values
    ($sql$insert into public.productos(nombre,tipo,precio) values('NO','fisico',1)$sql$),
    ($sql$insert into public.afiliadas_productos(usuaria_id,producto_id,habilitada) values(auth.uid(),'24000000-0000-4000-8000-000000000002',true)$sql$),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo,producto_id) values('NO','NO','copy','24000000-0000-4000-8000-000000000001')$sql$),
    ($sql$delete from public.afiliadas_productos where usuaria_id=auth.uid()$sql$)
  ) as casos(sentencia) loop
    begin execute caso.sentencia; raise exception 'QA: escritura de alumna permitida.';
    exception when others then if sqlstate<>'42501' then raise exception 'QA: escritura alumna esperaba 42501, recibió %: %',sqlstate,sqlerrm; end if; end;
  end loop;
end $qa$;

set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000003"}';
do $qa$
begin
  if (select count(*) from public.productos where id::text like '24000000-0000-4000-8000-%')<>1
    or not exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000002')
    or (select count(*) from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')<>2
    or not exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000003')
    or exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
  then raise exception 'QA: aislamiento de B falló.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000004"}';
do $qa$
begin
  if exists(select 1 from public.productos where id::text like '24000000-0000-4000-8000-%')
    or exists(select 1 from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')
  then raise exception 'QA: el rol heredado sustituyó el acceso explícito.'; end if;
end $qa$;

-- CAS y auditoría: un PATCH obsoleto cambia cero filas y no crea eventos.
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
do $qa$
declare cambiadas integer;
begin
  update public.afiliadas_productos set habilitada=false,actualizada_en='2001-01-01',actualizada_por='14000000-0000-4000-8000-000000000003'
    where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001' and version=1;
  get diagnostics cambiadas=row_count;
  if cambiadas<>1 then raise exception 'QA: primera revocación CAS falló.'; end if;
  update public.afiliadas_productos set habilitada=true
    where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001' and version=1;
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 or not exists(select 1 from public.afiliadas_productos
      where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001'
        and not habilitada and version=2 and actualizada_por=auth.uid() and actualizada_en>=transaction_timestamp())
    or (select count(*) from public.afiliadas_productos_historial
      where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001')<>2
    or not exists(select 1 from public.afiliadas_productos_historial
      where usuaria_id='14000000-0000-4000-8000-000000000002' and producto_id='24000000-0000-4000-8000-000000000001'
        and anterior->>'habilitada'='true' and nuevo->>'habilitada'='false' and (nuevo->>'version')::integer=2 and administradora_id=auth.uid())
  then raise exception 'QA: CAS, identidad de actor o historial de revocación falló.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
    or not exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000001')
    or not exists(select 1 from public.afiliadas_productos where usuaria_id=auth.uid()
      and producto_id='24000000-0000-4000-8000-000000000001' and not habilitada and version=2)
  then raise exception 'QA: revocación específica borró historial o permitió material privado.'; end if;
end $qa$;

set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.afiliadas_productos set habilitada=true where usuaria_id='14000000-0000-4000-8000-000000000002'
  and producto_id='24000000-0000-4000-8000-000000000001' and version=2;
update public.productos set estado_afiliadas='borrador' where id='24000000-0000-4000-8000-000000000001' and version=1;
do $qa$
declare cambiadas integer;
begin
  update public.productos set nombre='EDICION OBSOLETA' where id='24000000-0000-4000-8000-000000000001' and version=1;
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 or not exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001' and version=2 and estado_afiliadas='borrador')
  then raise exception 'QA: CAS de producto falló.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
  then raise exception 'QA: borrador permitió producto o material.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.productos set estado_afiliadas='publicado',activo=false where id='24000000-0000-4000-8000-000000000001' and version=2;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
  then raise exception 'QA: producto inactivo permitió material.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.productos set estado_afiliadas='archivado',activo=true where id='24000000-0000-4000-8000-000000000001' and version=3;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.productos where id='24000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
  then raise exception 'QA: archivo permitió producto o material.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.productos set estado_afiliadas='publicado' where id='24000000-0000-4000-8000-000000000001' and version=4;
update public.accesos_afiliadas set habilitada=false where usuaria_id='14000000-0000-4000-8000-000000000002' and version=1;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.productos where id::text like '24000000-0000-4000-8000-%')
    or exists(select 1 from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')
    or not exists(select 1 from public.afiliadas_productos where usuaria_id=auth.uid()
      and producto_id='24000000-0000-4000-8000-000000000001' and habilitada)
  then raise exception 'QA: retiro general no cerró acceso o borró asignación específica.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.accesos_afiliadas set habilitada=true where usuaria_id='14000000-0000-4000-8000-000000000002' and version=2;
update public.perfiles set estado='pausada' where id='14000000-0000-4000-8000-000000000005';
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000005"}';
do $qa$
begin
  if exists(select 1 from public.productos where id::text like '24000000-0000-4000-8000-%')
    or exists(select 1 from public.recursos_afiliadas where id::text like '44000000-0000-4000-8000-%')
  then raise exception 'QA: cuenta pausada conserva acceso efectivo.'; end if;
end $qa$;

-- Reasociar o archivar material conserva versión y aplica permisos nuevos.
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.recursos_afiliadas set producto_id='24000000-0000-4000-8000-000000000002'
  where id='44000000-0000-4000-8000-000000000002' and version=1;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
    or not exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000001')
  then raise exception 'QA: reasociar material mantuvo acceso del producto anterior.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000003"}';
do $qa$
begin
  if not exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002' and version=2)
  then raise exception 'QA: reasociación no aplica permiso del producto destino.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}';
update public.recursos_afiliadas set estado='archivado' where id='44000000-0000-4000-8000-000000000002' and version=2;
set local request.jwt.claims='{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000003"}';
do $qa$
begin
  if exists(select 1 from public.recursos_afiliadas where id='44000000-0000-4000-8000-000000000002')
  then raise exception 'QA: material archivado sigue visible.'; end if;
end $qa$;

reset role;
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
do $qa$
begin
  -- El plan de la RLS puede negar la consulta por falta de SELECT en los
  -- permisos privados. Tanto cero filas como 42501 son una denegación segura.
  begin
    if exists(select 1 from public.productos where id::text like '24000000-0000-4000-8000-%')
    then raise exception 'QA: catálogo privado visible anónimo.'; end if;
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.afiliadas_productos; raise exception 'QA: anónimo leyó permisos.';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.recursos_afiliadas; raise exception 'QA: anónimo leyó materiales.';
  exception when insufficient_privilege then null; end;
end $qa$;

reset role;
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
do $qa$
begin
  begin
    update public.productos set nombre='NO' where id='24000000-0000-4000-8000-000000000001';
    raise exception 'QA: service_role sin actor editó producto.';
  exception when insufficient_privilege then null; end;
  begin
    update public.afiliadas_productos set habilitada=false where usuaria_id='14000000-0000-4000-8000-000000000002';
    raise exception 'QA: service_role sin actor editó permiso.';
  exception when insufficient_privilege then null; end;
end $qa$;
reset role;

-- La transacción conserva solo fixtures hasta este punto; nada se confirma.
select 'OK: productos por afiliada, materiales, CAS y auditoría; fixtures revertidos' as resultado;
rollback;
