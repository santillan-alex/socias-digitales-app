const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n === 'server-only' ? {} : n in deps ? deps[n] : require(n), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const access = load('src/lib/class-access.ts')
const poster = load('src/lib/class-poster.ts')
const cover = load('src/lib/class-cover.ts')
const coverServer = load('src/lib/class-cover-server.ts', { './class-cover': cover })
const id = '2d0df184-c4a0-4072-bf9e-80734b876b35'
const ctx = { params: Promise.resolve({ id }) }
class NextResponse extends Response { static json(data, opts = {}) { return Response.json(data, opts) } }
function api({ user = { id: 'u' }, perfil = { rol: 'admin' }, clase = { video_key: 'private-video.mp4', activo: true, acceso_gratuito: false }, status = 200, r2status = 404 } = {}) {
  const calls = []
  const db = { auth: { getUser: async () => ({ data: { user } }) }, from: t => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: t === 'perfiles' ? perfil : clase }) }) }) }) }
  const deps = { 'next/server': { NextResponse }, '@/lib/supabase/server': { createClient: async () => db }, '@/lib/class-management': management, '@/lib/class-access': access, '@/lib/class-poster': poster, '@/lib/class-cover': cover, '@/lib/class-cover-server': coverServer, '@/lib/admin-auth': { autorizarAdmin: async () => status === 200 ? { supabase: db } : { error: new Response(null, { status }) } }, '@/lib/r2-upload': { pedirR2: async (...args) => { calls.push(args); if (args[1].startsWith('portadas-clases/')) return new Response(null, { status: 404 }); return new Response(r2status === 200 ? new Uint8Array([255, 216, 255, 0, 255, 217]) : null, { status: r2status }) } } }
  return { ...load('src/app/api/classroom/[id]/miniatura/route.ts', deps), ...load('src/app/api/admin/clases/[id]/miniatura/route.ts', deps), calls }
}
const jpeg = new Uint8Array([255, 216, 255, ...Array(20).fill(0), 255, 217])
const req = (revision = poster.revisionMiniatura('private-video.mp4'), body = jpeg) => new Request(`https://app.test/api/admin/clases/${id}/miniatura?revision=${revision}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body })
test('miniatura pequeña JPEG real, clave derivada y distinta para cada revisión del video', () => {
  assert.equal(poster.esJpegMiniatura(jpeg), true)
  for (const bytes of [new Uint8Array(), new TextEncoder().encode('<svg>'), new Uint8Array(20001), new Uint8Array([255, 216, 255])]) assert.equal(poster.esJpegMiniatura(bytes), false)
  assert.notEqual(poster.claveMiniatura(id, 'v1'), poster.claveMiniatura(id, 'v2'))
  assert.ok(!poster.claveMiniatura(id, 'private-video.mp4').includes('private-video'))
})
test('anónima, gratuita sin acceso y clase oculta no reciben fotogramas privados', async () => {
  for (const [opts, status] of [[{ user: null }, 401], [{ perfil: { rol: 'alumna', tipo_usuario: 'gratuito' } }, 403], [{ perfil: { rol: 'alumna', desafio_socias_habilitada: true }, clase: { video_key: 'v', activo: false } }, 403]]) {
    const handler = api(opts), res = await handler.GET(new Request('https://app.test'), ctx)
    assert.equal(res.status, status); assert.equal(handler.calls.length, 0)
  }
})
test('una miniatura faltante no inicia reproducción; solo admin recibe revisión para generarla', async () => {
  const admin = await api().GET(new Request('https://app.test'), ctx)
  assert.equal((await admin.json()).revision, poster.revisionMiniatura('private-video.mp4'))
  const alumna = await api({ perfil: { rol: 'alumna', estado: 'activa', desafio_socias_habilitada: true } }).GET(new Request('https://app.test'), ctx)
  assert.equal(alumna.status, 204)
  assert.equal(alumna.headers.get('Cache-Control'), 'private, no-store')
})
test('miniaturas privadas requieren Socias o Desafío activos antes de leer R2', async () => {
  for (const estado of ['pausada', 'cancelada', undefined]) {
    for (const perfil of [{ rol: 'alumna', tipo_usuario: 'socia', estado }, { rol: 'alumna', desafio_socias_habilitada: true, estado }]) {
      const handler = api({ perfil })
      assert.equal((await handler.GET(new Request('https://app.test'), ctx)).status, 403)
      assert.equal(handler.calls.length, 0)
    }
  }
  const socia = api({ perfil: { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa' }, r2status: 200 })
  assert.equal((await socia.GET(new Request('https://app.test'), ctx)).status, 200)
})
test('POST requiere admin, JPEG limitado y revisión vigente; nunca modifica clase o video', async () => {
  for (const status of [401, 403]) assert.equal((await api({ status }).POST(req(), ctx)).status, status)
  const bad = api()
  assert.equal((await bad.POST(req('anterior'), ctx)).status, 409)
  assert.equal((await bad.POST(req(undefined, new TextEncoder().encode('<html>')), ctx)).status, 400)
  assert.equal(bad.calls.length, 0)
  const good = api({ r2status: 200 })
  assert.equal((await good.POST(req(), ctx)).status, 200)
  assert.equal(good.calls[0][0], 'PUT')
  assert.equal(good.calls[0][1], poster.claveMiniatura(id, 'private-video.mp4'))
  assert.deepEqual(good.calls[0][3], jpeg)
  assert.deepEqual(good.calls[0][5], { 'If-None-Match': '*' })
})
test('subir video genera fotograma local automáticamente; alumnas nunca generan ni cargan videos para miniaturas', () => {
  const upload = read('src/app/admin/classroom/VideoUpload.tsx'), client = read('src/lib/video-thumbnail-client.ts'), thumbnail = read('src/components/ClassVideoThumbnail.tsx')
  assert.ok(upload.includes('extraerMiniatura(localUrl'))
  assert.ok(client.includes('canvas.toBlob')); assert.ok(client.includes("'image/jpeg', 0.55"))
  assert.ok(client.includes('signal.aborted')); assert.ok(client.includes('cola.catch'))
  assert.ok(thumbnail.includes('IntersectionObserver'))
  assert.ok(thumbnail.includes("includes('application/json') && esAdmin"))
})
