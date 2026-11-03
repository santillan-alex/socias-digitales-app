/* eslint-disable @typescript-eslint/no-require-imports */
// Dobles aislados: verifican contratos API/servidor; no reemplazan aceptación SQL/RLS real.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports); return m.exports }
const d = load('src/lib/affiliate-hub.ts'), uid = '00000000-0000-4000-8000-000000000010', id = '00000000-0000-4000-8000-000000000001'
const management = load('src/lib/class-management.ts'), materials = load('src/lib/class-materials.ts', { './class-management': management })
const files = load('src/lib/affiliate-files.ts', { './class-materials': materials, './affiliate-hub': d })
const fileServer = load('src/lib/affiliate-files-server.ts', { './affiliate-files': files, './affiliate-hub': d, './class-materials': materials, './r2-upload': load('src/lib/r2-upload.ts', { './class-management': management }) })
const datos = { titulo: 'Mensaje de práctica aislado', cuerpo: 'Un copy de prueba local.', tipo: 'copy', campana: null, url: null, estado: 'publicado', destacado: false }
const fila = { id, ...datos, version: 1, creado_en: '2026-11-02T12:00:00.123456+00:00', actualizado_en: '2026-11-02T12:00:00.123456+00:00' }
function fixture(options = {}) {
  const calls = [], rows = structuredClone(options.rows ?? [fila])
  const db = { auth: { getUser: async () => ({ data: { user: options.user === undefined ? { id: uid, user_metadata: { rol: 'admin', afiliada: true } } : options.user }, error: options.authError ?? null }) }, from(table) {
    const q = { table, action: 'read', filters: [], sorts: [] }
    const b = { select(fields) { q.fields = fields; return b }, eq(k, v) { q.filters.push([k, v]); return b }, order(k, v) { q.sorts.push([k, v]); return b }, limit(n) { q.limit = n; return b }, insert(value) { q.action = 'insert'; q.value = value; return b }, update(value) { q.action = 'update'; q.value = value; return b }, maybeSingle() { q.single = true; return run() }, then(resolve, reject) { return run().then(resolve, reject) } }
    async function run() {
      calls.push(structuredClone(q))
      if (table === 'perfiles') return { data: options.profile === undefined ? { id: uid, rol: 'alumna', estado: 'activa' } : options.profile, error: options.profileError ?? null }
      if (table === 'accesos_afiliadas') return { data: options.access === undefined ? { usuaria_id: uid, habilitada: true } : options.access, error: options.accessError ?? null }
      assert.equal(table, 'recursos_afiliadas')
      if (options.readError && q.action === 'read') return { data: null, error: { message: 'No difundir detalle privado.' } }
      let data = rows.filter(r => q.filters.every(([k, v]) => r[k] === v))
      if (q.action !== 'read') {
        if (options.writeError && !options.committed) return { data: null, error: options.writeError }
        if (q.action === 'insert') {
          if (rows.some(r => r.id === q.value.id)) return { data: null, error: { code: '23505' } }
          const row = { ...fila, ...q.value }; rows.push(row); data = [row]
        } else {
          if (options.conflict) { if (data[0]) data[0].version += 2; return { data: null, error: null } }
          data.forEach(r => Object.assign(r, q.value, { version: r.version + 1 }))
        }
        if (options.committed) return { data: null, error: { code: 'respuesta_perdida' } }
      }
      if (q.limit) data = data.slice(0, q.limit)
      return { data: q.single ? data[0] ?? null : data, error: null }
    }
    return b
  } }
  const api = load('src/lib/affiliate-hub-server.ts', { 'next/navigation': { unstable_rethrow: e => { if (e?.digest === 'NEXT_CONTROL') throw e } }, './supabase/server': { createClient: async () => { if (options.control) throw options.control; return db } }, './affiliate-hub': d, './metrics': load('src/lib/metrics.ts'), './affiliate-files-server': fileServer })
  return { api, calls, rows, auth: { supabase: db, userId: uid, admin: true } }
}
test('Auth y perfil propio se comprueban; rol legacy, metadata y falta de fila no habilitan Afiliadas', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ authError: {} }, 401], [{ profile: null }, 503], [{ profileError: {} }, 503], [{ profile: { id, rol: 'admin', estado: 'activa' } }, 503], [{ profile: { id: uid, rol: 'afiliada', estado: 'activa' }, access: null }, 403], [{ profile: { id: uid, rol: 'alumna', estado: 'pausada' } }, 403], [{ access: { usuaria_id: id, habilitada: true } }, 403], [{ access: { usuaria_id: uid, habilitada: 'true' } }, 403], [{ accessError: {} }, 503]]) {
    const f = fixture(options), result = await f.api.autorizarAfiliadas(); assert.equal(result.error.status, status); assert.ok(!Object.hasOwn(result, 'supabase')); assert.ok(!f.calls.some(c => c.table === 'recursos_afiliadas'))
  }
  const f = fixture(), result = await f.api.autorizarAfiliadas(); assert.equal(result.userId, uid); assert.equal(result.admin, false)
  assert.deepEqual(f.calls[0].filters, [['id', uid]]); assert.deepEqual(f.calls[1].filters, [['usuaria_id', uid]])
})
test('admin requiere rol protegido y las señales dinámicas de Next no se convierten en error corriente', async () => {
  const denied = fixture(); assert.equal((await denied.api.autorizarAfiliadas(true)).error.status, 403); assert.equal(denied.calls.length, 1)
  const admin = fixture({ profile: { id: uid, rol: 'admin', estado: 'activa' } }); assert.equal((await admin.api.autorizarAfiliadas(true)).admin, true); assert.equal(admin.calls.length, 1)
  const control = { digest: 'NEXT_CONTROL' }, f = fixture({ control }); await assert.rejects(f.api.autorizarAfiliadas(), e => e === control)
})
test('catálogo público pide solo publicados, DTO sin auditoría, con límite honesto y fallos distintos de vacío', async () => {
  const f = fixture({ rows: [{ ...fila, autora_id: uid, secreto: 'privado' }, { ...fila, id: uid, estado: 'borrador' }] }), alumno = { ...f.auth, admin: false }
  const result = await f.api.leerRecursosAfiliadas(alumno); assert.equal(result.estado, 'lista'); assert.equal(result.recursos.length, 1); assert.ok(!JSON.stringify(result).includes('privado')); assert.ok(!Object.hasOwn(result.recursos[0], 'autora_id'))
  assert.ok(f.calls[0].filters.some(([k, v]) => k === 'estado' && v === 'publicado')); assert.equal(f.calls[0].limit, 201)
  const empty = fixture({ rows: [] }); assert.deepEqual(await empty.api.leerRecursosAfiliadas(empty.auth), { estado: 'lista', recursos: [], limitado: false })
  const fail = fixture({ readError: true }); assert.equal((await fail.api.leerRecursosAfiliadas(fail.auth)).estado, 'error')
  const invalid = fixture({ rows: [{ ...fila, version: 0 }] }); assert.equal((await invalid.api.leerRecursosAfiliadas(invalid.auth)).estado, 'error')
  const many = fixture({ rows: Array.from({ length: 201 }, (_, n) => ({ ...fila, id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` })) }); const limited = await many.api.leerRecursosAfiliadas(many.auth); assert.equal(limited.recursos.length, 200); assert.equal(limited.limitado, true)
})
test('crear y editar recuperan respuesta perdida sin duplicar y siempre comparan versión', async () => {
  for (const committed of [false, true]) {
    const f = fixture({ rows: [], committed }), entrada = d.validarEntradaAfiliada({ id, recurso: datos })
    const saved = await f.api.guardarRecursoAfiliadas(f.auth, entrada); assert.equal(saved.version, 1); assert.deepEqual(await f.api.guardarRecursoAfiliadas(f.auth, entrada), saved); assert.equal(f.rows.length, 1)
    const edit = d.validarEntradaAfiliada({ id, version: 1, recurso: { ...datos, estado: 'archivado' } }, true)
    const archived = await f.api.guardarRecursoAfiliadas(f.auth, edit, true); assert.equal(archived.version, 2); assert.equal(archived.estado, 'archivado'); assert.deepEqual(await f.api.guardarRecursoAfiliadas(f.auth, edit, true), archived)
    assert.ok(f.calls.find(c => c.action === 'update').filters.some(([k, v]) => k === 'version' && v === 1))
  }
  const f = fixture({ conflict: true }); await assert.rejects(f.api.guardarRecursoAfiliadas(f.auth, { id, version: 1, datos }, true), e => e.status === 409)
  await assert.rejects(f.api.guardarRecursoAfiliadas({ ...f.auth, admin: false }, { id, datos }), e => e.status === 403)
  const missing = fixture({ rows: [] }); await assert.rejects(missing.api.guardarRecursoAfiliadas(missing.auth, { id, version: 1, datos }, true), e => e.status === 404)
})
test('mismo UUID con contenido distinto no se sobrescribe y fallos no afirman éxito', async () => {
  const f = fixture(); await assert.rejects(f.api.guardarRecursoAfiliadas(f.auth, { id, datos: { ...datos, titulo: 'Otro título' } }), e => e.status === 409)
  const fail = fixture({ rows: [], writeError: { code: 'conexion' } }); await assert.rejects(fail.api.guardarRecursoAfiliadas(fail.auth, { id, datos }), e => e.status === 503); assert.equal(fail.rows.length, 0)
})
test('API privada protege admin, parámetros, origen, tipos y body acotado antes de mutar', async () => {
  const f = fixture({ rows: [], profile: { id: uid, rol: 'admin', estado: 'activa' } }), deps = { '@/lib/affiliate-hub-server': f.api, '@/lib/affiliate-hub': d }
  const admin = load('src/app/api/admin/afiliadas/route.ts', deps), item = load('src/app/api/admin/afiliadas/[id]/route.ts', deps)
  const make = (body, origin = 'https://app.example.invalid', contentType = 'application/json') => new Request('https://app.example.invalid/api/admin/afiliadas', { method: 'POST', headers: { origin, 'Content-Type': contentType }, body: JSON.stringify(body) })
  assert.equal((await admin.POST(make({ id, recurso: datos }, 'https://otra.example.invalid'))).status, 403)
  assert.equal((await admin.POST(make({ id, recurso: datos }, 'https://app.example.invalid', 'text/plain'))).status, 415)
  assert.equal((await admin.POST(make('x'.repeat(66000)))).status, 413)
  assert.equal((await admin.POST(make({ id, recurso: { ...datos, autora_id: uid } }))).status, 400)
  const saved = await admin.POST(make({ id, recurso: datos })); assert.equal(saved.status, 200); assert.equal(saved.headers.get('cache-control'), 'private, no-store'); assert.equal((await saved.json()).recurso.id, id)
  const updated = await item.PATCH(new Request('https://app.example.invalid/api/admin/afiliadas/' + id, { method: 'PATCH', headers: { origin: 'https://app.example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, recurso: { ...datos, estado: 'borrador' } }) }), { params: Promise.resolve({ id }) }); assert.equal(updated.status, 200)
  const student = fixture({ profile: { id: uid, rol: 'alumna', estado: 'activa' } }), studentDeps = { '@/lib/affiliate-hub-server': student.api, '@/lib/affiliate-hub': d }, publicApi = load('src/app/api/afiliadas/route.ts', studentDeps), deniedAdmin = load('src/app/api/admin/afiliadas/route.ts', studentDeps)
  assert.equal((await deniedAdmin.GET(new Request('https://app.example.invalid/api/admin/afiliadas'))).status, 403)
  assert.equal((await publicApi.GET(new Request('https://app.example.invalid/api/afiliadas?usuaria_id=' + uid))).status, 400)
  const denied = fixture({ access: null }), deniedApi = load('src/app/api/afiliadas/route.ts', { '@/lib/affiliate-hub-server': denied.api }); const response = await deniedApi.GET(new Request('https://app.example.invalid/api/afiliadas')); assert.equal(response.status, 403); assert.ok(!JSON.stringify(await response.json()).includes(datos.cuerpo))
})
test('API acepta URL interna de Next solo con Host y Origin correctos; rechaza externos y ausentes', async () => {
  const f = fixture({ rows: [], profile: { id: uid, rol: 'admin', estado: 'activa' } }), deps = { '@/lib/affiliate-hub-server': f.api, '@/lib/affiliate-hub': d }
  const admin = load('src/app/api/admin/afiliadas/route.ts', deps), item = load('src/app/api/admin/afiliadas/[id]/route.ts', deps)
  const make = (body, origin = 'https://app.example.invalid', method = 'POST') => new Request('https://localhost:3000/api/admin/afiliadas' + (method === 'PATCH' ? '/' + id : ''), { method, headers: { ...(origin === null ? {} : { Origin: origin }), Host: 'app.example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  for (const origin of [null, 'null', 'https://otra.example.invalid', 'http://app.example.invalid', 'https://app.example.invalid:4433']) {
    assert.equal((await admin.POST(make({ id, recurso: datos }, origin))).status, 403)
    assert.equal((await item.PATCH(make({ version: 1, recurso: datos }, origin, 'PATCH'), { params: Promise.resolve({ id }) })).status, 403)
    await assert.rejects(f.api.leerJsonAfiliadas(make({ id, recurso: datos }, origin)), e => e.status === 403)
  }
  assert.equal(f.calls.length, 0)
  assert.equal(f.api.origenSolicitudAfiliadas(make({ id, recurso: datos })), true)
  assert.equal((await admin.POST(make({ id, recurso: datos }))).status, 200)
  const updated = await item.PATCH(make({ version: 1, recurso: { ...datos, estado: 'archivado' } }, 'https://app.example.invalid', 'PATCH'), { params: Promise.resolve({ id }) })
  assert.equal(updated.status, 200); assert.equal((await updated.json()).recurso.version, 2)
})
