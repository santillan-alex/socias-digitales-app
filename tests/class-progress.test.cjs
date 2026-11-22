const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')
function load(file,deps={}) {const m={exports:{}};new Function('require','module','exports',ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='server-only'?{}:n in deps?deps[n]:require(n),m,m.exports);return m.exports}
const helpers=load('src/lib/class-progress.ts')
const access=load('src/lib/class-access.ts')
const management=load('src/lib/class-management.ts')
const server=load('src/lib/class-progress-server.ts')
const id='2d0df184-c4a0-4072-bf9e-80734b876b35'
test('valida segundos y acciones, sin aceptar propietario, negativos ni NaN',()=>{
  assert.deepEqual(helpers.validarProgreso({action:'posicion',posicion:12.4,duracion:100.7,userId:'otra'}),{action:'posicion',posicion:12,duracion:100})
  assert.deepEqual(helpers.validarProgreso({action:'completada',completada:false}),{action:'completada',completada:false})
  for(const payload of [null,[],{action:'completada',completada:'true'},{action:'delete'},{action:'posicion',posicion:-1,duracion:100},{action:'posicion',posicion:NaN,duracion:100},{action:'posicion',posicion:12,duracion:Infinity},{action:'posicion',posicion:12,duracion:0},{action:'posicion',posicion:12,duracion:1},{action:'posicion',posicion:12,duracion:200000}])assert.equal(helpers.validarProgreso(payload),null)
})
test('resumen usa solo clases disponibles y no duplica completas',()=>{
  assert.deepEqual(helpers.resumenPrograma(['a','b'],[{clase_id:'a',completada:true},{clase_id:'a',completada:true},{clase_id:'bloqueada',completada:true}]),{completas:1,total:2,porcentaje:50})
  assert.deepEqual(helpers.resumenPrograma([],[]),{completas:0,total:0,porcentaje:0})
})
test('continuar nunca recomienda una clase bloqueada, sin video o completada',()=>{
  const clases=[{id:'a',puede_ver:false,tiene_video_privado:true},{id:'b',puede_ver:true,tiene_video_privado:true},{id:'c',puede_ver:true}]
  const p=[{clase_id:'a',posicion_seg:99,completada:false,actualizado_en:'2026-10-14'},{clase_id:'b',posicion_seg:13,completada:false,actualizado_en:'2026-10-13'}]
  assert.equal(helpers.claseParaContinuar(clases,p).clase.id,'b')
  assert.equal(helpers.claseParaContinuar(clases,[{...p[1],completada:true}]),null)
  assert.equal(helpers.tiempoClase(125),'2:05')
})
test('respuesta de progreso no revela ids de otras alumnas ni revisión o claves privadas',()=>{
  const p={clase_id:id,posicion_seg:12,duracion_seg:100,completada:false,actualizado_en:'ahora',alumna_id:'otra',video_revision:'hash',video_key:'secreto'}
  assert.deepEqual(Object.keys(server.progresoPublico(p)).sort(),['actualizado_en','clase_id','completada','duracion_seg','posicion_seg'].sort())
})
function api({user={id:'alumna'},perfil={rol:'alumna',tipo_usuario:'gratuito'},clase={activo:true,acceso_gratuito:true,video_key:'v.mp4'},fail=false}={}) {
  let writes=[]
  let reads=0
  const client={auth:{getUser:async()=>({data:{user}})},from:t=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:t==='perfiles'?perfil:clase})})})})}
  const api=load('src/app/api/classroom/[id]/progreso/route.ts',{
    'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status??200,headers:opts.headers})}},
    '@/lib/supabase/server':{createClient:async()=>client},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,payload)=>{writes.push({name,payload});return {data:fail?null:[{clase_id:id,posicion_seg:0,duracion_seg:0,completada:true}],error:fail?{}:null}}})},
    '@/lib/class-access':access,'@/lib/class-progress':helpers,'@/lib/class-progress-server':{...server,leerProgresoClases:async()=>{reads++;return [{clase_id:id,posicion_seg:25,duracion_seg:120,completada:false}]}},'@/lib/class-management':management,
  })
  return {...api,writes,reads:()=>reads}
}
const context={params:Promise.resolve({id})}
const request=(payload,origin='https://app.test')=>new Request('https://app.test/api/classroom/x/progreso',{method:'POST',headers:{origin},body:JSON.stringify(payload)})
test('rechaza anónimos, admins y alumnas sin habilitar antes de guardar',async()=>{
  for(const [options,status] of [[{user:null},401],[{perfil:null},403],[{perfil:{rol:'admin'}},409],[{clase:{activo:true,acceso_gratuito:false,video_key:'v.mp4'}},403],[{clase:{activo:false,acceso_gratuito:true,video_key:'v.mp4'}},403],[{clase:{activo:true,acceso_gratuito:true}},403]]){
    const handler=api(options),res=await handler.POST(request({action:'completada',completada:true}),context)
    assert.equal(res.status,status);assert.equal(handler.writes.length,0)
  }
})
test('no confía origen externo, UUID falso o payloads enormes',async()=>{
  const handler=api()
  assert.equal((await handler.POST(request({action:'completada',completada:true},'https://otra.test'),context)).status,403)
  assert.equal((await handler.POST(request({action:'completada',completada:true}),{params:Promise.resolve({id:'falso'})})).status,404)
  assert.equal((await handler.POST(request({action:'completada',completada:true,extra:'x'.repeat(5000)}),context)).status,413)
  assert.equal(handler.writes.length,0)
})
test('guardar una clase gratuita vincula exclusivamente al usuario de getUser',async()=>{
  const handler=api(),res=await handler.POST(request({action:'completada',completada:true,alumna_id:'victima',posicion:99}),context)
  assert.equal(res.status,200);assert.equal(res.headers['Cache-Control'],'private, no-store')
  assert.equal(handler.writes[0].payload.p_alumna,'alumna');assert.equal(handler.writes[0].payload.p_posicion,null)
})
test('Desafío habilitado y Socias activas conservan acceso, no alcanza metadata editable',async()=>{
  for(const perfil of [{rol:'alumna',estado:'activa',desafio_socias_habilitada:true},{rol:'alumna',estado:'activa',tipo_usuario:'socia'}]){
    assert.equal((await api({perfil,clase:{activo:true,acceso_gratuito:false,video_key:'v.mp4'}}).POST(request({action:'posicion',posicion:25,duracion:120}),context)).status,200)
  }
  assert.equal((await api({user:{id:'u',user_metadata:{rol:'admin',tipo_usuario:'socia'}},clase:{activo:true,acceso_gratuito:false,video_key:'v.mp4'}}).POST(request({action:'completada',completada:true}),context)).status,403)
})
test('progreso de clases privadas rechaza Socias y Desafío pausadas, canceladas o sin estado antes de leer/escribir',async()=>{
  for(const estado of ['pausada','cancelada',undefined]) {
    for(const perfil of [{rol:'alumna',tipo_usuario:'socia',estado},{rol:'alumna',desafio_socias_habilitada:true,estado}]) {
      const handler=api({perfil,clase:{activo:true,acceso_gratuito:false,video_key:'v.mp4'}})
      assert.equal((await handler.GET(new Request('https://app.test'),context)).status,403)
      assert.equal((await handler.POST(request({action:'completada',completada:true}),context)).status,403)
      assert.equal(handler.reads(),0);assert.equal(handler.writes.length,0)
    }
  }
})
test('lectura de progreso propio conserva muestras gratuitas y clases activas autorizadas',async()=>{
  for(const options of [{perfil:{rol:'alumna',tipo_usuario:'socia',estado:'activa'},clase:{activo:true,acceso_gratuito:false,video_key:'v.mp4'}},{perfil:{rol:'alumna',tipo_usuario:'socia',estado:'pausada'}}]) {
    const handler=api(options),response=await handler.GET(new Request('https://app.test'),context)
    assert.equal(response.status,200);assert.equal(handler.reads(),1)
    assert.equal(response.body.progreso.clase_id,id)
  }
})
test('error de base nunca simula progreso guardado',async()=>{
  const res=await api({fail:true}).POST(request({action:'completada',completada:true}),context)
  assert.equal(res.status,503);assert.ok(!res.body.progreso)
})
test('migración RLS de lectura propia, sin escritura ni RPC público y sin borrar histórico',()=>{
  const sql=read('supabase/migrations/20261014162354_classroom_learning_progress.sql')
  assert.ok(sql.includes('enable row level security'));assert.ok(sql.includes('alumna_id = (select auth.uid())'))
  assert.ok(sql.includes('from public, anon, authenticated'));assert.ok(sql.includes('to service_role'))
  assert.ok(!sql.toLowerCase().includes('security definer'));assert.ok(!/drop\s+(?:table|policy)/i.test(sql));assert.ok(!/delete from/i.test(sql))
  assert.ok(sql.includes('video_revision=revision'));assert.ok(sql.includes('pc.completada else false'))
})
test('seguimiento excluye prueba y admins, y no pagina ni inventa cifras históricas',()=>{
  const page=read('src/app/admin/classroom/page.tsx'),sql=read('supabase/migrations/20261014162354_classroom_learning_progress.sql'),ui=read('src/app/admin/classroom/ClassProgressAdmin.tsx')
  assert.match(page,/\.rpc\(\s*['"]estadisticas_progreso_clases['"]\s*,\s*\{\s*p_excluir\s*:\s*\[\s*\.\.\.\s*CUENTAS_PRUEBA_IDS\s*\]\s*,?\s*\}\s*\)/);assert.ok(sql.includes("p.rol<>'admin'"));assert.ok(sql.includes('not(pc.alumna_id=any(p_excluir))'))
  assert.ok(ui.includes('desde que se habilitó el seguimiento'));assert.ok(ui.includes('no una certificación'))
})
test('reproductor accesible, mobile, reintento y guardado acotado, sin dependencias nuevas',()=>{
  const player=read('src/app/classroom/ClassPlayer.tsx')
  assert.ok(player.includes('showModal()'));assert.ok(player.includes('onCancel='));assert.ok(player.includes('100dvh'))
  assert.ok(player.includes('>=20000'));assert.ok(player.includes('visibilitychange'));assert.ok(player.includes('keepalive:true'))
  assert.ok(player.includes('Reintentar guardar'));assert.ok(player.includes('Vista administrativa'))
  assert.ok(player.includes('cadena.current'));assert.ok(player.includes('onLoadedMetadata'))
  assert.ok(read('src/app/globals.css').includes('.sd-video-dialog:not(dialog) h2'))
})
