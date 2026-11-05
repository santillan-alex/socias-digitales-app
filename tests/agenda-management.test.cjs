const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const read = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8')
function load(file, deps = {}, extra = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', ...Object.keys(extra), code)(n => n === 'server-only' ? {} : n in deps ? deps[n] : require(n), m, m.exports, ...Object.values(extra))
  return m.exports
}
const logic = load('src/lib/agenda-management.ts')
const json = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } }
const input = { titulo: 'Clase 2 · Elegí nicho y producto ganador', dia: '2026-10-15', hora: '19:30', enlace: '', publicado: true, audiencias: ['desafio', 'socia'] }
test('hito confirmado del 15/10, 19:30 Argentina, sin reciclar enlace del evento anterior', () => {
  const h = logic.validarHito(input)
  assert.deepEqual(h, logic.HITO_INICIAL)
  assert.equal(Date.parse(h.fecha), Date.parse('2026-10-15T22:30:00Z'))
  assert.equal(h.enlace, null)
  assert.equal(logic.fechaArgentinaHito('2028-02-29', '00:00'), '2028-02-29T00:00:00-03:00')
  for (const [dia,hora] of [['2026-02-29','19:30'],['2026-04-31','19:30'],['2026-13-01','19:30'],['2026-10-15','24:00'],['2026-10-15','19:60'],['15/10/2026','19:30']]) assert.throws(() => logic.fechaArgentinaHito(dia,hora))
})
test('validación estricta de audiencia, fecha, publicación y URL; no permite ids o campos inventados', () => {
  for (const diff of [{ titulo: ' ' },{ titulo: 'x'.repeat(121) },{ publicado: 'true' },{ audiencias: [] },{ audiencias: ['admin'] },{ audiencias: ['desafio','desafio'] },{ id: 'otro' },{ enlace: 'javascript:alert(1)' },{ enlace: 'http://zoom.us/123' },{ enlace: 'https://usuario:clave@zoom.us/123' },{ enlace: null }]) assert.throws(() => logic.validarHito({ ...input, ...diff }))
  assert.equal(logic.validarHito({ ...input, enlace: ' https://zoom.us/j/123 ' }).enlace, 'https://zoom.us/j/123')
})
test('solo alumnas activas habilitadas reciben hito publicado, sin auditoría ni datos de borrador', () => {
  const perfil = { rol: 'alumna', tipo_usuario: 'desafio', estado: 'activa', desafio_socias_habilitada: true }
  const h = { ...logic.HITO_INICIAL, administradora: 'privada' }
  const visible = logic.hitoParaAlumna(h, perfil)
  assert.equal(visible.length, 1); assert.deepEqual(Object.keys(visible[0]), ['id','titulo','fecha','enlace','accion'])
  for (const p of [{...perfil,rol:'admin'}, {...perfil,estado:'pausada'}, {...perfil,desafio_socias_habilitada:false}, {...perfil,tipo_usuario:'gratuito',desafio_socias_habilitada:false}]) assert.deepEqual(logic.hitoParaAlumna(h,p), [])
  assert.deepEqual(logic.hitoParaAlumna({...h,publicado:false},perfil),[])
  assert.equal(logic.hitoParaAlumna(h,{...perfil,tipo_usuario:'socia',desafio_socias_habilitada:false}).length,1)
  assert.deepEqual(logic.hitoParaAlumna({...h,audiencias:['socia']},perfil),[])
})
test('audiencia Socias exige tipo explícito; roles y permisos de Afiliadas no lo reemplazan', () => {
  const hito = { ...logic.HITO_INICIAL, audiencias: ['socia'], enlace: 'https://zoom.us/j/123' }
  for (const rol of ['alumna', 'afiliada', 'afiliada_lanzamiento', undefined]) {
    for (const tipo_usuario of ['gratuito', 'desafio', null, undefined]) {
      const perfil = { rol, tipo_usuario, estado: 'activa', desafio_socias_habilitada: false, afiliadas_habilitada: true }
      assert.deepEqual(logic.hitoParaAlumna(hito, perfil), [], `No concede Socias por ${rol}/${tipo_usuario}`)
      assert.deepEqual(logic.hitoParaAlumna(hito, { ...perfil, desafio_socias_habilitada: true }), [], 'Desafío tampoco concede una audiencia exclusiva de Socias')
    }
    assert.equal(logic.hitoParaAlumna(hito, { rol, tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false }).length, 1, 'Tipo Socia explícito conserva su encuentro')
  }
})
test('audiencia Desafío requiere habilitación verdadera y ambas audiencias conservan estado activo y publicación', () => {
  const hito = { ...logic.HITO_INICIAL, audiencias: ['desafio'] }
  for (const rol of ['alumna', 'afiliada', 'afiliada_lanzamiento']) {
    const perfil = { rol, tipo_usuario: 'socia', estado: 'activa' }
    for (const desafio_socias_habilitada of [false, null, undefined, 'true', 1]) assert.deepEqual(logic.hitoParaAlumna(hito, { ...perfil, desafio_socias_habilitada }), [], 'Ser Socia o un valor truthy no habilita Desafío')
    assert.equal(logic.hitoParaAlumna(hito, { ...perfil, tipo_usuario: 'gratuito', desafio_socias_habilitada: true }).length, 1)
    for (const estado of ['pausada', 'cancelada', null, undefined]) {
      assert.deepEqual(logic.hitoParaAlumna(logic.HITO_INICIAL, { ...perfil, estado, desafio_socias_habilitada: true }), [])
    }
    assert.deepEqual(logic.hitoParaAlumna({ ...logic.HITO_INICIAL, publicado: false }, { ...perfil, desafio_socias_habilitada: true }), [])
  }
  assert.deepEqual(logic.hitoParaAlumna(logic.HITO_INICIAL, { rol: 'admin', tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: true }), [])
})
test('R2: solo 404 inicializa; errores, documentos corruptos o falta de revisión no se sobrescriben', async () => {
  const store = response => load('src/lib/agenda-store.ts', { './r2-upload': { pedirR2: async () => response }, './agenda-management': logic })
  assert.deepEqual((await store(new Response('',{status:404})).leerAgenda()).hito, logic.HITO_INICIAL)
  for (const r of [new Response('',{status:403}),new Response('no json'),new Response(JSON.stringify({version:2})),new Response('x',{headers:{'content-length':'20000'}}),new Response(JSON.stringify({version:1,hito:logic.HITO_INICIAL,actualizado:'hoy'}))]) await assert.rejects(() => store(r).leerAgenda())
})
test('guardado privado usa escritura condicional y verifica lectura real; conflicto 412 no pisa a otra admin', async () => {
  const calls = [], hito = logic.validarHito(input)
  const store = load('src/lib/agenda-store.ts', { './agenda-management': logic, './r2-upload': { pedirR2: async (...args) => {
    calls.push(args)
    return args[0] === 'PUT' ? new Response(null) : new Response(JSON.stringify({version:1,hito,actualizado:'2026-10-15T22:00:00Z'}),{headers:{etag:'"abc123"'}})
  } } })
  assert.equal((await store.guardarAgenda(hito, null, 'actor')).revision, '"abc123"')
  assert.deepEqual(calls[0][5],{'If-None-Match':'*'}); assert.equal(calls[0][1],'plataforma/agenda-v1.json')
  assert.equal(JSON.parse(calls[0][3]).administradora,'actor')
  calls.length = 0
  await store.guardarAgenda(hito,'"abc123"','actor')
  assert.deepEqual(calls[0][5],{'If-Match':'"abc123"'})
  const conflict = load('src/lib/agenda-store.ts', { './agenda-management': logic, './r2-upload': { pedirR2: async () => new Response(null,{status:412}) } })
  await assert.rejects(() => conflict.guardarAgenda(hito, '"abc123"','actor'),conflict.ConflictoAgenda)
  await assert.rejects(() => conflict.guardarAgenda(hito, '*','actor'),conflict.ConflictoAgenda)
})
test('revisión R2: acepta etiquetas opacas/fuertes/débiles y digest crudo; nunca comodines, listas o inyección', async () => {
  const calls = [], hito = logic.validarHito(input)
  const store = load('src/lib/agenda-store.ts', { './agenda-management': logic, './r2-upload': { pedirR2: async (...args) => {
    calls.push(args)
    if(args[0] === 'PUT') return new Response(null)
    if(args[0] === 'HEAD') return new Response(null,{headers:{etag:'"opaque_Z9-gzip"'}})
    return new Response(JSON.stringify({version:1,hito,actualizado:'2026-10-15T22:00:00Z'}),{headers:{etag:'W/"opaque_Z9-gzip"'}})
  } } })
  for (const [entrada,salida] of [['"abc123"','"abc123"'],['W/"opaque_Z9-gzip"','W/"opaque_Z9-gzip"'],['abc123','"abc123"'],['"opaque/Z9+v2"','"opaque/Z9+v2"']]) {
    assert.equal(store.condicionRevisionAgenda(entrada),salida)
    calls.length = 0
    if(entrada.startsWith('W/')) { await assert.rejects(()=>store.guardarAgenda(hito,entrada,'actor'),store.ConflictoAgenda); assert.equal(calls.length,0); continue }
    await store.guardarAgenda(hito,entrada,'actor')
    assert.deepEqual(calls[0][5],{'If-Match':salida})
  }
  for (const entrada of ['*','"a", "b"','W/*','"a"\r\nX-Test: injected','""','a b','x'.repeat(257),undefined,{},1]) assert.throws(() => store.condicionRevisionAgenda(entrada),store.ConflictoAgenda)
  assert.equal(store.condicionRevisionAgenda(null),null)
  assert.equal((await store.leerAgenda()).revision,'"opaque_Z9-gzip"')
  assert.ok(calls.filter(c=>c[0]==='GET'||c[0]==='HEAD').every(c=>c[6].sinCompresion===true))
})
test('no une cuerpo anterior con HEAD de otra versión ni usa un ETag débil para If-Match', async () => {
  for(const head of [new Response(null,{headers:{etag:'"otra"'}}),new Response(null,{headers:{etag:'W/"abc123"'}}),new Response(null,{status:403})]){
    const store=load('src/lib/agenda-store.ts',{'./agenda-management':logic,'./r2-upload':{pedirR2:async method=>method==='HEAD'?head:new Response(JSON.stringify({version:1,hito:logic.HITO_INICIAL,actualizado:'hoy'}),{headers:{etag:'W/"abc123"'}})}})
    await assert.rejects(()=>store.leerAgenda())
  }
})
test('firma R2 incluye condición en encabezados firmados, sin alterar cargas multipart', async () => {
  const calls = []
  const r2 = load('src/lib/r2-upload.ts', {'./class-management':load('src/lib/class-management.ts')}, {
    process:{env:{R2_S3_ACCOUNT_ID:'fixture',R2_BUCKET_NAME:'private',R2_ACCESS_KEY_ID:'fixture',R2_SECRET_ACCESS_KEY:'not-a-real-secret'}},
    fetch:async (...args)=>{calls.push(args);return new Response(null)},
  })
  await r2.pedirR2('PUT','plataforma/agenda-v1.json',{},'{}','application/json',{'If-Match':'"abc123"'})
  assert.equal(calls[0][1].headers['if-match'],'"abc123"')
  assert.match(calls[0][1].headers.Authorization,/SignedHeaders=host;if-match;x-amz-content-sha256;x-amz-date/)
  assert.equal(calls[0][1].cache,'no-store')
  await r2.pedirR2('GET','clases/video.mp4')
  assert.match(calls[1][1].headers.Authorization,/SignedHeaders=host;x-amz-content-sha256;x-amz-date/)
  assert.equal(calls[1][1].headers['Accept-Encoding'],undefined)
  await r2.pedirR2('GET','plataforma/agenda-v1.json',{},'',undefined,undefined,{sinCompresion:true})
  assert.equal(calls[2][1].headers['Accept-Encoding'],'identity')
})
test('API admin: rechaza sesión/alumna y cuerpo manipulado antes de escribir; conflicto responde 409', async () => {
  let writes=0
  class Conflict extends Error {}
  const deps = {'next/server':json,'@/lib/agenda-management':logic,'@/lib/agenda-store':{ConflictoAgenda:Conflict,guardarAgenda:async()=>{writes++;throw new Conflict('Recargá')},leerAgenda:async()=>({})}}
  for(const status of [401,403]) {
    const api=load('src/app/api/admin/agenda/route.ts',{...deps,'@/lib/admin-auth':{autorizarAdmin:async()=>({error:{status}})}})
    assert.equal((await api.PUT(new Request('https://app.test',{method:'PUT',body:'{}'}))).status,status)
    assert.equal((await api.GET()).status,status)
  }
  const api=load('src/app/api/admin/agenda/route.ts',{...deps,'@/lib/admin-auth':{autorizarAdmin:async()=>({user:{id:'admin'}})}})
  assert.equal((await api.PUT(new Request('https://app.test',{method:'PUT',body:JSON.stringify({revision:null,hito:{...input,audiencias:['admin']}})}))).status,400)
  assert.equal(writes,0)
  assert.equal((await api.PUT(new Request('https://app.test',{method:'PUT',body:JSON.stringify({revision:null,hito:input})}))).status,409)
})
test('API alumna requiere sesión y perfil; no devuelve borradores ni metadatos administrativos', async () => {
  const soloSocias = { ...logic.HITO_INICIAL, audiencias: ['socia'] }
  for(const [user,perfil,hito,status,length] of [[null,null,logic.HITO_INICIAL,401,null],[{id:'u'},null,logic.HITO_INICIAL,503,null],[{id:'u'},{rol:'alumna',estado:'activa',tipo_usuario:'socia'},{...logic.HITO_INICIAL,publicado:false},200,0],[{id:'u'},{rol:'alumna',estado:'activa',tipo_usuario:'socia'},logic.HITO_INICIAL,200,1],...[ 'afiliada', 'afiliada_lanzamiento' ].flatMap(rol => [
    [{id:'u'},{rol,estado:'activa',tipo_usuario:'gratuito',desafio_socias_habilitada:false},soloSocias,200,0],
    [{id:'u'},{rol,estado:'activa',tipo_usuario:'socia',desafio_socias_habilitada:false},soloSocias,200,1],
  ])]) {
    const api=load('src/app/api/agenda/route.ts',{'next/server':json,'@/lib/agenda-management':logic,'@/lib/agenda-store':{leerAgenda:async()=>({hito,revision:'privada',administradora:'privada'})},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:perfil})})})})})}})
    const r=await api.GET(); assert.equal(r.status,status); assert.equal(r.headers['Cache-Control'],'private, no-store')
    if(length!==null)assert.equal(r.body.hitos.length,length)
    assert.ok(!JSON.stringify(r.body).includes('privada'))
  }
})
test('UI mobile y actualización compartida: una consulta, sin broadcast ni sobreescritura en segundo plano', () => {
  const ui=read('src/app/admin/agenda/AgendaAdmin.tsx'),provider=read('src/app/inicio/AgendaProvider.tsx')
  assert.ok(ui.includes('Publicar encuentro'));assert.ok(ui.includes('Guardar oculto'));assert.ok(ui.includes('Recargar última versión'))
  assert.ok(ui.includes('Recarg'));assert.ok(ui.includes('text-base'));assert.ok(ui.includes('min-w-0'))
  assert.ok(!ui.includes('/api/push/send'));assert.ok(!ui.includes('/api/admin/avisos'))
  assert.equal((provider.match(/fetch\('/g)||[]).length,1);assert.ok(provider.includes('60_000'));assert.ok(provider.includes('document.hidden'))
  assert.ok(provider.includes('controller.abort()'))
  assert.ok(read('src/app/inicio/page.tsx').includes('hitoParaAlumna'))
})
