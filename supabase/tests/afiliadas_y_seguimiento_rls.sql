-- Aceptación transaccional: ejecutar completa con un rol de mantenimiento
-- capaz de SET LOCAL ROLE, después de aplicar la migración correspondiente.
-- Crea identidades ficticias por SQL; no registra usuarios por red ni envía
-- mensajes. Ante un error, ejecutar ROLLBACK. Nunca confirmar estos datos.
begin;
set local statement_timeout='30s';
set local request.jwt.claims='{"role":"service_role"}';

do $qa$
declare tabla text;
begin
  if exists(select 1 from auth.users where id::text like '12000000-0000-4000-8000-%'
      or email like 'qa-afiliadas-%@example.invalid')
    or exists(select 1 from public.perfiles where id::text like '12000000-0000-4000-8000-%')
    or exists(select 1 from public.recursos_afiliadas where id::text like '22000000-0000-4000-8000-%')
    or exists(select 1 from public.cobros_socias where id::text like '32000000-0000-4000-8000-%')
  then raise exception 'QA: el espacio reservado ya existe; no se tocaron registros existentes.'; end if;
  if (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('accesos_afiliadas','recursos_afiliadas',
        'acompanamientos_socias','cobros_socias','seguimientos_socias_historial') and c.relrowsecurity)<>5
  then raise exception 'QA: falta RLS.'; end if;
  foreach tabla in array array['accesos_afiliadas','recursos_afiliadas','acompanamientos_socias',
      'cobros_socias','seguimientos_socias_historial'] loop
    if has_table_privilege('anon','public.'||tabla,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('authenticated','public.'||tabla,'DELETE,TRUNCATE')
      or has_table_privilege('service_role','public.'||tabla,'DELETE,TRUNCATE')
    then raise exception 'QA: privilegios excesivos en %.',tabla; end if;
  end loop;
  if has_table_privilege('authenticated','public.seguimientos_socias_historial','INSERT,UPDATE')
    or has_table_privilege('service_role','public.seguimientos_socias_historial','INSERT,UPDATE')
    or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in
        ('proteger_afiliadas_y_seguimiento','auditar_seguimientos_socias')
        and (has_function_privilege('authenticated',p.oid,'EXECUTE')
          or has_function_privilege('anon',p.oid,'EXECUTE')
          or has_function_privilege('service_role',p.oid,'EXECUTE')))
  then raise exception 'QA: el cliente puede escribir/falsificar historial o invocar triggers.'; end if;
  if not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname='auditar_seguimientos_socias' and p.prosecdef
        and p.proconfig @> array['search_path=""'])
    or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname='proteger_afiliadas_y_seguimiento' and p.prosecdef)
  then raise exception 'QA: elevación o search_path incorrectos.'; end if;
end $qa$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('12000000-0000-4000-8000-000000000001','qa-afiliadas-admin@example.invalid','{"nombre":"QA Administradora"}'),
 ('12000000-0000-4000-8000-000000000002','qa-afiliadas-explicita@example.invalid','{"nombre":"QA Afiliada","rol":"afiliada","tipo_usuario":"socia"}'),
 ('12000000-0000-4000-8000-000000000003','qa-afiliadas-socia@example.invalid','{"nombre":"QA Socia"}'),
 ('12000000-0000-4000-8000-000000000004','qa-afiliadas-desafio@example.invalid','{"nombre":"QA Desafio","tipo_usuario":"desafio"}'),
 ('12000000-0000-4000-8000-000000000005','qa-afiliadas-gratuita@example.invalid','{"nombre":"QA Gratuita"}'),
 ('12000000-0000-4000-8000-000000000006','qa-afiliadas-pausada@example.invalid','{"nombre":"QA Pausada"}'),
 ('12000000-0000-4000-8000-000000000007','qa-afiliadas-legacy@example.invalid','{"nombre":"QA Legacy"}');
update public.perfiles set estado='activa',created_at='2000-01-01T03:00:00Z'
 where id::text like '12000000-0000-4000-8000-%';
update public.perfiles set rol='admin' where id='12000000-0000-4000-8000-000000000001';
update public.perfiles set tipo_usuario='socia' where id='12000000-0000-4000-8000-000000000003';
update public.perfiles set rol='afiliada',tipo_usuario='gratuito'
 where id='12000000-0000-4000-8000-000000000007';

set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"12000000-0000-4000-8000-000000000001"}';
insert into public.accesos_afiliadas(usuaria_id,habilitada,actualizada_en) values
 ('12000000-0000-4000-8000-000000000002',true,'2001-01-01T00:00:00Z'),
 ('12000000-0000-4000-8000-000000000006',true,'2001-01-01T00:00:00Z');
