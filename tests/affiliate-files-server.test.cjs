/* eslint-disable @typescript-eslint/no-require-imports */
// R2 y sesión simulados: ninguna prueba usa red, secretos o datos comerciales.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..'), uid = '00000000-0000-4000-8000-000000000010', recursoId = '2d0df184-c4a0-4072-bf9e-80734b876b35', archivoId = '8d86bb87-c028-4b6c-a644-df19145bc655', otro = '768b0be3-44ec-4f1e-9654-a351753208c2'
const env = { R2_S3_ACCOUNT_ID: 'fixture-account', R2_BUCKET_NAME: 'private-fixture', R2_ACCESS_KEY_ID: 'fixture-key', R2_SECRET_ACCESS_KEY: 'fixture-only-not-real' }
function loader(deps = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.join(root, file); if (cache.has(full)) return cache.get(full).exports
    const m = { exports: {} }; cache.set(full, m)
    const req = name => {
      if (Object.hasOwn(deps, name)) return deps[name]
      if (name === 'server-only') return {}
      if (name.startsWith('.') || name.startsWith('@/')) {
        const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(full), name)
        return load(path.relative(root, fs.existsSync(target + '.ts') ? target + '.ts' : target))
      }
      if (name === 'next/navigation') return { unstable_rethrow: e => { if (e?.digest === 'NEXT_CONTROL') throw e } }
      if (name === 'next/server') { class NextResponse extends Response { static json(value, options) { return Response.json(value, options) } }; return { NextResponse } }
      return require(name)
    }
    new Function('require', 'module', 'exports', 'process', 'fetch', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(req, m, m.exports, { env }, deps.__fetch ?? fetch); return m.exports
  }
  return load
}
const logic = loader()('src/lib/affiliate-files.ts'), realR2 = loader()('src/lib/r2-upload.ts')
const pdf = () => new TextEncoder().encode('%PDF-1.7\nDocumento ficticio para QA local.\n%%EOF')
function fixture(options = {}) {
  const objects = new Map(), uploads = new Map(), calls = []; let seq = 0
  const headersFor = item => ({ 'Content-Type': item.mime, 'Content-Length': String(item.body.length), ETag: item.etag })
  function seed(key, body, mime = 'application/json') { objects.set(key, { body: typeof body === 'string' ? new TextEncoder().encode(body) : body.slice(), mime, etag: '"' + (++seq).toString(16).padStart(32, '0') + '"' }) }
  const pedirR2 = async (method, key, query = {}, body = '', mime, condition, extra) => {
    calls.push({ method, key, query, condition, extra, bytes: typeof body === 'string' ? Buffer.byteLength(body) : body.length })
    if (options.response) { const intercepted = options.response({ method, key, query, body, mime, condition, extra }); if (intercepted) return intercepted }
    if (method === 'POST' && Object.hasOwn(query, 'uploads')) { const uploadId = 'multipart-fixture-' + ++seq; uploads.set(uploadId, { key, mime, parts: new Map() }); return new Response(`<InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`) }
    if (query.uploadId) {
      const upload = uploads.get(query.uploadId)
      if (!upload || upload.key !== key) return new Response(null, { status: 404 })
      if (method === 'DELETE') { uploads.delete(query.uploadId); return new Response(null, { status: 204 }) }
      if (method === 'GET') return new Response(`<ListPartsResult>${[...upload.parts].sort(([a], [b]) => a - b).map(([number, bytes]) => `<Part><PartNumber>${number}</PartNumber><ETag>&quot;${number.toString(16).padStart(32, '0')}&quot;</ETag><Size>${bytes.length}</Size></Part>`).join('')}</ListPartsResult>`)
      if (method === 'POST') {
        const parts = [...upload.parts].sort(([a], [b]) => a - b).map(([, bytes]) => bytes), size = parts.reduce((n, bytes) => n + bytes.length, 0), combined = new Uint8Array(size); let offset = 0
        for (const bytes of parts) { combined.set(bytes, offset); offset += bytes.length }
        seed(key, combined, upload.mime); uploads.delete(query.uploadId); return new Response('<CompleteMultipartUploadResult/>')
      }
    }
    const current = objects.get(key)
    if (method === 'PUT') {
      if (current && condition?.['If-None-Match'] === '*') return new Response(null, { status: 412 })
      seed(key, body, mime)
      if (options.loseMetadataResponse && mime === 'application/json') return new Response(null, { status: 503 })
      return new Response(null, { status: 200 })
    }
    if (!current) return new Response(null, { status: 404 })
    if (method === 'HEAD') return new Response(null, { headers: headersFor(current) })
    if (method === 'GET') {
      if (extra?.rango || extra?.range) { const prefix = current.body.slice(0, Math.min(32, current.body.length)); return new Response(prefix, { status: 206, headers: { ...headersFor(current), 'Content-Length': String(prefix.length), 'Content-Range': `bytes 0-${prefix.length - 1}/${current.body.length}` } }) }
      return new Response(current.body, { headers: headersFor(current) })
    }
    throw new Error('Operación inesperada: ' + method)
  }
  const r2 = { ...realR2, pedirR2 }, dependencies = { './r2-upload': r2, '@/lib/r2-upload': r2 }, load = loader(dependencies), server = load('src/lib/affiliate-files-server.ts')
  const auth = { userId: uid, admin: true, supabase: {} }
  async function start(body = pdf(), name = 'Guía de afiliadas.pdf') { return server.iniciarArchivoAfiliadas(auth, { recursoId, nombre: name, bytes: body.length }) }
  function upload(started, body = pdf()) {
    const state = server.leerTokenArchivoAfiliadas(started.token, uid), current = uploads.get(state.uploadId)
    assert.ok(current, 'Debe existir una sesión multipart privada')
    for (let offset = 0, number = 1; offset < body.length; offset += started.parteBytes, number++) current.parts.set(number, body.slice(offset, offset + started.parteBytes))
    return { state, current }
  }
  return { server, load, calls, objects, uploads, seed, auth, start, upload, dependencies }
}
test('iniciar y firmar son solo administrativos, usan namespace propio y partes directas sin pasar binarios por la API', async () => {
  const s = fixture(), started = await s.start(), state = s.server.leerTokenArchivoAfiliadas(started.token, uid)
  assert.equal(started.parteBytes, 16 * 1024 ** 2); assert.equal(started.totalPartes, 1); assert.equal(state.userId, uid); assert.equal(state.recursoId, recursoId); assert.equal(state.archivo.nombre, 'Guía de afiliadas.pdf'); assert.ok(state.exp > Date.now() + 11 * 60 * 60 * 1000)
  assert.ok(s.calls[0].key.startsWith('afiliadas/')); assert.ok(!s.calls[0].key.includes('clases/')); assert.equal(s.objects.size, 0)
  const signed = await s.server.operarArchivoAfiliadas(s.auth, { action: 'firmar', token: started.token, numero: 1 }), url = new URL(signed.url)
  assert.equal(url.searchParams.get('uploadId'), state.uploadId); assert.equal(url.searchParams.get('partNumber'), '1'); assert.equal(url.searchParams.get('X-Amz-Expires'), '900'); assert.ok(!url.href.includes(env.R2_SECRET_ACCESS_KEY))
  for (const numero of [0, 2, 1.2, '1']) await assert.rejects(s.server.operarArchivoAfiliadas(s.auth, { action: 'firmar', token: started.token, numero }))
  for (const auth of [{ ...s.auth, admin: false }, { ...s.auth, userId: otro }]) await assert.rejects(s.server.operarArchivoAfiliadas(auth, { action: 'firmar', token: started.token, numero: 1 }))
  const no = fixture(); await assert.rejects(no.server.iniciarArchivoAfiliadas({ ...no.auth, admin: false }, { recursoId, nombre: 'a.pdf', bytes: 10 })); assert.equal(no.calls.length, 0)
})
test('token propio liga administradora, recurso, archivo, metadata y expiración; rechaza alteración y ámbito de clases', async () => {
  const s = fixture(), started = await s.start(), state = s.server.leerTokenArchivoAfiliadas(started.token, uid)
  assert.deepEqual(s.server.leerTokenArchivoAfiliadas(started.token, uid), state)
  for (const token of [null, '', 'malformado', started.token + 'x', started.token + '.extra', 'a'.repeat(16000)]) assert.throws(() => s.server.leerTokenArchivoAfiliadas(token, uid))
  assert.throws(() => s.server.leerTokenArchivoAfiliadas(started.token, otro))
  for (const changes of [{ exp: Date.now() - 1 }, { recursoId: 'ajeno' }, { archivoId: 'ajeno' }, { uploadId: '' }, { archivo: { ...state.archivo, bytes: 0 } }, { archivo: { ...state.archivo, mime: 'text/html' } }]) assert.throws(() => s.server.leerTokenArchivoAfiliadas(s.server.tokenArchivoAfiliadas({ ...state, ...changes }), uid))
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url'), signature = require('node:crypto').createHmac('sha256', env.R2_SECRET_ACCESS_KEY).update('sd-upload-v1:' + payload).digest('base64url')
  assert.throws(() => s.server.leerTokenArchivoAfiliadas(payload + '.' + signature, uid))
})
test('carga completa valida partes y bytes reales, confirma metadata inmutable y recupera el mismo archivo al reintentar', async () => {
  const s = fixture(), body = pdf(), started = await s.start(body), { state } = s.upload(started, body)
  const status = await s.server.operarArchivoAfiliadas(s.auth, { action: 'estado', token: started.token }); assert.deepEqual(status.partes, [1])
  const completed = await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }), row = completed.archivo
  assert.equal(logic.esArchivoAfiliadas(row), true); assert.equal(row.recursoId, recursoId); assert.equal(row.id, state.archivoId); assert.equal(row.bytes, body.length); assert.equal(row.url, logic.urlArchivoAfiliadas(recursoId, row.id)); assert.ok(!JSON.stringify(row).includes('cloudflarestorage')); assert.ok(!Object.hasOwn(row, 'key'))
  const metadataWrite = s.calls.find(c => c.method === 'PUT'); assert.deepEqual(metadataWrite.condition, { 'If-None-Match': '*' }); assert.ok(s.calls.some(c => c.method === 'GET' && (c.extra?.rango || c.extra?.range)))
  assert.deepEqual(await s.server.leerArchivoAfiliadas(recursoId, row.id), row)
  const count = s.objects.size; assert.deepEqual(await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }), completed); assert.equal(s.objects.size, count)
  assert.equal(await s.server.leerArchivoAfiliadas(recursoId, otro), null)
})
test('partes parciales o con número incorrecto no completan; un objeto con contenido falso tampoco se anuncia', async () => {
  const missing = fixture(), started = await missing.start(); await assert.rejects(missing.server.operarArchivoAfiliadas(missing.auth, { action: 'completar', token: started.token })); assert.equal(missing.objects.size, 0)
  const nonconsecutive = fixture(), second = await nonconsecutive.start(), { current } = nonconsecutive.upload(second); current.parts.set(2, current.parts.get(1)); current.parts.delete(1)
  await assert.rejects(nonconsecutive.server.operarArchivoAfiliadas(nonconsecutive.auth, { action: 'completar', token: second.token })); assert.equal(nonconsecutive.objects.size, 0)
  const fake = fixture(), fakeBytes = new TextEncoder().encode('<html>Documento falso para QA local</html>'), third = await fake.start(fakeBytes); fake.upload(third, fakeBytes)
  await assert.rejects(fake.server.operarArchivoAfiliadas(fake.auth, { action: 'completar', token: third.token })); assert.ok(!fake.calls.some(c => c.method === 'PUT'))
})
test('estado enumera solo partes confirmadas y completar exige también la última parte real', async () => {
  const s = fixture(), body = new Uint8Array(16 * 1024 ** 2 + 40); body.set(pdf())
  const started = await s.start(body), state = s.server.leerTokenArchivoAfiliadas(started.token, uid), pending = s.uploads.get(state.uploadId)
  assert.equal(started.totalPartes, 2); pending.parts.set(1, body.slice(0, started.parteBytes))
  assert.deepEqual(await s.server.operarArchivoAfiliadas(s.auth, { action: 'estado', token: started.token }), { partes: [1] })
  await assert.rejects(s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }), e => e.status === 409); assert.equal(s.objects.size, 0)
  pending.parts.set(2, body.slice(started.parteBytes)); assert.deepEqual(await s.server.operarArchivoAfiliadas(s.auth, { action: 'estado', token: started.token }), { partes: [1, 2] })
  assert.equal((await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token })).archivo.bytes, body.length)
})
test('cancelar aborta solo su multipart y no elimina un archivo confirmado ni publica un recurso', async () => {
  const s = fixture(), pending = await s.start(); s.upload(pending)
  await s.server.operarArchivoAfiliadas(s.auth, { action: 'cancelar', token: pending.token }); assert.equal(s.uploads.size, 0); assert.equal(s.objects.size, 0)
  const good = await s.start(); s.upload(good); await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: good.token }); const size = s.objects.size
  await s.server.operarArchivoAfiliadas(s.auth, { action: 'cancelar', token: good.token }); assert.equal(s.objects.size, size)
  assert.ok(s.calls.filter(c => c.method === 'DELETE').every(c => c.query.uploadId))
})
test('vincular solo acepta metadata confirmada del mismo recurso y tipo; enlaces externos conservan su circuito', async () => {
  const s = fixture(), started = await s.start(); const { state } = s.upload(started); const url = logic.urlArchivoAfiliadas(recursoId, state.archivoId)
  const datos = { titulo: 'Guía', cuerpo: '', tipo: 'archivo', campana: null, url, estado: 'borrador', destacado: false }
  await assert.rejects(s.server.comprobarVinculoArchivoAfiliadas(recursoId, datos))
  await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }); await s.server.comprobarVinculoArchivoAfiliadas(recursoId, datos)
  await assert.rejects(s.server.comprobarVinculoArchivoAfiliadas(otro, datos))
  await assert.rejects(s.server.comprobarVinculoArchivoAfiliadas(recursoId, { ...datos, tipo: 'video' }))
  const count = s.calls.length; await s.server.comprobarVinculoArchivoAfiliadas(recursoId, { ...datos, url: 'https://example.invalid/guia.pdf' }); assert.equal(s.calls.length, count)
})
test('HEAD y lectura Range deben coincidir en MIME, bytes y respuesta206 exacta; no basta renombrar el archivo', async () => {
  const cases = [
    q => q.method === 'HEAD' ? new Response(null, { headers: { 'Content-Length': String(pdf().length), 'Content-Type': 'text/html' } }) : null,
    q => q.method === 'HEAD' ? new Response(null, { headers: { 'Content-Length': '123', 'Content-Type': 'application/pdf' } }) : null,
    q => q.extra?.rango ? new Response(pdf(), { status: 200 }) : null,
    q => q.extra?.rango ? new Response(pdf().slice(0, 32), { status: 206, headers: { 'Content-Range': 'bytes 0-31/999', 'Content-Length': '32' } }) : null,
    q => q.extra?.rango ? new Response(new Uint8Array(40), { status: 206, headers: { 'Content-Range': `bytes 0-31/${pdf().length}`, 'Content-Length': '40' } }) : null,
    q => q.extra?.rango ? new Response(new Uint8Array(1), { status: 206, headers: { 'Content-Range': `bytes 0-31/${pdf().length}`, 'Content-Length': '32' } }) : null,
  ]
  for (const response of cases) {
    const s = fixture({ response }), started = await s.start(); s.upload(started)
    await assert.rejects(s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token })); assert.ok(!s.calls.some(c => c.method === 'PUT'))
  }
  const mp4 = new Uint8Array(64); mp4.set([0, 0, 0, 24]); mp4.set(new TextEncoder().encode('ftypisom'), 4)
  const good = fixture(), started = await good.start(mp4, 'Creativo.mp4'); good.upload(started, mp4); assert.equal((await good.server.operarArchivoAfiliadas(good.auth, { action: 'completar', token: started.token })).archivo.mime, 'video/mp4')
})
test('respuesta perdida de metadata confirma el mismo UUID y una lectura rota jamás se convierte en ausencia', async () => {
  const s = fixture({ loseMetadataResponse: true }), started = await s.start(); s.upload(started)
  const completed = await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }); assert.equal(logic.esArchivoAfiliadas(completed.archivo), true)
  const count = s.objects.size; assert.deepEqual(await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }), completed); assert.equal(s.objects.size, count)
  const key = `afiliadas/indices/${recursoId}/${completed.archivo.id}.json`, before = s.objects.get(key)
  for (const body of ['{', JSON.stringify({ version: 99 }), JSON.stringify({ version: 1, archivo: { ...completed.archivo, recursoId: otro }, creadoraId: uid, creadoEn: new Date().toISOString() }), ' '.repeat(4097)]) { s.seed(key, body); await assert.rejects(s.server.leerArchivoAfiliadas(recursoId, completed.archivo.id)) }
  s.objects.set(key, before)
  const blocked = fixture({ response: q => q.method === 'GET' && q.key.startsWith('afiliadas/indices/') ? new Response(null, { status: 503 }) : null }); await assert.rejects(blocked.server.leerArchivoAfiliadas(recursoId, archivoId))
})
test('firma de descarga restringe a60 segundos, attachment y octet-stream con firma canónica reproducible', () => {
  const { createHash, createHmac } = require('node:crypto'), key = `afiliadas/archivos/${recursoId}/${archivoId}.pdf`, disposition = "attachment; filename=\"recurso.pdf\"; filename*=UTF-8''Gu%C3%ADa.pdf"
  const url = new URL(realR2.firmarDescargaPrivada(key, disposition, 60))
  assert.equal(url.searchParams.get('X-Amz-Expires'), '60'); assert.equal(url.searchParams.get('response-content-disposition'), disposition); assert.equal(url.searchParams.get('response-content-type'), 'application/octet-stream'); assert.ok(!url.href.includes(env.R2_SECRET_ACCESS_KEY))
  const signature = url.searchParams.get('X-Amz-Signature'); url.searchParams.delete('X-Amz-Signature')
  const amzDate = url.searchParams.get('X-Amz-Date'), scope = amzDate.slice(0, 8) + '/auto/s3/aws4_request', enc = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const query = [...url.searchParams].map(([k, v]) => [enc(k), enc(v)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => k + '=' + v).join('&')
  const canonical = ['GET', url.pathname, query, `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n'), hmac = (key, value) => createHmac('sha256', key).update(value).digest()
  const signing = hmac(hmac(hmac(hmac('AWS4' + env.R2_SECRET_ACCESS_KEY, amzDate.slice(0, 8)), 'auto'), 's3'), 'aws4_request')
  assert.equal(signature, createHmac('sha256', signing).update(['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n')).digest('hex'))
})
test('RangeR2 firma el header exacto y rechaza rangos no acotados o métodos distintos deGET', async () => {
  const requests = [], r2 = loader({ __fetch: async (url, options) => { requests.push({ url, options }); return new Response(new Uint8Array(32), { status: 206 }) } })('src/lib/r2-upload.ts')
  await r2.pedirR2('GET', 'afiliadas/archivo.mp4', {}, '', undefined, undefined, { rango: { inicio: 0, fin: 31 } })
  assert.equal(requests.length, 1); assert.equal(requests[0].options.headers.Range ?? requests[0].options.headers.range, 'bytes=0-31'); assert.match(requests[0].options.headers.Authorization, /SignedHeaders=[^,]*range/)
  for (const rango of [{ inicio: -1, fin: 31 }, { inicio: 32, fin: 31 }, { inicio: 0, fin: 1024 * 1024 }, { inicio: 0, fin: 1.2 }]) await assert.rejects(r2.pedirR2('GET', 'afiliadas/archivo.mp4', {}, '', undefined, undefined, { rango }))
  await assert.rejects(r2.pedirR2('PUT', 'afiliadas/archivo.mp4', {}, '', undefined, undefined, { rango: { inicio: 0, fin: 31 } })); assert.equal(requests.length, 1)
})
function apiFixture(options = {}) {
  const s = fixture(options), resources = new Map(), dbCalls = []
  const db = { auth: { getUser: async () => ({ data: { user: options.user === false ? null : { id: uid, user_metadata: { rol: 'admin' } } }, error: options.authError ?? null }) }, from(table) {
    const q = { table, filters: [] }, b = { select(fields) { q.fields = fields; return b }, eq(key, value) { q.filters.push([key, value]); return b }, maybeSingle: async () => {
      dbCalls.push(q)
      const requestedId = q.filters.find(([k]) => k === 'id')?.[1]
      if (table === 'perfiles') return { data: options.profile === null || requestedId !== uid ? null : { id: uid, rol: options.role ?? 'admin', estado: options.active === false ? 'pausada' : 'activa' }, error: options.profileError ?? null }
      if (table === 'accesos_afiliadas') return { data: options.accessError ? null : { usuaria_id: uid, habilitada: options.enabled !== false }, error: options.accessError ?? null }
      if (table === 'productos') return { data: options.product === undefined ? { id: otro, tipo: 'fisico', activo: true, estado_afiliadas: 'publicado' } : options.product, error: options.productError ?? null }
      if (table === 'afiliadas_productos') return { data: options.productAccess === undefined ? { usuaria_id: uid, producto_id: otro, habilitada: true } : options.productAccess, error: options.productAccessError ?? null }
      assert.equal(table, 'recursos_afiliadas'); return { data: resources.get(requestedId) ?? null, error: options.resourceError ?? null }
    } }; return b
  } }
  s.dependencies['./supabase/server'] = { createClient: async () => db }
  s.dependencies['@/lib/supabase/server'] = s.dependencies['./supabase/server']
  const admin = s.load('src/app/api/admin/afiliadas/archivos/route.ts'), download = s.load('src/app/api/afiliadas/[id]/archivo/[archivoId]/route.ts')
  const apiUrl = 'https://app.sociasdigitales.com/api/admin/afiliadas/archivos'
  const post = (body, changes = {}) => admin.POST(new Request(apiUrl + (changes.query ?? ''), { method: 'POST', headers: { origin: changes.origin === undefined ? 'https://app.sociasdigitales.com' : changes.origin, 'Content-Type': changes.contentType ?? 'application/json' }, body: changes.raw === undefined ? JSON.stringify(body) : changes.raw }))
  const open = (fileId, query = '', owner = recursoId, accept) => download.GET(new Request(`https://app.sociasdigitales.com/api/afiliadas/${owner}/archivo/${fileId}${query}`, { headers: accept ? { Accept: accept } : {} }), { params: Promise.resolve({ id: owner, archivoId: fileId }) })
  return { ...s, resources, dbCalls, admin, download, apiUrl, post, open }
}
test('API administrativa verifica sesión/rol, origen, JSON real acotado y claves exactas antes de iniciar multipart', async () => {
  for (const [options, status] of [[{ user: false }, 401], [{ role: 'alumna' }, 403], [{ role: 'afiliada' }, 403], [{ profile: null }, 503], [{ profileError: {} }, 503]]) {
    const s = apiFixture(options), response = await s.post({ action: 'iniciar', recursoId, nombre: 'Guía.pdf', bytes: 100 }); assert.equal(response.status, status); assert.equal(s.calls.length, 0)
  }
  const s = apiFixture(), input = { action: 'iniciar', recursoId, nombre: 'Guía.pdf', bytes: 100 }
  for (const changes of [{ origin: 'https://otra.example.invalid' }, { origin: '' }]) assert.equal((await s.post(input, changes)).status, 403)
  assert.equal((await s.post(input, { contentType: 'text/plain' })).status, 415)
  assert.equal((await s.post(input, { raw: 'x'.repeat(65001) })).status, 413)
  assert.equal((await s.post(input, { raw: '{' })).status, 400)
  assert.equal((await s.post(input, { query: '?forzar=1' })).status, 400)
  for (const body of [{ ...input, key: 'clases/ajena.mp4' }, { ...input, userId: otro }, { ...input, action: 'constructor' }, { ...input, bytes: 0 }, { action: 'firmar', token: 'falso', numero: 1, recursoId }]) assert.equal((await s.post(body)).status, 400)
  assert.equal(s.calls.length, 0)
  const prepared = await s.post(input); assert.equal(prepared.status, 200); assert.equal(prepared.headers.get('cache-control'), 'private, no-store'); assert.equal(prepared.headers.get('x-content-type-options'), 'nosniff'); assert.ok((await prepared.json()).token)
})
test('GET administrativo devuelve solo metadata confirmada, rechaza filtros extra/duplicados y nunca ofrece una URL firmada guardable', async () => {
  const s = apiFixture(), started = await s.start(); const { state } = s.upload(started)
  const make = suffix => s.admin.GET(new Request(s.apiUrl + suffix))
  for (const query of ['', '?recursoId=' + recursoId, `?recursoId=${recursoId}&archivoId=${archivoId}&extra=1`, `?recursoId=${recursoId}&recursoId=${recursoId}&archivoId=${archivoId}`]) assert.equal((await make(query)).status, 400)
  const query = `?recursoId=${recursoId}&archivoId=${state.archivoId}`
  assert.equal((await make(query)).status, 404)
  await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token })
  const response = await make(query), data = await response.json(); assert.equal(response.status, 200); assert.equal(logic.esArchivoAfiliadas(data.archivo), true); assert.ok(!JSON.stringify(data).includes('X-Amz')); assert.ok(!JSON.stringify(data).includes('creadoraId'))
  const denied = apiFixture({ role: 'alumna' }); assert.equal((await denied.admin.GET(new Request(denied.apiUrl + query))).status, 403); assert.equal(denied.calls.length, 0)
})
test('descarga comprueba accesoAfiliadas en cada petición y estado/referencia/tipo actual antes de firmar60s', async () => {
  const s = apiFixture({ role: 'alumna' }), started = await s.start(), { state } = s.upload(started)
  const completed = await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token }), info = completed.archivo
  s.resources.set(recursoId, { id: recursoId, producto_id: null, tipo: 'archivo', estado: 'publicado', url: info.url })
  const response = await s.open(state.archivoId); assert.equal(response.status, 307); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  const location = new URL(response.headers.get('location')); assert.equal(location.searchParams.get('X-Amz-Expires'), '60'); assert.equal(location.searchParams.get('response-content-type'), 'application/octet-stream'); assert.match(location.searchParams.get('response-content-disposition'), /attachment;.*filename\*=UTF-8''Gu%C3%ADa/)
  assert.ok(s.dbCalls.filter(q => q.table === 'accesos_afiliadas').length >= 1)
  for (const changes of [{ estado: 'borrador' }, { estado: 'archivado' }, { tipo: 'video' }, { tipo: 'copy' }, { url: info.url.replace(info.id, otro) }, { url: info.url.replace(recursoId, otro) }, { url: 'https://example.invalid/externo.pdf' }]) { s.resources.set(recursoId, { id: recursoId, producto_id: null, tipo: 'archivo', estado: 'publicado', url: info.url, ...changes }); assert.equal((await s.open(info.id)).status, 404) }
  assert.equal((await s.open(info.id, '?download=1')).status, 404); assert.equal((await s.open('invalido')).status, 404)
  for (const [options, status] of [[{ user: false }, 401], [{ role: 'alumna', enabled: false }, 403], [{ role: 'alumna', active: false }, 403], [{ role: 'alumna', accessError: {} }, 503]]) { const no = apiFixture(options); assert.equal((await no.open(info.id)).status, status); assert.equal(no.calls.length, 0) }
  const admin = apiFixture(), draft = await admin.start(); admin.upload(draft); const file = (await admin.server.operarArchivoAfiliadas(admin.auth, { action: 'completar', token: draft.token })).archivo
  admin.resources.set(recursoId, { id: recursoId, producto_id: null, tipo: 'archivo', estado: 'borrador', url: file.url }); assert.equal((await admin.open(file.id)).status, 307)
})
test('errores navegados vuelven al ingreso o Afiliadas con303 y destino fijo del mismo origen; API conserva JSON y status', async () => {
  const casos = [
    [{ user: false }, 401, '/login?next=%2Fafiliadas'],
    [{ role: 'alumna', enabled: false }, 403, '/afiliadas?descarga=no-disponible'],
    [{ role: 'alumna' }, 404, '/afiliadas?descarga=no-disponible'],
    [{ role: 'alumna', accessError: {} }, 503, '/afiliadas?descarga=reintentar'],
    [{ role: 'alumna', resourceError: {} }, 503, '/afiliadas?descarga=reintentar'],
  ]
  for (const [options, status, destino] of casos) {
    const s = apiFixture(options), response = await s.open(archivoId, '', recursoId, 'text/html,application/xhtml+xml;q=0.9')
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), destino); assert.equal(await response.text(), '')
    assert.equal(new URL(response.headers.get('location'), 'https://app.sociasdigitales.com').origin, 'https://app.sociasdigitales.com')
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); assert.equal(s.calls.length, 0)
    for (const accept of [undefined, 'application/json', '*/*', 'application/json; profile="text/html"']) {
      const json = await s.open(archivoId, '', recursoId, accept); assert.equal(json.status, status); assert.equal(json.headers.get('location'), null); assert.equal(typeof (await json.json()).error, 'string')
    }
  }
  const alias = apiFixture({ user: false }), origin = 'https://flor.sociasdigitales.com', url = `${origin}/api/afiliadas/${recursoId}/archivo/${archivoId}`
  const response = await alias.download.GET(new Request(url, { headers: { Accept: 'TEXT/HTML; charset=utf-8' } }), { params: Promise.resolve({ id: recursoId, archivoId }) })
  assert.equal(response.status, 303); assert.equal(new URL(response.headers.get('location'), url).origin, origin)
  const malformed = apiFixture(), invalid = await malformed.open('invalido', '?next=https://otro.example.invalid&mensaje=texto-no-confiable', recursoId, 'text/html')
  assert.equal(invalid.headers.get('location'), '/afiliadas?descarga=no-disponible'); assert.equal(await invalid.text(), '')
})
test('navegación HTML autorizada conserva307 y firma privada de60s; fallo del almacén vuelve a reintentar sin filtrar detalles', async () => {
  const s = apiFixture({ role: 'alumna' }), started = await s.start(); s.upload(started)
  const info = (await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token })).archivo
  s.resources.set(recursoId, { id: recursoId, producto_id: null, tipo: 'archivo', estado: 'publicado', url: info.url })
  const success = await s.open(info.id, '', recursoId, 'text/html')
  assert.equal(success.status, 307); assert.equal(success.headers.get('cache-control'), 'private, no-store'); assert.equal(success.headers.get('x-content-type-options'), 'nosniff')
  const signed = new URL(success.headers.get('location')); assert.equal(signed.searchParams.get('X-Amz-Expires'), '60'); assert.equal(signed.searchParams.get('response-content-type'), 'application/octet-stream'); assert.match(signed.searchParams.get('response-content-disposition'), /^attachment;/)
  const unavailable = apiFixture({ role: 'alumna', response: q => q.method === 'GET' && q.key.startsWith('afiliadas/indices/') ? new Response('No difundir detalle interno', { status: 503 }) : null })
  unavailable.resources.set(recursoId, { id: recursoId, producto_id: null, tipo: 'archivo', estado: 'publicado', url: logic.urlArchivoAfiliadas(recursoId, archivoId) })
  const html = await unavailable.open(archivoId, '', recursoId, 'text/html'); assert.equal(html.status, 303); assert.equal(html.headers.get('location'), '/afiliadas?descarga=reintentar'); assert.equal(await html.text(), '')
  const json = await unavailable.open(archivoId, '', recursoId, 'application/json'); assert.equal(json.status, 503); assert.ok(!JSON.stringify(await json.json()).includes('No difundir'))
})

