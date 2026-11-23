/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')
const sharp = require('sharp')
function load(file, deps = {}) {
  const m = { exports: {} }
  const source = readFileSync(join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } })
  new Function('require', 'module', 'exports', outputText)(n => n === 'server-only' ? {} : Object.hasOwn(deps, n) ? deps[n] : require(n), m, m.exports)
  return m.exports
}
const classAccess = load('src/lib/class-access.ts')
const classManagement = load('src/lib/class-management.ts')
const poster = load('src/lib/class-poster.ts')
const cover = load('src/lib/class-cover.ts')
const server = load('src/lib/class-cover-server.ts', { './class-cover': cover })
const id = '8d672740-5c93-4f56-ab9f-e6dd63267837'
const otra = '336bb9ef-1672-41e4-84ed-4554fdfa8e1f'
const ctx = (seleccion = id) => ({ params: Promise.resolve({ id: seleccion }) })
const origin = 'https://example.test'
const config = { create: { width: 440, height: 300, channels: 3, background: '#F4CAD8' } }
const archivo = tipo => sharp(config).toFormat(tipo).toBuffer()
const get = (automatic = false) => new Request(origin + '/miniatura' + (automatic ? '?fuente=automatica' : ''))
function escribir({ tipo = 'image/png', body, method = 'POST', origen = origin } = {}) {
  return new Request(origin + '/portada', { method, headers: { Origin: origen, 'Content-Type': tipo }, ...(body && { body }), ...(body instanceof ReadableStream && { duplex: 'half' }) })
}
class NextResponse extends Response { static json(data, init) { return Response.json(data, init) } }

function api({ user = { id: 'u' }, perfil = { rol: 'admin' }, clase = { video_key: 'video-privado.mp4', activo: true, acceso_gratuito: false, solo_farmaci: true }, objetos = new Map() } = {}) {
  const llamadas = []
  const db = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: tabla => ({ select: campos => ({ eq: (_col, valor) => ({ maybeSingle: async () => ({
      data: tabla === 'perfiles' ? perfil : campos === 'id' ? clase && [id, otra].includes(valor) ? { id: valor } : null : clase,
    }) }) }) }),
  }
  const auth = load('src/lib/admin-auth.ts', { '@/lib/supabase/server': { createClient: async () => db }, 'next/server': { NextResponse } })
  const deps = {
    'next/server': { NextResponse }, '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/class-access': classAccess, '@/lib/class-management': classManagement,
    '@/lib/class-poster': poster, '@/lib/class-cover': cover, '@/lib/class-cover-server': server, '@/lib/admin-auth': auth,
    '@/lib/r2-upload': { pedirR2: async (verb, key, _query, bytes, mime) => {
      llamadas.push({ verb, key, bytes, mime })
      if (verb === 'PUT') { objetos.set(key, bytes); return new Response(null) }
      if (verb === 'DELETE') return new Response(null, { status: objetos.delete(key) ? 204 : 404 })
      const objeto = objetos.get(key)
      return new Response(objeto ?? null, { status: objeto ? 200 : 404 })
    } },
  }
  return { ...load('src/app/api/classroom/[id]/miniatura/route.ts', deps), ...load('src/app/api/admin/clases/[id]/portada/route.ts', deps), llamadas, objetos }
}

test('decodifica JPEG, PNG y WebP reales, recorta 1280x720 y no deja metadatos', async () => {
  for (const [tipo, format] of Object.entries(cover.TIPOS_PORTADA)) {
    const entrada = await sharp(config).withMetadata({ orientation: 6 }).toFormat(format).toBuffer()
    const salida = await server.normalizarPortadaClase(entrada, tipo)
    assert.ok(salida.length <= cover.MAX_PORTADA_BYTES)
    assert.ok(server.esWebpPortada(salida))
    const { format: f, width, height, exif, orientation } = await sharp(salida).metadata()
    assert.deepEqual({ f, width, height, exif, orientation }, { f: 'webp', width: 1280, height: 720, exif: undefined, orientation: undefined })
  }
})

test('limita bytes del stream y rechaza imagen disfrazada, metadatos de formato erróneos o exceso de píxeles', async () => {
  const max = cover.MAX_PORTADA_ENTRADA
  const exceso = new ReadableStream({ start(control) { control.enqueue(new Uint8Array(max)); control.enqueue(Uint8Array.of(1)); control.close() } })
  const handler = api()
  assert.equal((await handler.POST(escribir({ body: exceso }), ctx())).status, 413)
  assert.equal((await handler.POST(escribir({ body: new TextEncoder().encode('<svg/>') }), ctx())).status, 400)
  assert.equal((await handler.POST(escribir({ tipo: 'image/png', body: await archivo('jpeg') }), ctx())).status, 400)
  assert.equal((await handler.POST(escribir({ tipo: 'text/html', body: new TextEncoder().encode('hola') }), ctx())).status, 415)
  const grande = await sharp({ create: { width: 4100, height: 4100, channels: 3, background: '#FFFFFF' } }).png().toBuffer()
  assert.equal((await handler.POST(escribir({ body: grande }), ctx())).status, 400)
  assert.equal(handler.llamadas.length, 0)
})