insert into public.recursos_afiliadas(id,titulo,cuerpo,tipo,url,estado,destacado,creado_en,actualizado_en) values
 ('22000000-0000-4000-8000-000000000001','QA Publicado','Texto de prueba','copy',null,'publicado',true,'2001-01-01T00:00:00Z','2001-01-01T00:00:00Z'),
 ('22000000-0000-4000-8000-000000000002','QA Borrador','Borrador privado','aviso',null,'borrador',false,'2001-01-01T00:00:00Z','2001-01-01T00:00:00Z'),
 ('22000000-0000-4000-8000-000000000003','QA Archivado','','enlace','https://example.invalid/qa','archivado',false,'2001-01-01T00:00:00Z','2001-01-01T00:00:00Z');
insert into public.acompanamientos_socias(usuaria_id,inicio,fin,actualizado_en) values
 ('12000000-0000-4000-8000-000000000003','2023-08-31','2099-12-31','2001-01-01T00:00:00Z');
insert into public.cobros_socias(id,socia_id,concepto,vencimiento,monto,moneda,creado_en,actualizado_en) values
 ('32000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000003','QA Cuota ARS','2026-11-01',100.25,'ARS','2001-01-01T00:00:00Z','2001-01-01T00:00:00Z'),
 ('32000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000003','QA Sin importe','2026-11-02',null,null,'2001-01-01T00:00:00Z','2001-01-01T00:00:00Z');

do $qa$
begin
  if not public.es_admin() or (select count(*) from public.recursos_afiliadas
      where id::text like '22000000-0000-4000-8000-%')<>3 then raise exception 'QA: admin no ve todos los recursos.'; end if;
  if exists(select 1 from public.recursos_afiliadas where id::text like '22000000-0000-4000-8000-%'
      and (version<>1 or creado_en<transaction_timestamp() or actualizado_en is distinct from creado_en))
    or exists(select 1 from public.accesos_afiliadas where usuaria_id::text like '12000000-0000-4000-8000-%'
      and (version<>1 or actualizada_en<transaction_timestamp()))
    or exists(select 1 from public.cobros_socias where id::text like '32000000-0000-4000-8000-%'
      and (version<>1 or creado_en<transaction_timestamp() or actualizado_en is distinct from creado_en))
  then raise exception 'QA: se aceptaron fechas del cliente.'; end if;
  if (select fin from public.acompanamientos_socias where usuaria_id='12000000-0000-4000-8000-000000000003')
      is distinct from date '2024-02-29' then raise exception 'QA: seis meses no respeta año bisiesto/fin exclusivo.'; end if;
  if (select count(*) from public.seguimientos_socias_historial where usuaria_id='12000000-0000-4000-8000-000000000003')<>3
    or exists(select 1 from public.seguimientos_socias_historial where usuaria_id='12000000-0000-4000-8000-000000000003'
      and (anterior is not null or administradora_id<>auth.uid() or creado_en<transaction_timestamp() or (nuevo->>'version')::integer<>1))
  then raise exception 'QA: auditoría de creación incompleta.'; end if;
end $qa$;

