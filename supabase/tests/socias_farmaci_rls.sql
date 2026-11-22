-- Solo en una instancia local descartable. Activar explícitamente con
-- SET sf_qa.allow_fixture = 'local-only'; antes de cargar este archivo.
begin;
set local statement_timeout = '30s';
do $$
begin
  if current_setting('sf_qa.allow_fixture', true) is distinct from 'local-only' then
    raise exception 'Esta prueba requiere una instancia local descartable';
  end if;
end $$;
set local request.jwt.claims = '{"role":"service_role"}';
insert into auth.users(id,email,raw_user_meta_data) values
 ('aa820000-0000-4000-8000-000000000001','qa-farmaci-admin@example.invalid','{"nombre":"QA Admin"}'),
 ('aa820000-0000-4000-8000-000000000002','qa-farmaci-free@example.invalid','{"nombre":"QA Farmaci"}'),
 ('aa820000-0000-4000-8000-000000000003','qa-farmaci-socia@example.invalid','{"nombre":"QA Socia"}'),
 ('aa820000-0000-4000-8000-000000000004','qa-farmaci-paused@example.invalid','{"nombre":"QA Pausada"}');
update public.perfiles set estado='activa' where id in ('aa820000-0000-4000-8000-000000000001','aa820000-0000-4000-8000-000000000002','aa820000-0000-4000-8000-000000000003');
update public.perfiles set rol='admin' where id='aa820000-0000-4000-8000-000000000001';
update public.perfiles set tipo_usuario='socia' where id='aa820000-0000-4000-8000-000000000003';
update public.perfiles set estado='pausada' where id='aa820000-0000-4000-8000-000000000004';
insert into public.clases(id,titulo,modulo,plan,orden,activo,acceso_gratuito,solo_farmaci,video_key) values
 ('bb820000-0000-4000-8000-000000000001','QA exclusiva','QA','27',0,true,false,true,'qa/no-object.mp4'),
 ('bb820000-0000-4000-8000-000000000002','QA borrador','QA','27',1,false,false,true,null),
 ('bb820000-0000-4000-8000-000000000003','QA General','QA','27',2,true,false,false,'qa/no-object.mp4'),
 ('bb820000-0000-4000-8000-000000000004','QA Muestra','QA','27',3,true,true,false,'qa/no-object.mp4');
do $$
begin
  if has_function_privilege('authenticated','public.guardar_progreso_clase(uuid,uuid,text,integer,integer,boolean)','EXECUTE')
    or has_function_privilege('anon','public.guardar_progreso_clase(uuid,uuid,text,integer,integer,boolean)','EXECUTE') then
    raise exception 'El RPC no quedó reservado al servidor';
  end if;
  begin
    update public.clases set acceso_gratuito=true where id='bb820000-0000-4000-8000-000000000001';
    raise exception 'La clase exclusiva aceptó una muestra abierta';
  exception when check_violation then null; end;
  begin
    update public.clases set vimeo_url='https://vimeo.com/123' where id='bb820000-0000-4000-8000-000000000001';
    raise exception 'La clase exclusiva aceptó una fuente externa';
  exception when check_violation then null; end;
  begin
    update public.clases set activo=true where id='bb820000-0000-4000-8000-000000000002';
    raise exception 'La clase exclusiva se publicó sin MP4';
  exception when check_violation then null; end;
end $$;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
update public.perfiles set socias_farmaci_habilitada=true, socias_farmaci_habilitada_at=now(),
  socias_farmaci_habilitada_por='aa820000-0000-4000-8000-000000000001'
  where id in ('aa820000-0000-4000-8000-000000000002','aa820000-0000-4000-8000-000000000004');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aa820000-0000-4000-8000-000000000001"}';
do $$
begin
  if (select count(*) from public.clases where id::text like 'bb820000-0000-4000-8000-%') <> 4 then
    raise exception 'La administradora dejó de ver las clases';
  end if;
end $$;
set local request.jwt.claims = '{"role":"authenticated","sub":"aa820000-0000-4000-8000-000000000002"}';
do $$
begin
  if (select array_agg(id order by id)::text from public.clases where id::text like 'bb820000-0000-4000-8000-%') is distinct from '{bb820000-0000-4000-8000-000000000001,bb820000-0000-4000-8000-000000000004}' then
    raise exception 'Farmaci gratuita debe ver su clase y la muestra, no el catálogo pago';
  end if;
end $$;
set local request.jwt.claims = '{"role":"authenticated","sub":"aa820000-0000-4000-8000-000000000003"}';
do $$
begin
  if (select array_agg(id order by id)::text from public.clases where id::text like 'bb820000-0000-4000-8000-%') is distinct from '{bb820000-0000-4000-8000-000000000003,bb820000-0000-4000-8000-000000000004}' then
    raise exception 'Socia común pierde acceso general o ve Farmaci';
  end if;
  begin
    update public.perfiles set socias_farmaci_habilitada=true,
      socias_farmaci_habilitada_at=now(), socias_farmaci_habilitada_por=auth.uid() where id=auth.uid();
    raise exception 'Una alumna cambió su propio permiso';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"role":"authenticated","sub":"aa820000-0000-4000-8000-000000000004"}';
do $$
begin
  if exists(select 1 from public.clases where id='bb820000-0000-4000-8000-000000000001') then
    raise exception 'Cuenta pausada vio Farmaci';
  end if;
end $$;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select 1 from public.guardar_progreso_clase('aa820000-0000-4000-8000-000000000002','bb820000-0000-4000-8000-000000000001','posicion',10,100);
update public.perfiles set socias_farmaci_habilitada=false, socias_farmaci_habilitada_at=now(),
  socias_farmaci_habilitada_por='aa820000-0000-4000-8000-000000000001'
  where id='aa820000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aa820000-0000-4000-8000-000000000002"}';
do $$
begin
  if exists(select 1 from public.clases where id='bb820000-0000-4000-8000-000000000001')
      or exists(select 1 from public.progreso_clases where clase_id='bb820000-0000-4000-8000-000000000001') then
    raise exception 'Revocar debe ocultar la clase y su progreso';
  end if;
end $$;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
do $$
begin
  if not exists(select 1 from public.progreso_clases where alumna_id='aa820000-0000-4000-8000-000000000002'
    and clase_id='bb820000-0000-4000-8000-000000000001' and posicion_seg=10) then
    raise exception 'Revocar no debe borrar progreso';
  end if;
  begin
    perform 1 from public.guardar_progreso_clase('aa820000-0000-4000-8000-000000000002','bb820000-0000-4000-8000-000000000001','posicion',20,100);
    raise exception 'El servidor aceptó progreso después de revocar';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
