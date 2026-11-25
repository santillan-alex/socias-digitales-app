/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), mod, mod.exports)
  return mod.exports
}
const preguntas = load('src/lib/perfil-preguntas.ts')
const logic = load('src/lib/admin-profile-update.ts', { './perfil-preguntas': preguntas })
const id = '4b9892fe-2654-4f73-a98a-82b30a7a1001'
const perfil = { id, nombre: 'Alumna', whatsapp: null, pais: 'Argentina', tipo_usuario: 'gratuito', estado: 'activa', rol: 'alumna', desafio_socias_habilitada: false, desafio_socias_estado: 'no_aplica', desafio_socias_habilitada_at: null, desafio_socias_habilitada_por: null }
const solicitud = (changes = {}, expected = {}) => ({ cambios: { nombre: 'Alumna', whatsapp: null, pais: 'Argentina', tipo_usuario: 'socia', estado: 'activa', ...changes }, esperado: { ...logic.versionFicha(perfil), ...expected } })
test('valida whitelist y normaliza nombre sin aceptar pago, permisos, metadata ni rol', () => {
  assert.equal(logic.validarCambioFicha(solicitud({ nombre: '  MARÍA  péREZ ' })).cambios.nombre, 'María Pérez')
  for (const input of [null, { ...solicitud(), rol: 'admin' }, { ...solicitud(), cambios: { ...solicitud().cambios, rol: 'admin' } }, { ...solicitud(), esperado: {} }, solicitud({ tipo_usuario: 'admin' }), solicitud({ estado: 'pagada' }), solicitud({ nombre: '' }), solicitud({ whatsapp: 'email@example.com' }), solicitud({ pais: 'x'.repeat(81) }), solicitud({}, { rol: 7 })]) assert.throws(() => logic.validarCambioFicha(input))
  assert.equal(logic.validarCambioFicha(solicitud({ whatsapp: '+54 351 123 4567', pais: '  Chile  ' })).cambios.pais, 'Chile')
})
test('cambia tipo sin borrar datos ni permisos individuales; suspensión no cambia rol o progreso', () => {
  const nuevo = logic.cambiosPerfil(solicitud().cambios, perfil)
  assert.equal(nuevo.rol, 'afiliada'); assert.equal(nuevo.desafio_socias_habilitada, false)
  const socia = { ...perfil, rol: 'afiliada_lanzamiento', tipo_usuario: 'socia' }
  const suspender = logic.cambiosPerfil(solicitud({ estado: 'pausada' }).cambios, socia)
  assert.equal(suspender.estado, 'pausada'); assert.ok(!('rol' in suspender)); assert.ok(!('desafio_socias_habilitada' in suspender))
  const bajar = logic.cambiosPerfil(solicitud({ tipo_usuario: 'gratuito' }).cambios, socia)
  assert.equal(bajar.rol, 'alumna'); assert.equal(bajar.desafio_socias_estado, 'no_aplica')
  for (const patch of [nuevo, suspender, bajar]) for (const key of ['plan', 'progreso', 'respuestas', 'acepta_email', 'pago', 'accesos_resultados']) assert.ok(!(key in patch))
  assert.equal(logic.mismaVersionFicha(perfil, logic.versionFicha(perfil)), true)
  assert.equal(logic.mismaVersionFicha({ ...perfil, estado: 'cancelada' }, logic.versionFicha(perfil)), false)
})
function fixture({ user = { id: 'actor' }, role = 'admin', target = { ...perfil }, actorError = null, readError = null, updateError = null, zero = false, race = false, wrong = false, network = false } = {}) {
  const writes = [], filters = [], original = target && { ...target }
  const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from: table => {
    assert.equal(table, 'perfiles')
    let op = 'read', fields, patch
    const q = {
      select: x => { fields = x; return q }, update: x => { op = 'update'; patch = x; return q },
      eq: (k, v) => { if (op === 'update') filters.push(['eq', k, v]); return q },
      neq: (k, v) => { filters.push(['neq', k, v]); return q }, is: (k, v) => { filters.push(['is', k, v]); return q },
      maybeSingle: async () => {
        if (fields === 'rol') return { data: { rol: role }, error: actorError }
        if (op === 'read') return { data: original, error: readError }
        if (network) throw new TypeError('network')
        writes.push(patch)
        if (updateError || zero || race) return { data: null, error: updateError }
        return { data: { ...target, ...patch, ...(wrong ? { estado: 'cancelada' } : {}) }, error: null }
      },
    }; return q
  } }
  const api = load('src/app/api/admin/usuarias/[id]/route.ts', {
    'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200, headers: opts.headers }) } },
    '@/lib/supabase/server': { createClient: async () => supabase }, '@/lib/admin-profile-update': logic,
    '@/lib/class-management': { esUuid: value => typeof value === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value) },
  })
  const request = (body = solicitud(), origin = 'https://app.test') => new Request('https://app.test/api/admin/usuarias/' + id, { method: 'PATCH', headers: { origin }, body: typeof body === 'string' ? body : JSON.stringify(body) })
  return { api, writes, filters, request, call: (body, origin) => api.PATCH(request(body, origin), { params: Promise.resolve({ id }) }) }
}
test('API exige sesión, admin real, origen, destino alumna y datos válidos antes de escribir', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ role: 'alumna' }, 403], [{ actorError: {} }, 503], [{ readError: {} }, 503], [{ target: null }, 404], [{ target: { ...perfil, rol: 'admin' } }, 403]]) {
    const f = fixture(options); assert.equal((await f.call()).status, status); assert.equal(f.writes.length, 0)
  }
  const f = fixture(); assert.equal((await f.call(undefined, 'https://other.test')).status, 403)
  assert.equal((await f.call({ ...solicitud(), user_metadata: { rol: 'admin' } })).status, 400)
  assert.equal((await f.call('x'.repeat(4001))).status, 413)
  assert.equal((await f.call('{')).status, 400); assert.equal(f.writes.length, 0)
})
test('API confirma fila persistida y protege snapshot en lectura y en UPDATE sin service role', async () => {
  const f = fixture(), response = await f.call()
  assert.equal(response.status, 200); assert.equal(response.body.ok, true); assert.equal(response.body.perfil.tipo_usuario, 'socia')
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
  assert.equal(f.writes.length, 1); assert.ok(f.filters.some(([op, k, v]) => op === 'neq' && k === 'rol' && v === 'admin'))
  for (const campo of logic.CAMPOS_VERSION_FICHA) assert.ok(f.filters.some(([, key, value]) => key === campo && value === perfil[campo]))
  const changed = fixture({ target: { ...perfil, estado: 'cancelada' } }); assert.equal((await changed.call()).status, 409); assert.equal(changed.writes.length, 0)
  for (const [options, status] of [[{ zero: true }, 409], [{ race: true }, 409], [{ updateError: {} }, 503], [{ wrong: true }, 503], [{ network: true }, 503]]) {
    const r = await fixture(options).call(); assert.equal(r.status, status); assert.ok(!r.body.ok)
  }
  const source = read('src/app/api/admin/usuarias/[id]/route.ts'); assert.ok(!source.includes('createAdminClient')); assert.ok(!source.includes('user_metadata'))
})