test('material de producto exige grant específico al descargar y revocar evita nueva firma incluso con referencia conocida', async () => {
  const options = { role: 'alumna' }, s = apiFixture(options), started = await s.start(); s.upload(started)
  const info = (await s.server.operarArchivoAfiliadas(s.auth, { action: 'completar', token: started.token })).archivo
  s.resources.set(recursoId, { id: recursoId, producto_id: otro, tipo: 'archivo', estado: 'publicado', url: info.url })
  assert.equal((await s.open(info.id)).status, 307)
  assert.ok(s.dbCalls.some(q => q.table === 'afiliadas_productos' && q.filters.some(([k, v]) => k === 'producto_id' && v === otro)))
  options.productAccess = { usuaria_id: uid, producto_id: otro, habilitada: false }
  const denied = await s.open(info.id); assert.equal(denied.status, 404); assert.equal(denied.headers.get('location'), null)
  assert.equal((await s.open(info.id, '', recursoId, 'text/html')).headers.get('location'), '/afiliadas?descarga=no-disponible')
  options.productAccess = { usuaria_id: uid, producto_id: otro, habilitada: true }
  options.product = { id: otro, tipo: 'fisico', activo: true, estado_afiliadas: 'archivado' }
  assert.equal((await s.open(info.id)).status, 404)
  options.product = { id: otro, tipo: 'fisico', activo: true, estado_afiliadas: 'publicado' }
  options.productError = { detail: 'no-exponer' }
  const failed = await s.open(info.id); assert.equal(failed.status, 503); assert.ok(!JSON.stringify(await failed.json()).includes('no-exponer'))
  delete options.productError
  s.resources.set(recursoId, { id: recursoId, tipo: 'archivo', estado: 'publicado', url: info.url })
  assert.equal((await s.open(info.id)).status, 503)
})
