/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const ts = require('typescript')
const root = path.join(__dirname, '..')
function load(file, deps = {}, env) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', 'process', code)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports, env ? { env } : process)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const pure = load('src/lib/class-import.ts', { './class-management': management })
const adminId = '11111111-1111-4111-8111-111111111111'
const scope = { nombre: 'Clases de prueba', programa: 'Farmasi', seccion: 'Clases', solo_farmaci: true }
const manifest = { action: 'iniciar', fuenteId: 'grabacion-1', titulo: 'Clase de prueba', descripcion: 'Una grabación terminada', orden: 1, nombre: 'clase.mp4', bytes: 100, sha256: 'a'.repeat(64) }
function fixture() {
  const objects = new Map(), uploads = new Map(), clases = new Map(), writes = []
  let etag = 0, uploadSeq = 0, role = 'admin', denyClassReads = false, failVideoHead = false, collideJob = false
  const condition = (row, filters) => filters.every(([key, value]) => row[key] === value)
  function query(table) {
    let op = 'select', values, filters = []
    function run() {
      if (table === 'perfiles') return { data: { rol: role }, error: null }
      if (denyClassReads) return { data: null, error: { code: '503' } }
      if (op === 'insert') {
        writes.push({ op, values: { ...values } })
        if (clases.has(values.id)) return { data: null, error: { code: '23505' } }
        clases.set(values.id, { video_key: null, ...values }); return { data: null, error: null }
      }
      const selected = [...clases.values()].find(row => condition(row, filters))
      if (op === 'update') {
        writes.push({ op, values: { ...values }, matched: Boolean(selected) })
        if (selected) Object.assign(selected, values)
      }
      return { data: selected ? { ...selected } : null, error: null }
    }
    const q = { select: () => q, eq: (k, v) => { filters.push([k, v]); return q }, is: (k, v) => { filters.push([k, v]); return q },
      insert: value => { op = 'insert'; values = value; return q }, update: value => { op = 'update'; values = value; return q },
      maybeSingle: async () => run(), then: (resolve, reject) => Promise.resolve().then(run).then(resolve, reject) }
    return q
  }
  const admin = { from: query }
  const r2 = {
    r2Configurado: () => true,
    firmarParte: (key, uploadId, numero) => `https://fixture.r2.cloudflarestorage.com/private/${key}?uploadId=${uploadId}&partNumber=${numero}&X-Amz-Signature=test`,
    xmlValue: (body, tag) => body.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1] ?? '',
    xmlEscape: value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    leerPartes: body => [...body.matchAll(/<Part><PartNumber>(\d+)<\/PartNumber><ETag>([a-f0-9]+)<\/ETag><Size>(\d+)<\/Size><\/Part>/g)]
      .map(m => ({ number: Number(m[1]), etag: m[2], size: Number(m[3]) })),
    partesCompletas: (parts, bytes) => parts.length === Math.ceil(bytes / management.TAMANO_PARTE) && parts.every((p, i) => p.number === i + 1 && p.size === Math.min(management.TAMANO_PARTE, bytes - i * management.TAMANO_PARTE)),
    pedirR2: async (method, key, params = {}, body = '', contentType, conditional, options) => {
      if (method === 'POST' && 'uploads' in params) {
        const id = `upload${++uploadSeq}`; uploads.set(id, { key, parts: [] })
        return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`)
      }
      if (method === 'GET' && params.uploadId) {
        const upload = uploads.get(params.uploadId)
        return upload ? new Response(`<ListPartsResult>${upload.parts.map(p => `<Part><PartNumber>${p.number}</PartNumber><ETag>${p.etag}</ETag><Size>${p.size}</Size></Part>`).join('')}</ListPartsResult>`) : new Response(null, { status: 404 })
      }
      if (method === 'DELETE' && params.uploadId) { uploads.delete(params.uploadId); return new Response(null, { status: 204 }) }
      if (method === 'POST' && params.uploadId) {
        const upload = uploads.get(params.uploadId)
        if (!upload) return new Response(null, { status: 404 })
        const bytes = Buffer.alloc(upload.parts.reduce((sum, p) => sum + p.size, 0)); bytes.write('ftyp', 4)
        objects.set(key, { body: bytes, etag: `"v${++etag}"`, type: 'video/mp4' }); uploads.delete(params.uploadId)
        return new Response('<CompleteMultipartUploadResult/>')
      }
      if (method === 'PUT') {
        const previous = objects.get(key)
        if ((conditional?.['If-None-Match'] === '*' && previous) || (conditional?.['If-Match'] && previous?.etag !== conditional['If-Match']))
          return new Response(null, { status: 412 })
        if (collideJob && key.includes('/trabajos/')) { collideJob = false; return new Response(null, { status: 412 }) }
        objects.set(key, { body, etag: `"v${++etag}"`, type: contentType }); return new Response(null, { status: 200 })
      }
      const value = objects.get(key)
      if (method === 'HEAD' && key.startsWith('clases/') && failVideoHead) return new Response(null, { status: 503 })
      if (!value) return new Response(null, { status: 404 })
      const headers = { etag: value.etag, 'content-type': value.type, 'content-length': String(Buffer.byteLength(value.body)) }
      if (method === 'HEAD') return new Response(null, { headers })
      if (method === 'GET') return new Response(options?.rango ? value.body.subarray(options.rango.inicio, options.rango.fin + 1) : value.body, { headers })
      throw Error(`unexpected ${method}`)
    },
  }
  const store = load('src/lib/class-import-store.ts', { './r2-upload': r2, './class-management': management, './class-import': pure })
  const server = load('src/lib/class-import-server.ts', { './r2-upload': r2, './class-management': management, './class-import': pure, './class-import-store': store,
    './supabase/admin': { createAdminClient: () => admin, isAdminSupabaseConfigured: () => true } })
  const req = token => new Request('https://app.sociasdigitales.com/api/integraciones/clases', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' })
  const auth = token => server.autorizarConexionClases(req(token))
  const action = async (token, value) => server.procesarImportacionClase(await auth(token), value)
  async function setConfig(change) { const config = await store.leerConfiguracionImportaciones(); change(config.valor); await store.guardarConfiguracionImportaciones(config.valor, config.revision) }
  return { server, store, r2, req, auth, action, objects, uploads, clases, writes, setConfig,
    setRole: value => { role = value }, setReadError: value => { denyClassReads = value }, setHeadError: value => { failVideoHead = value }, setCollision: value => { collideJob = value } }
}
async function conexion(f, input = scope) { return f.server.crearConexionClases(input, adminId) }
async function ready(f, token, input = manifest) {
  const started = await f.action(token, input)
  const job = (await f.store.leerTrabajoImportacion(started.importacion.id)).valor
  f.uploads.get(job.uploadId).parts = [{ number: 1, etag: 'abc123', size: input.bytes }]
  return started
}
const rejectsStatus = (promise, status) => assert.rejects(promise, error => error instanceof pure.ErrorImportacionClase && error.status === status)

test('manifiesto rechaza destinos, publicación, permisos, formatos y tamaños arbitrarios', () => {
  assert.equal(pure.validarManifestClase(manifest).titulo, 'Clase de prueba')
  for (const patch of [{ video_key: 'clases/otra/video.mp4' }, { activo: true }, { solo_farmaci: false }, { url: 'https://example.test/video.mp4' }, { bytes: 0 }, { bytes: management.MAX_VIDEO_BYTES + 1 }, { nombre: '../clase.mp4' }, { sha256: 'no' }, { orden: -1 }, { titulo: '' }, { fuenteId: 'a\nb' }])
    assert.equal(pure.validarManifestClase({ ...manifest, ...patch }), null)
  assert.equal(pure.validarConfiguracionConexion({ ...scope, programa: '../ › Material de apoyo' }), null)
  assert.equal(pure.validarConfiguracionConexion({ ...scope, solo_farmaci: 'true' }), null)
})
test('JSON tiene límite real aunque falte Content-Length y no admite binarios', async () => {
  const request = data => new Request('https://app.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data })
  assert.deepEqual(await pure.leerJsonImportacion(request('{}')), {})
  await rejectsStatus(pure.leerJsonImportacion(request(`{"x":"${'a'.repeat(16001)}"}`)), 413)
  await rejectsStatus(pure.leerJsonImportacion(request('null')), 400)
  await rejectsStatus(pure.leerJsonImportacion(request('{')), 400)
  await rejectsStatus(pure.leerJsonImportacion(new Request('https://app.test', { method: 'POST', body: 'video' })), 415)
})
test('conexión limitada guarda solo hash y no aparece la clave en listado o importaciones', async () => {
  const f = fixture(), c = await conexion(f)
  assert.match(c.clave, /^sdc_[0-9a-f-]{36}_[A-Za-z0-9_-]{43}$/)
  const all = JSON.stringify([...f.objects.values()])
  assert.ok(!all.includes(c.clave))
  assert.equal((await f.auth(c.clave)).conexion.programa, 'Farmasi')
  const listing = await f.server.listarImportacionesClases()
  assert.equal(listing.conexiones.length, 1)
  assert.equal('tokenHash' in listing.conexiones[0], false)
  assert.equal('creadaPor' in listing.conexiones[0], false)
  assert.ok(!JSON.stringify(listing).includes(c.clave))
})
test('token inválido, otra conexión, navegador, revocación y vencimiento no autorizan', async () => {
  const f = fixture(), c = await conexion(f)
  await rejectsStatus(f.auth(c.clave.slice(0, -1) + (c.clave.endsWith('a') ? 'b' : 'a')), 401)
  await rejectsStatus(f.server.autorizarConexionClases(new Request('https://app.test', { headers: { origin: 'https://app.test', Authorization: `Bearer ${c.clave}` } })), 403)
  await f.server.revocarConexionClases(c.conexion.id)
  await rejectsStatus(f.auth(c.clave), 401)
  const c2 = await conexion(f)
  await f.setConfig(config => { config.conexiones.find(x => x.id === c2.conexion.id).vencimiento = '2020-01-01T00:00:00.000Z' })
  await rejectsStatus(f.auth(c2.clave), 401)
  assert.equal(f.clases.size, 0)
})
test('perder rol administrativo revoca la capacidad sin confiar metadata ni una cookie', async () => {
  const f = fixture(), c = await conexion(f)
  f.setRole('alumna')
  await rejectsStatus(f.action(c.clave, manifest), 403)
  assert.equal(f.clases.size, 0)
})
test('iniciar y reintentar crea una sola clase privada y respeta alcance Farmasi', async () => {
  const f = fixture(), c = await conexion(f)
  const first = await f.action(c.clave, manifest), second = await f.action(c.clave, manifest)
  assert.equal(first.importacion.claseId, second.importacion.claseId)
  assert.equal(first.importacion.id, second.importacion.id)
  assert.equal(f.clases.size, 1)
  const clase = [...f.clases.values()][0]
  assert.equal(clase.solo_farmaci, true); assert.equal(clase.activo, false); assert.equal(clase.acceso_gratuito, false)
  assert.equal(clase.modulo, 'Farmasi'); assert.equal(clase.video_key, null)
  assert.equal(f.uploads.size, 1)
  assert.equal('videoKey' in first.importacion, false)
})
test('dos inicios simultáneos conservan una clase y una única sesión multipart vigente', async () => {
  const f = fixture(), c = await conexion(f)
  const calls = await Promise.allSettled([f.action(c.clave, manifest), f.action(c.clave, manifest)])
  assert.equal(f.clases.size, 1)
  const stable = await f.action(c.clave, manifest)
  for (const call of calls) if (call.status === 'fulfilled') assert.equal(call.value.importacion.claseId, stable.importacion.claseId)
  assert.equal((await f.store.leerConfiguracionImportaciones()).valor.conexiones[0].importaciones.length, 1)
})
test('mismo origen con otro archivo/título produce conflicto sin crear otra clase', async () => {
  const f = fixture(), c = await conexion(f)
  await f.action(c.clave, manifest)
  await rejectsStatus(f.action(c.clave, { ...manifest, sha256: 'b'.repeat(64) }), 409)
  await rejectsStatus(f.action(c.clave, { ...manifest, titulo: 'Otro título' }), 409)
  assert.equal(f.clases.size, 1)
})
test('otra conexión no firma ni finaliza una importación ajena', async () => {
  const f = fixture(), c = await conexion(f), other = await conexion(f, { ...scope, nombre: 'Otra', programa: 'Socias Digitales', solo_farmaci: false })
  const started = await f.action(c.clave, manifest)
  await rejectsStatus(f.action(other.clave, { action: 'parte', id: started.importacion.id, numero: 1 }), 404)
  await rejectsStatus(f.action(other.clave, { action: 'finalizar', id: started.importacion.id }), 404)
})
test('partes validan rango y estado; la firma solo refiere al objeto reservado', async () => {
  const f = fixture(), c = await conexion(f), started = await f.action(c.clave, manifest)
  await rejectsStatus(f.action(c.clave, { action: 'parte', id: started.importacion.id, numero: 0 }), 400)
  await rejectsStatus(f.action(c.clave, { action: 'parte', id: started.importacion.id, numero: 2 }), 400)
  await rejectsStatus(f.action(c.clave, { action: 'parte', id: '../secreto', numero: 1 }), 400)
  const part = await f.action(c.clave, { action: 'parte', id: started.importacion.id, numero: 1 })
  assert.match(part.url, /clases\//); assert.ok(!part.url.includes(c.clave))
})
test('finalizar incompleto o error HEAD no vincula video ni publica', async () => {
  const f = fixture(), c = await conexion(f), started = await f.action(c.clave, manifest)
  await rejectsStatus(f.action(c.clave, { action: 'finalizar', id: started.importacion.id }), 409)
  f.setHeadError(true)
  await rejectsStatus(f.action(c.clave, { action: 'finalizar', id: started.importacion.id }), 503)
  assert.equal([...f.clases.values()][0].video_key, null)
})
test('finalización verificada es idempotente y nunca publica la clase', async () => {
  const f = fixture(), c = await conexion(f), started = await ready(f, c.clave)
  const first = await f.action(c.clave, { action: 'finalizar', id: started.importacion.id })
  const second = await f.action(c.clave, { action: 'finalizar', id: started.importacion.id })
  assert.equal(first.importacion.estado, 'lista'); assert.equal(second.importacion.claseId, first.importacion.claseId)
  const clase = [...f.clases.values()][0]
  assert.ok(clase.video_key); assert.equal(clase.activo, false); assert.equal(clase.acceso_gratuito, false)
  assert.equal(f.writes.filter(w => w.op === 'update' && w.matched).length, 1)
})
test('respuesta perdida después de vincular recupera la misma clase sin repetir el guardado', async () => {
  const f = fixture(), c = await conexion(f), started = await ready(f, c.clave)
  const original = f.r2.pedirR2
  let lost = false
  f.r2.pedirR2 = async (...args) => {
    const response = await original(...args)
    if (!lost && args[0] === 'PUT' && args[1].includes('/trabajos/') && String(args[3]).includes('"estado":"lista"')) {
      lost = true; return new Response(null, { status: 503 })
    }
    return response
  }
  await rejectsStatus(f.action(c.clave, { action: 'finalizar', id: started.importacion.id }), 503)
  const recovered = await f.action(c.clave, manifest)
  assert.equal(recovered.importacion.estado, 'lista'); assert.equal(recovered.importacion.claseId, started.importacion.claseId)
  assert.equal(f.clases.size, 1); assert.equal(f.writes.filter(w => w.op === 'update' && w.matched).length, 1)
})
test('tamaño, MIME o cabecera del objeto completo inválidos impiden vincularlo', async () => {
  for (const patch of [{ body: Buffer.alloc(99), type: 'video/mp4' }, { body: Buffer.alloc(100), type: 'text/html' }, { body: Buffer.alloc(100), type: 'video/mp4' }]) {
    const f = fixture(), c = await conexion(f), started = await ready(f, c.clave)
    const job = (await f.store.leerTrabajoImportacion(started.importacion.id)).valor
    f.objects.set(job.videoKey, { ...patch, etag: '"video"' })
    await rejectsStatus(f.action(c.clave, { action: 'finalizar', id: started.importacion.id }), 409)
    assert.equal([...f.clases.values()][0].video_key, null)
  }
})
test('edición manual o publicación bloquea el reemplazo del video', async () => {
  for (const patch of [{ titulo: 'Edición de Flor' }, { activo: true }, { acceso_gratuito: true }, { video_key: 'clases/otro/actual.mp4' }, { farmasi_submodulo_id: '22222222-2222-4222-8222-222222222222' }]) {
    const f = fixture(), c = await conexion(f), started = await ready(f, c.clave)
    Object.assign([...f.clases.values()][0], patch)
    await rejectsStatus(f.action(c.clave, { action: 'finalizar', id: started.importacion.id }), 409)
    assert.equal(f.writes.filter(w => w.op === 'update' && w.matched).length, 0)
  }
})
test('revocación o pérdida de rol justo antes de la escritura impide vincular', async () => {
  const f = fixture(), c = await conexion(f), started = await ready(f, c.clave)
  const authenticated = await f.auth(c.clave)
  await f.server.revocarConexionClases(c.conexion.id)
  await rejectsStatus(f.server.procesarImportacionClase(authenticated, { action: 'finalizar', id: started.importacion.id }), 401)
  assert.equal([...f.clases.values()][0].video_key, null)
})
test('límite de bytes se aplica antes de crear otra clase o multipart', async () => {
  const f = fixture(), c = await conexion(f)
  await f.setConfig(config => {
    config.conexiones[0].importaciones.push({ id: 'b'.repeat(64), bytes: pure.MAX_BYTES_CONEXION, creada: new Date().toISOString(), fingerprint: 'c'.repeat(64) })
  })
  const objectCount = f.objects.size
  await rejectsStatus(f.action(c.clave, manifest), 429)
  await rejectsStatus(f.action(c.clave, { ...manifest, fuenteId: 'otra-grabacion' }), 429)
  assert.equal(f.objects.size, objectCount)
  assert.equal(f.clases.size, 0); assert.equal(f.uploads.size, 0)
})
test('video retirado después de importar produce conflicto; ningún reintento lo restaura', async () => {
  for (const action of ['iniciar', 'parte', 'finalizar']) {
    const f = fixture(), c = await conexion(f), started = await ready(f, c.clave)
    await f.action(c.clave, { action: 'finalizar', id: started.importacion.id })
    const clase = [...f.clases.values()][0]
    clase.video_key = null
    const count = f.writes.length
    await rejectsStatus(f.action(c.clave, action === 'iniciar' ? manifest : { action, id: started.importacion.id, ...(action === 'parte' ? { numero: 1 } : {}) }), 409)
    assert.equal(clase.video_key, null); assert.equal(f.writes.length, count)
  }
})
test('firma de máquina limita Content-Length exacto y conserva la firma heredada del navegador', () => {
  const env = { R2_S3_ACCOUNT_ID: 'fixture', R2_BUCKET_NAME: 'private', R2_ACCESS_KEY_ID: 'fixture-key', R2_SECRET_ACCESS_KEY: 'fixture-not-secret' }
  const r2 = load('src/lib/r2-upload.ts', { './class-management': management }, env)
  const legacy = new URL(r2.firmarParte('clases/test/video.mp4', 'upload', 1))
  const bounded = new URL(r2.firmarParte('clases/test/video.mp4', 'upload', 1, 100))
  const changedLength = new URL(r2.firmarParte('clases/test/video.mp4', 'upload', 1, 101))
  assert.equal(legacy.searchParams.get('X-Amz-SignedHeaders'), 'host')
  assert.equal(bounded.searchParams.get('X-Amz-SignedHeaders'), 'content-length;host')
  assert.notEqual(bounded.searchParams.get('X-Amz-Signature'), changedLength.searchParams.get('X-Amz-Signature'))
  assert.ok(!bounded.href.includes(env.R2_SECRET_ACCESS_KEY))
  for (const invalid of [0, -1, 1.5, management.TAMANO_PARTE + 1, '100']) assert.throws(() => r2.firmarParte('key', 'u', 1, invalid), /Tamaño/)
  for (const invalid of [0, -1, 1.5, 513]) assert.throws(() => r2.firmarParte('key', 'u', invalid, 100), /Tamaño/)
})
test('errores de catálogo no simulan clase inexistente ni crean una ficha nueva', async () => {
  const f = fixture(), c = await conexion(f)
  f.setReadError(true)
  await rejectsStatus(f.action(c.clave, manifest), 503)
  assert.equal(f.clases.size, 0)
})

test('CLI simula un archivo completo, reintento de parte y borrador confirmado sin exponer clave', async () => {
  const cli = await import(pathToFileURL(path.join(root, 'scripts/importar-clase.mjs')).href)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'socias-import-test-')), file = path.join(dir, 'clase.mp4')
  const bytes = Buffer.alloc(1024 * 1024 + 100); bytes.write('ftyp', 4); fs.writeFileSync(file, bytes)
  const token = `sdc_${adminId}_${'a'.repeat(43)}`, calls = [], progress = []
  let failedPart = false
  const job = { id: 'c'.repeat(64), claseId: adminId, estado: 'cargando' }
  try {
    const result = await cli.importarClase({ archivo: file, manifest: { fuenteId: 'grabacion', titulo: 'Prueba', orden: 1 }, token,
      appUrl: 'http://127.0.0.1:3124', allowLocal: true, stableMs: 0, onProgress: percent => progress.push(percent),
      fetchImpl: async (url, options) => {
        calls.push({ url, method: options.method, headers: options.headers, bytes: Buffer.isBuffer(options.body) ? options.body.length : 0 })
        if (options.method === 'PUT') {
          assert.equal(options.headers['Content-Length'], String(options.body.length))
          if (!failedPart) { failedPart = true; throw Error('network including secret URL') }
          return new Response(null, { status: 200 })
        }
        assert.equal(options.headers.Authorization, `Bearer ${token}`)
        const input = JSON.parse(options.body)
        if (input.action === 'iniciar') { assert.equal(input.bytes, bytes.length); assert.match(input.sha256, /^[0-9a-f]{64}$/); return Response.json({ importacion: job, partSize: 1024 * 1024, partes: [] }) }
        if (input.action === 'parte') return Response.json({ url: `https://fixture.r2.cloudflarestorage.com/private/video?uploadId=u&partNumber=${input.numero}&X-Amz-Signature=test` })
        if (input.action === 'finalizar') return Response.json({ importacion: { ...job, estado: 'lista' } })
        throw Error('unexpected')
      } })
    assert.equal(result.estado, 'lista'); assert.equal(progress.at(-1), 100)
    assert.equal(calls.filter(c => c.method === 'PUT').length, 3)
    assert.ok(calls.filter(c => c.method === 'PUT').every(c => c.bytes <= 1024 * 1024))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('CLI rechaza destino extraño, archivo parcial, secretos por URL y publicación', async () => {
  const cli = await import(pathToFileURL(path.join(root, 'scripts/importar-clase.mjs')).href)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'socias-import-test-')), file = path.join(dir, 'clase.mp4')
  fs.writeFileSync(file, Buffer.alloc(30))
  const params = { archivo: file, manifest: { fuenteId: 'grabacion', titulo: 'Prueba', orden: 1 }, token: `sdc_${adminId}_${'a'.repeat(43)}`, stableMs: 0, fetchImpl: () => { throw Error('must not fetch') } }
  try {
    await assert.rejects(cli.importarClase({ ...params, appUrl: 'https://example.test' }), /dominio/)
    await assert.rejects(cli.importarClase(params), /cabecera MP4/)
    await assert.rejects(cli.prepararArchivoClase(file, { ...params.manifest, activo: true }, { stableMs: 0 }), /manifiesto/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('CLI de reintento de una clase ya confirmada no vuelve a subir ni a finalizar', async () => {
  const cli = await import(pathToFileURL(path.join(root, 'scripts/importar-clase.mjs')).href)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'socias-import-test-')), file = path.join(dir, 'clase.mp4')
  const bytes = Buffer.alloc(100); bytes.write('ftyp', 4); fs.writeFileSync(file, bytes)
  let calls = 0
  try {
    const result = await cli.importarClase({ archivo: file, manifest: { fuenteId: 'grabacion', titulo: 'Prueba', orden: 1 }, token: `sdc_${adminId}_${'a'.repeat(43)}`, stableMs: 0,
      fetchImpl: async () => { calls++; return Response.json({ importacion: { id: 'c'.repeat(64), claseId: adminId, estado: 'lista' }, partSize: 1024 * 1024, partes: [] }) } })
    assert.equal(calls, 1); assert.equal(result.estado, 'lista')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