-- Error esperado exacto: una operación permitida accidentalmente aborta QA.
do $qa$
declare caso record;
begin
  for caso in select * from (values
    ($sql$insert into public.accesos_afiliadas(usuaria_id,habilitada) values(auth.uid(),true)$sql$,'22023','habilitar administradora'),
    ($sql$insert into public.accesos_afiliadas(usuaria_id,version) values('12000000-0000-4000-8000-000000000005',2)$sql$,'22023','versión inicial acceso'),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo) values(' ','QA','copy')$sql$,'23514','título vacío'),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo) values(repeat('a',141),'QA','copy')$sql$,'23514','título largo'),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo) values('QA',repeat('a',12001),'copy')$sql$,'23514','cuerpo largo'),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo) values('QA',' ','copy')$sql$,'23514','copy vacío'),
    ($sql$insert into public.recursos_afiliadas(titulo,tipo) values('QA','video')$sql$,'23514','video sin URL'),
    ($sql$insert into public.recursos_afiliadas(titulo,tipo,url) values('QA','enlace','http://example.invalid')$sql$,'23514','URL sin HTTPS'),
    ($sql$insert into public.recursos_afiliadas(titulo,tipo,url) values('QA','enlace','https://usuario:clave@example.invalid')$sql$,'23514','URL con credenciales'),
    ($sql$insert into public.recursos_afiliadas(titulo,tipo,url) values('QA','enlace','https://example.invalid/a b')$sql$,'23514','URL con espacios'),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo,version) values('QA','QA','copy',2)$sql$,'22023','versión inicial recurso'),
    ($sql$update public.recursos_afiliadas set id=gen_random_uuid() where id='22000000-0000-4000-8000-000000000001'$sql$,'42501','identidad recurso'),
    ($sql$update public.recursos_afiliadas set creado_en='2001-01-01T00:00:00Z' where id='22000000-0000-4000-8000-000000000001'$sql$,'42501','creación recurso'),
    ($sql$update public.recursos_afiliadas set version=2 where id='22000000-0000-4000-8000-000000000001'$sql$,'22023','versión manipulada recurso'),
    ($sql$update public.accesos_afiliadas set usuaria_id='12000000-0000-4000-8000-000000000005' where usuaria_id='12000000-0000-4000-8000-000000000002'$sql$,'42501','identidad acceso'),
    ($sql$insert into public.acompanamientos_socias(usuaria_id,inicio) values('12000000-0000-4000-8000-000000000005','2026-01-01')$sql$,'22023','seguimiento gratuita'),
    ($sql$update public.acompanamientos_socias set inicio=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date+1 where usuaria_id='12000000-0000-4000-8000-000000000003'$sql$,'22023','inicio futuro'),
    ($sql$update public.acompanamientos_socias set inicio='1999-12-31' where usuaria_id='12000000-0000-4000-8000-000000000003'$sql$,'22023','inicio anterior al alta'),
    ($sql$update public.acompanamientos_socias set usuaria_id='12000000-0000-4000-8000-000000000004' where usuaria_id='12000000-0000-4000-8000-000000000003'$sql$,'42501','cambiar socia acompañamiento'),
    ($sql$insert into public.cobros_socias(socia_id,concepto,vencimiento) values('12000000-0000-4000-8000-000000000004','QA','2026-11-01')$sql$,'22023','cobro a Desafío'),
    ($sql$update public.cobros_socias set monto=0 where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','importe cero'),
    ($sql$update public.cobros_socias set monto=-1 where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','importe negativo'),
    ($sql$update public.cobros_socias set monto=1000000001 where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','importe excesivo'),
    ($sql$update public.cobros_socias set monto=1.001 where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','importe con tres decimales'),
    ($sql$update public.cobros_socias set moneda=null where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','importe sin moneda'),
    ($sql$update public.cobros_socias set moneda='EUR' where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','moneda desconocida'),
    ($sql$update public.cobros_socias set vencimiento='2100-01-01' where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','vencimiento fuera de rango'),
    ($sql$update public.cobros_socias set estado='pagado' where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','pagado sin fecha'),
    ($sql$update public.cobros_socias set pagado_en='2026-01-01' where id='32000000-0000-4000-8000-000000000001'$sql$,'23514','pendiente con fecha pago'),
    ($sql$update public.cobros_socias set estado='pagado',pagado_en=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date+1 where id='32000000-0000-4000-8000-000000000001'$sql$,'22023','pago futuro'),
    ($sql$update public.cobros_socias set socia_id='12000000-0000-4000-8000-000000000004' where id='32000000-0000-4000-8000-000000000001'$sql$,'42501','mover cobro de socia'),
    ($sql$delete from public.recursos_afiliadas where id='22000000-0000-4000-8000-000000000001'$sql$,'42501','borrar recurso'),
    ($sql$insert into public.seguimientos_socias_historial(usuaria_id,entidad,registro_id,nuevo,administradora_id) values('12000000-0000-4000-8000-000000000003','cobro',gen_random_uuid(),'{}',auth.uid())$sql$,'42501','falsificar auditoría'),
    ($sql$update public.seguimientos_socias_historial set nuevo='{}' where usuaria_id='12000000-0000-4000-8000-000000000003'$sql$,'42501','reescribir auditoría'),
    ($sql$delete from public.seguimientos_socias_historial where usuaria_id='12000000-0000-4000-8000-000000000003'$sql$,'42501','borrar auditoría')
  ) as casos(sentencia,esperado,etiqueta) loop
    begin
      execute caso.sentencia;
      raise exception 'QA: se permitió %.',caso.etiqueta;
    exception when others then
      if sqlstate<>caso.esperado then
        raise exception 'QA: % esperaba %, recibió %: %',caso.etiqueta,caso.esperado,sqlstate,sqlerrm;
      end if;
    end;
  end loop;
end $qa$;

-- CAS evita sobrescrituras obsoletas; cada cambio exitoso conserva su anterior.
do $qa$
declare cambiadas integer;
begin
  update public.acompanamientos_socias set inicio='2022-08-31',fin='2099-12-31'
    where usuaria_id='12000000-0000-4000-8000-000000000003' and version=1;
  get diagnostics cambiadas=row_count;
  if cambiadas<>1 or not exists(select 1 from public.acompanamientos_socias
      where usuaria_id='12000000-0000-4000-8000-000000000003' and version=2 and fin='2023-02-28')
  then raise exception 'QA: CAS o ajuste de fin de mes falló.'; end if;
  update public.acompanamientos_socias set inicio='2024-01-31'
    where usuaria_id='12000000-0000-4000-8000-000000000003' and version=1;
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 then raise exception 'QA: se permitió edición obsoleta.'; end if;
  update public.cobros_socias set estado='pagado',pagado_en='2026-10-01',actualizado_en='2001-01-01T00:00:00Z'
    where id='32000000-0000-4000-8000-000000000001' and version=1;
  get diagnostics cambiadas=row_count;
  if cambiadas<>1 or not exists(select 1 from public.cobros_socias
      where id='32000000-0000-4000-8000-000000000001' and version=2 and actualizado_en>=transaction_timestamp())
    or (select fin from public.acompanamientos_socias where usuaria_id='12000000-0000-4000-8000-000000000003')<>'2023-02-28'
    or not exists(select 1 from public.perfiles where id='12000000-0000-4000-8000-000000000003' and estado='activa')
  then raise exception 'QA: pagar no debe renovar ni bloquear el acceso.'; end if;
  if (select count(*) from public.seguimientos_socias_historial where usuaria_id='12000000-0000-4000-8000-000000000003')<>5
    or not exists(select 1 from public.seguimientos_socias_historial
      where usuaria_id='12000000-0000-4000-8000-000000000003' and entidad='acompanamiento'
        and anterior->>'fin'='2024-02-29' and nuevo->>'fin'='2023-02-28' and administradora_id=auth.uid())
    or not exists(select 1 from public.seguimientos_socias_historial
      where registro_id='32000000-0000-4000-8000-000000000001'
        and anterior->>'estado'='pendiente' and nuevo->>'estado'='pagado')
  then raise exception 'QA: historial incorrecto, duplicado o falta antes/después.'; end if;
end $qa$;

-- Una Afiliada explícita gratuita puede leer publicados; las metadata recibidas
-- al registrarse no le otorgaron Socias ni un rol privilegiado.
set local request.jwt.claims='{"role":"authenticated","sub":"12000000-0000-4000-8000-000000000002"}';
do $qa$
declare caso record;
declare cambiadas integer;
begin
  if not exists(select 1 from public.perfiles where id=auth.uid() and tipo_usuario='gratuito' and rol='alumna')
    or (select count(*) from public.accesos_afiliadas where usuaria_id::text like '12000000-0000-4000-8000-%')<>1
    or (select count(*) from public.recursos_afiliadas where id::text like '22000000-0000-4000-8000-%')<>1
    or exists(select 1 from public.recursos_afiliadas where id in ('22000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000003'))
    or exists(select 1 from public.acompanamientos_socias where usuaria_id='12000000-0000-4000-8000-000000000003')
    or exists(select 1 from public.cobros_socias where socia_id='12000000-0000-4000-8000-000000000003')
    or exists(select 1 from public.seguimientos_socias_historial where usuaria_id='12000000-0000-4000-8000-000000000003')
  then raise exception 'QA: lectura afiliada o aislamiento privado incorrectos.'; end if;
  update public.recursos_afiliadas set cuerpo='QA Cambiado' where id='22000000-0000-4000-8000-000000000001';
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 then raise exception 'QA: una alumna editó el recurso.'; end if;
  update public.accesos_afiliadas set habilitada=false where usuaria_id=auth.uid();
  get diagnostics cambiadas=row_count;
  if cambiadas<>0 then raise exception 'QA: una alumna modificó su acceso.'; end if;
  for caso in select * from (values
    ($sql$insert into public.accesos_afiliadas(usuaria_id,habilitada) values(auth.uid(),true)$sql$),
    ($sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo) values('QA','QA','copy')$sql$),
    ($sql$insert into public.acompanamientos_socias(usuaria_id,inicio) values(auth.uid(),'2026-01-01')$sql$),
    ($sql$insert into public.cobros_socias(socia_id,concepto,vencimiento) values(auth.uid(),'QA','2026-11-01')$sql$)
  ) as casos(sentencia) loop
    begin
      execute caso.sentencia;
      raise exception 'QA: alumna escribió datos administrativos.';
    exception when others then
      if sqlstate<>'42501' then raise exception 'QA: escritura alumna esperaba 42501, recibió %: %',sqlstate,sqlerrm; end if;
    end;
  end loop;
end $qa$;

-- Socia, Desafío, Gratuita y rol Afiliada heredado sin grant explícito no ven
-- recursos. Tampoco pueden ver el acompañamiento propio ni el de otras socias.
do $qa$
declare cuenta text;
begin
  foreach cuenta in array array['12000000-0000-4000-8000-000000000003',
      '12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000005',
      '12000000-0000-4000-8000-000000000007'] loop
    perform set_config('request.jwt.claims',json_build_object('role','authenticated','sub',cuenta)::text,true);
    if exists(select 1 from public.recursos_afiliadas where id::text like '22000000-0000-4000-8000-%')
      or exists(select 1 from public.accesos_afiliadas where usuaria_id::text like '12000000-0000-4000-8000-%')
      or exists(select 1 from public.acompanamientos_socias where usuaria_id='12000000-0000-4000-8000-000000000003')
      or exists(select 1 from public.cobros_socias where socia_id='12000000-0000-4000-8000-000000000003')
    then raise exception 'QA: acceso implícito indebido para %.',cuenta; end if;
  end loop;
end $qa$;

-- Pausar una afiliada invalida lectura inmediatamente; revocar sigue permitido.
reset role;
set local request.jwt.claims='{"role":"service_role"}';
update public.perfiles set estado='pausada' where id='12000000-0000-4000-8000-000000000006';
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"12000000-0000-4000-8000-000000000006"}';
do $qa$
begin
  if not exists(select 1 from public.accesos_afiliadas where usuaria_id=auth.uid() and habilitada)
    or exists(select 1 from public.recursos_afiliadas where id::text like '22000000-0000-4000-8000-%')
  then raise exception 'QA: perfil pausado con grant pudo leer recursos.'; end if;
end $qa$;
set local request.jwt.claims='{"role":"authenticated","sub":"12000000-0000-4000-8000-000000000001"}';
update public.accesos_afiliadas set habilitada=false where usuaria_id='12000000-0000-4000-8000-000000000006' and version=1;
do $qa$
begin
  if not exists(select 1 from public.accesos_afiliadas where usuaria_id='12000000-0000-4000-8000-000000000006'
      and not habilitada and version=2) then raise exception 'QA: no se pudo revocar a pausada.'; end if;
  begin
    update public.accesos_afiliadas set habilitada=true where usuaria_id='12000000-0000-4000-8000-000000000006';
    raise exception 'QA: se habilitó afiliada pausada.';
  exception when others then
    if sqlstate<>'22023' then raise exception 'QA: habilitar pausada esperaba 22023, recibió %.',sqlstate; end if;
  end;
end $qa$;
update public.accesos_afiliadas set habilitada=false where usuaria_id='12000000-0000-4000-8000-000000000002' and version=1;
set local request.jwt.claims='{"role":"authenticated","sub":"12000000-0000-4000-8000-000000000002"}';
do $qa$
begin
  if exists(select 1 from public.recursos_afiliadas where id::text like '22000000-0000-4000-8000-%')
  then raise exception 'QA: revocación no tuvo efecto inmediato.'; end if;
end $qa$;

-- Un servicio sin persona identificada no puede eludir los guards con BYPASSRLS.
reset role;
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
do $qa$
declare sentencia text;
begin
  foreach sentencia in array array[
    $sql$insert into public.accesos_afiliadas(usuaria_id,habilitada) values('12000000-0000-4000-8000-000000000005',true)$sql$,
    $sql$insert into public.recursos_afiliadas(titulo,cuerpo,tipo) values('QA','QA','copy')$sql$,
    $sql$insert into public.acompanamientos_socias(usuaria_id,inicio) values('12000000-0000-4000-8000-000000000003','2026-01-01')$sql$,
    $sql$insert into public.cobros_socias(socia_id,concepto,vencimiento) values('12000000-0000-4000-8000-000000000003','QA','2026-11-01')$sql$
  ] loop
    begin
      execute sentencia;
      raise exception 'QA: servicio sin administradora pudo escribir.';
    exception when others then
      if sqlstate<>'42501' then raise exception 'QA: servicio esperaba 42501, recibió %: %',sqlstate,sqlerrm; end if;
    end;
  end loop;
end $qa$;

reset role;
rollback;
