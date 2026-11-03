/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports); return m.exports }
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
const logic = load('src/lib/affiliate-access-client.ts', { './class-management': load('src/lib/class-management.ts') })
class CrmError extends Error { constructor(status, mensaje) { super(mensaje); this.status = status } }
function harness({ activo = true, adminTarget = false, failRead = false, failWrite = false, lostResponse = false, seed = null } = {}) {
  let row = seed, writes = 0
  const calls = []
  const db = { from: table => {
    calls.push(table)
    let op = 'select', body = null
    const query = {
      select() { return query }, eq(key, value) { if (key === 'usuaria_id' || key === 'id') assert.equal(value, ids[0]); return query },
      insert(value) { op = 'insert'; body = value; return query }, update(value) { op = 'update'; body = value; return query },
      async maybeSingle() {
        if (table === 'perfiles') return { data: { id: ids[0], rol: adminTarget ? 'admin' : 'alumna', estado: activo ? 'activa' : 'pausada' }, error: null }
        assert.equal(table, 'accesos_afiliadas')
        if (op === 'select') return failRead ? { data: null, error: {} } : { data: row, error: null }
        writes++
        if (failWrite) return { data: null, error: { code: 'XX000' } }
        row = { usuaria_id: ids[0], habilitada: body.habilitada, version: op === 'insert' ? 1 : row.version + 1, actualizada_en: '2026-11-02T18:00:00Z' }
        return lostResponse ? { data: null, error: { code: 'network' } } : { data: row, error: null }
      },
    }; return query
  } }
  const api = load('src/lib/affiliate-access-server.ts', {
    'server-only': {}, 'next/navigation': { unstable_rethrow() {} }, './supabase/server': {}, './class-management': load('src/lib/class-management.ts'), './test-accounts': { esCuentaPrueba: () => false }, './affiliate-access-client': logic,
    './resource-crm-server': { ErrorRecursosCrm: CrmError, autorizarRecursosCrm: async () => ({ supabase: db, userId: ids[1] }), leerJsonCrm: r => r.json(), responderCrm: (body, status = 200) => Response.json(body, { status }), ejecutarCrm: async (_req, mutation, fn) => { assert.equal(mutation, true); try { return await fn({ supabase: db, userId: ids[1] }) } catch (e) { return Response.json({ error: e.message }, { status: e.status || 503 }) } } },
  })
  const request = (body, id = ids[0]) => api.cambiarAccesoAfiliadas(new Request('https://app.sociasdigitales.com/api/admin/afiliadas/accesos/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: 'https://app.sociasdigitales.com' }, body: JSON.stringify(body) }), id)
  return { api, db, calls, request, row: () => row, writes: () => writes }
}
test('permiso de presentación exige cuenta activa y fila explícita válida, nunca rol afiliada heredado', async () => {
  const h = harness(), perfil = { rol: 'afiliada', estado: 'activa' }
  assert.deepEqual(await h.api.leerAccesoAfiliadas(h.db, ids[0], perfil), { habilitada: false, error: false })
  const habilitada = harness({ seed: { usuaria_id: ids[0], habilitada: true, version: 1, actualizada_en: '2026-11-02T18:00:00Z' } })
  assert.deepEqual(await habilitada.api.leerAccesoAfiliadas(habilitada.db, ids[0], { rol: 'alumna', estado: 'activa' }), { habilitada: true, error: false })
  for (const p of [null, { rol: 'admin', estado: 'activa' }, { rol: 'alumna', estado: 'pausada' }, { rol: 'alumna' }]) {
    const v = harness(); assert.deepEqual(await v.api.leerAccesoAfiliadas(v.db, ids[0], p), { habilitada: false, error: false }); assert.equal(v.calls.length, 0)
  }
  const fallida = harness({ failRead: true }); assert.deepEqual(await fallida.api.leerAccesoAfiliadas(fallida.db, ids[0], perfil), { habilitada: false, error: true })
  const ajena = harness({ seed: { usuaria_id: ids[1], habilitada: true, version: 1, actualizada_en: '2026-11-02T18:00:00Z' } }); assert.deepEqual(await ajena.api.leerAccesoAfiliadas(ajena.db, ids[0], perfil), { habilitada: false, error: true })
})
test('habilitar, retirar y recuperar respuestas perdidas conserva solo el permiso independiente y su versión', async () => {
  for (const lostResponse of [false, true]) {
    const h = harness({ lostResponse })
    assert.equal((await h.request({ habilitada: true, version: null })).status, 200)
    assert.equal((await h.request({ habilitada: true, version: null })).status, 200)
    assert.equal(h.writes(), 1); assert.equal(h.row().habilitada, true)
    assert.equal((await h.request({ habilitada: false, version: 1 })).status, 200)
    assert.equal((await h.request({ habilitada: false, version: 1 })).status, 200)
    assert.equal(h.writes(), 2); assert.equal(h.row().version, 2); assert.equal(h.row().habilitada, false)
    assert.ok(h.calls.every(t => ['perfiles', 'accesos_afiliadas'].includes(t)))
  }
})
test('conflictos, cuentas pausadas, admin y solicitudes inválidas no cambian permisos', async () => {
  for (const body of [{ habilitada: true, version: 0 }, { habilitada: 'true', version: null }, { habilitada: true, version: null, rol: 'admin' }, { habilitada: true }]) {
    const h = harness(); assert.equal((await h.request(body)).status, 400); assert.equal(h.writes(), 0)
  }
  const pausada = harness({ activo: false }); assert.equal((await pausada.request({ habilitada: true, version: null })).status, 409); assert.equal(pausada.writes(), 0)
  const admin = harness({ adminTarget: true }); assert.equal((await admin.request({ habilitada: true, version: null })).status, 404); assert.equal(admin.writes(), 0)
  const actual = { usuaria_id: ids[0], habilitada: true, version: 3, actualizada_en: '2026-11-02T18:00:00Z' }
  const conflicto = harness({ seed: actual }); assert.equal((await conflicto.request({ habilitada: false, version: 1 })).status, 409); assert.equal(conflicto.writes(), 0)
  const revocar = harness({ activo: false, seed: actual }); assert.equal((await revocar.request({ habilitada: false, version: 3 })).status, 200)
  const noGuardada = harness({ failWrite: true }); assert.equal((await noGuardada.request({ habilitada: true, version: null })).status, 503)
})
test('DTO de acceso rechaza UUID, booleanos, versiones y fechas incoherentes', () => {
  const base = { usuaria_id: ids[0], habilitada: true, version: 1, actualizada_en: '2026-11-02T18:00:00Z' }
  assert.equal(logic.esAccesoAfiliadas(base), true)
  for (const bad of [null, {}, { ...base, usuaria_id: 'ajena' }, { ...base, habilitada: 1 }, { ...base, version: 0 }, { ...base, actualizada_en: 'ayer' }]) assert.equal(logic.esAccesoAfiliadas(bad), false)
})
test('UI administrativa vacía o fallida no inventa usuarias, permiso o un guardado exitoso', () => {
  const UI = load('src/app/admin/afiliadas/accesos/AfiliadasAccesos.tsx', { 'next/link': { default: ({ children, ...p }) => React.createElement('a', p, children) }, 'next/navigation': { useRouter: () => ({ refresh() {} }) }, '@/components/AdminSectionMenu': { default: () => null }, '@/lib/affiliate-access-client': logic }).default
  for (const inicial of [{ estado: 'lista', cuentas: [], limitado: false }, { estado: 'error', mensaje: 'No pudimos comprobar los permisos.' }]) {
    const html = renderToStaticMarkup(React.createElement(UI, { inicial }))
    assert.ok(html.includes('Accesos de Afiliadas'))
    assert.equal(html.includes('0 cuentas revisadas'), inicial.estado === 'lista')
    assert.equal(html.includes('role="alert"'), inicial.estado === 'error')
    assert.ok(!html.includes('Acceso a Afiliadas habilitado.'))
  }
})
test('el controlador de permisos conserva guardas centrales, sesión propia y no cambia perfiles', () => {
  const source = read('src/lib/affiliate-access-server.ts')
  assert.ok(source.startsWith("import 'server-only'")); assert.ok(source.includes('ejecutarCrm(request, true'))
  for (const s of ['createAdminClient', 'user_metadata', 'process.env', "from('perfiles').update", "from('perfiles').insert"]) assert.ok(!source.includes(s))
  const route = read('src/app/api/admin/afiliadas/accesos/[id]/route.ts'); assert.ok(route.includes('await context.params')); assert.ok(route.includes('export async function PATCH'))
})

test('lectura de servidor igual o más reciente prevalece sobre permisos locales al recuperar conflictos', () => {
  const acceso = { usuaria_id: ids[0], habilitada: true, version: 1, actualizada_en: '2026-11-02T18:00:00Z' }
  const cuenta = { id: ids[0], nombre: 'Socia', tipo: 'socia', estado: 'activa', prueba: false, acceso: null }
  assert.deepEqual(logic.aplicarAccesoConfirmado(cuenta, acceso).acceso, acceso)
  const reciente = { ...cuenta, acceso: { ...acceso, habilitada: false, version: 2 } }
  assert.equal(logic.aplicarAccesoConfirmado(reciente, acceso), reciente)
  const igual = { ...cuenta, acceso }
  assert.equal(logic.aplicarAccesoConfirmado(igual, acceso), igual)
  assert.equal(logic.aplicarAccesoConfirmado(cuenta, { ...acceso, usuaria_id: ids[1] }), cuenta)
})