test('admin y origen se verifican antes de consumir el cuerpo o tocar R2; clase falsa/tocada no deja huérfanos', async () => {
  for (const [opts, origen, status] of [
    [{ user: null }, origin, 401], [{ perfil: { rol: 'alumna' } }, origin, 403],
    [{}, 'https://otro.test', 403], [{ clase: null }, origin, 404],
  ]) {
    const handler = api(opts)
    const req = escribir({ origen, body: await archivo('png') })
    const res = await handler.POST(req, ctx())
    assert.equal(res.status, status)
    assert.equal(req.bodyUsed, false)
    assert.equal(handler.llamadas.length, 0)
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store')
  }
  const handler = api()
  const req = escribir({ body: await archivo('png') })
  assert.equal((await handler.POST(req, ctx('invalid'))).status, 404)
  assert.equal(req.bodyUsed, false)
})

test('portada Farmasi usa autorización existente ANTES de todo acceso R2; sin compartir datos o URLs', async () => {
  const objetos = new Map([[server.clavePortadaClase(id), await archivo('webp')]])
  for (const [opc, status] of [
    [{ user: null }, 401],
    [{ perfil: { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa' } }, 403],
    [{ perfil: { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'pausada', socias_farmaci_habilitada: true } }, 403],
    [{ perfil: { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', socias_farmaci_habilitada: false } }, 403],
  ]) {
    const handler = api({ ...opc, objetos })
    const res = await handler.GET(get(true), ctx())
    assert.equal(res.status, status)
    assert.equal(handler.llamadas.length, 0)
  }
  const alumnaFarmasi = api({ perfil: { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', socias_farmaci_habilitada: true }, objetos })
  const good = await alumnaFarmasi.GET(get(true), ctx())
  assert.equal(good.status, 200)
  assert.equal(good.headers.get('X-Class-Thumbnail'), 'custom')
  assert.equal(good.headers.get('content-type'), 'image/webp')
  assert.equal(good.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(good.headers.get('Location'), null)
  assert.deepEqual(alumnaFarmasi.llamadas.map(l => l.key), [server.clavePortadaClase(id)])
})

test('guarda/reemplaza/borra solo la portada de una clase y restablece el JPEG vigente sin tocar video', async () => {
  const automatica = await archivo('jpeg')
  const claveAuto = poster.claveMiniatura(id, 'video-privado.mp4')
  const otrosBytes = await archivo('webp')
  const objetos = new Map([[claveAuto, automatica], [server.clavePortadaClase(otra), otrosBytes]])
  const handler = api({ objetos })
  assert.equal((await handler.GET(get(), ctx())).headers.get('X-Class-Thumbnail'), 'automatic')
  const first = await handler.POST(escribir({ body: await archivo('png') }), ctx())
  assert.equal(first.status, 200)
  const firstBytes = objetos.get(server.clavePortadaClase(id))
  const otherColor = await sharp({ create: { ...config.create, background: '#294A38' } }).webp().toBuffer()
  assert.equal((await handler.POST(escribir({ tipo: 'image/webp', body: otherColor }), ctx())).status, 200)
  assert.notDeepEqual(objetos.get(server.clavePortadaClase(id)), firstBytes)
  assert.equal((await handler.GET(get(), ctx())).headers.get('X-Class-Thumbnail'), 'custom')
  assert.equal((await handler.GET(get(true), ctx())).headers.get('X-Class-Thumbnail'), 'automatic')
  for (let vez = 0; vez < 2; vez++) assert.equal((await handler.DELETE(escribir({ method: 'DELETE' }), ctx())).status, 204)
  const despues = await handler.GET(get(), ctx())
  assert.equal(despues.headers.get('X-Class-Thumbnail'), 'automatic')
  assert.deepEqual(Buffer.from(await despues.arrayBuffer()), automatica)
  assert.equal(objetos.get(claveAuto), automatica)
  assert.equal(objetos.get(server.clavePortadaClase(otra)), otrosBytes)
  assert.equal(handler.llamadas.filter(l => l.verb !== 'GET').every(l => l.key === server.clavePortadaClase(id)), true)
})

test('el guard de alumna muestra portada para un Vimeo habilitado y guarda el placeholder para ausencia', async () => {
  const perfil = { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa' }
  const clase = { video_key: null, activo: true, acceso_gratuito: false, solo_farmaci: false }
  const vacio = api({ perfil, clase })
  assert.equal((await vacio.GET(get(), ctx())).status, 204)
  const objetos = new Map([[server.clavePortadaClase(id), await archivo('webp')]])
  const lleno = api({ perfil, clase, objetos })
  assert.equal((await lleno.GET(get(), ctx())).headers.get('X-Class-Thumbnail'), 'custom')
})