function uiFixture() {
  const cells = []; let cursor = 0; const refreshed = []
  const hooks = { useState: initial => { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value }] }, useRef: initial => { const i = cursor++; if (!(i in cells)) cells[i] = { current: initial }; return cells[i] } }
  const dashboard = load('src/app/admin/AdminDashboard.tsx', {
    react: hooks, './alumnas/FarmaciAccessControl': { default: () => null }, 'next/navigation': { useRouter: () => ({ refresh: () => refreshed.push(true) }) },
    '@/lib/supabase/client': { createClient: () => ({}) }, '@/lib/admin-profile-update': logic,
    '@/components/NavigationIcon': { default: () => null }, '@/components/AdminSectionMenu': { default: () => null },
    '@/lib/admin-sections': { ADMIN_SECTIONS: [] }, '@/lib/admin-usuarias': { TIPOS_ACCESO_PANEL: [{ id: 'gratuito', etiqueta: 'Gratuitas' }, { id: 'desafio', etiqueta: 'Desafío Socias' }, { id: 'socia', etiqueta: 'Socias' }], tipoAcceso: p => p.tipo_usuario || 'gratuito', estadoFarmasiPanel: () => 'sin_acceso', contarTiposPanel: () => ({ gratuito: 1, desafio: 0, socia: 0 }), filtrarUsuariasPanel: rows => rows },
  }).default
  const render = () => { cursor = 0; return dashboard({ alumnas: [{ ...perfil, created_at: '2026-10-20', ultimo_acceso: null }], stats: { totalAlumnas: 1, activas: 1, solicitudesDesafioPendientes: 0, solicitudesFarmasiPendientes: 0, fechaReferencia: Date.now() } }) }
  function find(tree, predicate) { if (!tree || typeof tree !== 'object') return null; if (predicate(tree)) return tree; for (const child of [tree.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result } return null }
  const button = label => find(render(), el => el.type === 'button' && el.props.children === label)
  button('Ver ficha').props.onClick()
  return { cells, render, button, find, refreshed }
}
test('UI conserva ficha ante HTTP/red/JSON fallidos, libera guardando y no duplica envíos', async () => {
  const old = global.fetch
  try {
    let resolve, calls = 0
    global.fetch = () => { calls++; return new Promise(r => { resolve = r }) }
    const ui = uiFixture(), guardar = ui.button('Guardar cambios').props.onClick
    const first = guardar(); await guardar(); assert.equal(calls, 1)
    resolve({ ok: false, json: async () => ({ error: 'Conflicto: recargá la ficha.' }) }); await first
    assert.equal(ui.cells[5], false); assert.ok(ui.cells[3]); assert.match(ui.cells[8], /Conflicto/); assert.equal(ui.refreshed.length, 0)
    for (const failure of [async () => { throw new TypeError('network') }, async () => ({ ok: true, json: async () => { throw new SyntaxError('html') } })]) {
      global.fetch = failure; await ui.button('Guardar cambios').props.onClick(); assert.equal(ui.cells[5], false); assert.ok(ui.cells[3]); assert.match(ui.cells[8], /No pudimos confirmar/)
    }
    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, perfil: { id } }) })
    await ui.button('Guardar cambios').props.onClick(); assert.equal(ui.cells[3], null); assert.equal(ui.refreshed.length, 1); assert.match(ui.cells[9], /no confirma un pago/)
  } finally { global.fetch = old }
})
test('UI no oculta ni afirma eliminación con fallo HTTP o red', async () => {
  const old = global.fetch
  try {
    const ui = uiFixture(); ui.button('🗑️ Eliminar alumna').props.onClick()
    for (const fail of [async () => ({ ok: false, json: async () => ({ error: 'No autorizado' }) }), async () => { throw new TypeError('network') }]) {
      global.fetch = fail; await ui.button('Sí, eliminar').props.onClick(); assert.ok(ui.cells[3]); assert.equal(ui.cells[6], false); assert.equal(ui.refreshed.length, 0); assert.ok(ui.cells[8])
    }
  } finally { global.fetch = old }
})
