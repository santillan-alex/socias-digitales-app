/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in deps ? deps[name] : require(name), m, m.exports); return m.exports }
const accounts = load('src/lib/test-accounts.ts'), preguntas = load('src/lib/perfil-preguntas.ts')
const filters = load('src/lib/admin-usuarias.ts', { './test-accounts': accounts })
const profileLogic = load('src/lib/admin-profile-update.ts', { './perfil-preguntas': preguntas })
const id = '4b9892fe-2654-4f73-a98a-82b30a7a1001'
const base = { id, nombre: 'Prueba local', rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', pais: 'Argentina', whatsapp: null, desafio_socias_habilitada: false, socias_farmaci_habilitada: false, socias_farmasi_pendiente: false, desafio_socias_estado: 'no_aplica', created_at: '2026-10-20', ultimo_acceso: null, email: 'canonica@example.test', email_confirmado: true, cuenta_encontrada: true }
function ui({ alumnas = [base], errorDirectorio = false, solicitudesFarmasiPendientes = 0 } = {}) {
  const cells = []; let cursor = 0
  const hooks = { useState: initial => { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value }] }, useRef: initial => { const i = cursor++; if (!(i in cells)) cells[i] = { current: initial }; return cells[i] } }
  const Dashboard = load('src/app/admin/AdminDashboard.tsx', { react: hooks, './alumnas/FarmaciAccessControl': { default: ({ esSolicitud }) => require('react').createElement('div', null, esSolicitud ? 'Aceptar solicitud Farmasi' : 'Gestionar Farmasi') }, 'next/navigation': { useRouter: () => ({ refresh() {} }) }, '@/lib/supabase/client': { createClient: () => ({}) }, '@/lib/admin-profile-update': profileLogic, '@/lib/admin-usuarias': filters, '@/components/NavigationIcon': { default: () => null }, '@/components/AdminSectionMenu': { default: () => null }, '@/lib/admin-sections': { ADMIN_SECTIONS: [] } }).default
  const render = () => { cursor = 0; return Dashboard({ alumnas, errorDirectorio, stats: { totalAlumnas: alumnas.length, activas: alumnas.length, solicitudesDesafioPendientes: 0, solicitudesFarmasiPendientes, fechaReferencia: Date.now() } }) }
  function find(tree, predicate) { if (!tree || typeof tree !== 'object') return null; if (predicate(tree)) return tree; for (const child of [tree.props?.children].flat(Infinity)) { const r = find(child, predicate); if (r) return r } return null }
  const button = text => find(render(), n => n.type === 'button' && n.props.children === text)
  return { cells, render, find, button, html: () => require('react-dom/server').renderToStaticMarkup(render()) }
}
test('búsqueda combina email canónico, nombre y país con filtros y conserva exclusiones', () => {
  const filas = [base, { ...base, id: 'otra', nombre: 'María', pais: 'Chile', email: 'otra@example.test', tipo_usuario: 'socia', estado: 'pausada' }, { ...base, id: 'admin', rol: 'admin' }, { ...base, id: accounts.CUENTAS_PRUEBA_IDS[0] }]
  const originales = JSON.stringify(filas)
  const buscar = (busqueda, tipo = 'todas', estado = 'todas') => filters.filtrarUsuarias(filas, { busqueda, tipo, estado }).map(p => p.id)
  assert.deepEqual(buscar('  CANONICA@EXAMPLE.TEST '), [id]); assert.deepEqual(buscar('maría'), ['otra']); assert.deepEqual(buscar('CHILE'), ['otra'])
  assert.deepEqual(buscar('otra@example', 'socia', 'pausada'), ['otra']); assert.deepEqual(buscar('otra@example', 'socia', 'activa'), [])
  assert.deepEqual(buscar('canonica', 'socia'), []); assert.deepEqual(buscar('example.test'), [id, 'otra'])
  assert.equal(JSON.stringify(filas), originales)
})
test('correo y confirmación aparecen en móvil, tabla y ficha como consulta, sin acciones de envío', () => {
  const view = ui(), first = view.html()
  assert.equal((first.match(/canonica@example.test/g) || []).length, 2); assert.equal((first.match(/>Email confirmado</g) || []).length, 2)
  view.button('Ver ficha').props.onClick(); const modal = view.html()
  assert.match(modal, /Email de acceso · solo consulta/); assert.match(modal, /no acredita un pago/); assert.match(modal, /no se envían correos/)
  assert.equal((modal.match(/canonica@example.test/g) || []).length, 3)
  assert.ok(!modal.includes('type="email"')); assert.ok(!modal.includes('mailto:')); assert.ok(!modal.includes('clipboard'))
  assert.match(modal, /break-all/)
})
test('pendiente, cuenta no encontrada y estado desconocido no se confunden', () => {
  assert.match(ui({ alumnas: [{ ...base, email_confirmado: false }] }).html(), />Email sin confirmar</)
  const noCuenta = ui({ alumnas: [{ ...base, email: null, email_confirmado: null, cuenta_encontrada: false }] }).html()
  assert.match(noCuenta, /Cuenta de acceso no encontrada/); assert.ok(!noCuenta.includes('>Email sin confirmar<'))
  const desconocido = ui({ alumnas: [{ ...base, email: null, email_confirmado: null, cuenta_encontrada: null }] }).html()
  assert.match(desconocido, /Estado del email sin verificar/); assert.ok(!desconocido.includes('Cuenta de acceso no encontrada'))
  const anterior = { ...base }; delete anterior.email; delete anterior.email_confirmado; delete anterior.cuenta_encontrada
  assert.match(ui({ alumnas: [anterior] }).html(), /Estado del email sin verificar/)
})
test('fallo del directorio avisa, recarga realmente y no quita operaciones ni inventa confirmación', () => {
  const view = ui({ errorDirectorio: true }), html = view.html()
  assert.match(html, /role="alert"/); assert.match(html, /No pudimos consultar el directorio/); assert.match(html, /href="\/admin"[^>]*>Recargar directorio</)
  assert.ok(!html.includes('>Email confirmado<')); assert.ok(!html.includes('>Email sin confirmar<')); assert.match(html, /Estado del email sin verificar/)
  view.button('Ver ficha').props.onClick(); assert.ok(view.button('Guardar cambios')); assert.ok(view.button('🗑️ Eliminar alumna'))
})
test('emails de consulta nunca pasan al PATCH de permisos y una confirmación no activa Socias', async () => {
  const oldFetch = global.fetch; let payload
  global.fetch = async (_, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ ok: true, perfil: { id } }) } }
  try {
    const view = ui(); view.button('Ver ficha').props.onClick(); await view.button('Guardar cambios').props.onClick()
    assert.equal(payload.cambios.tipo_usuario, 'gratuito'); assert.equal(payload.cambios.estado, 'activa')
    for (const field of ['email', 'email_confirmado', 'cuenta_encontrada', 'password', 'rol']) assert.ok(!(field in payload.cambios))
    for (const field of ['email', 'email_confirmado', 'cuenta_encontrada', 'password']) assert.ok(!(field in payload.esperado))
  } finally { global.fetch = oldFetch }
})

test('dashboard distingue Farmasi en ambas vistas y permite aprobar desde ficha sin editar el plan base', async () => {
  const pendiente = { ...base, nombre: 'Solicitud ficticia', socias_farmasi_pendiente: true }
  const view = ui({ alumnas: [pendiente], solicitudesFarmasiPendientes: 1 })
  assert.match(view.html(), /aria-label="Ver Gratuitas: 0"/)
  assert.match(view.html(), /aria-label="Ver Farmasi pendientes: 1"/)
  assert.equal((view.html().match(/>Farmasi pendiente</g) || []).length, 2)
  assert.match(view.html(), /href="\/admin\/invitar#solicitudes-farmasi"/)
  view.button('Ver ficha').props.onClick()
  const modal = view.html()
  assert.match(modal, /Aceptar solicitud Farmasi/)
  assert.match(modal, /Sin plan general de Academia/)
  assert.doesNotMatch(modal, /id="ficha-tipo"/)
  assert.doesNotMatch(modal, />Gratuito</)
  const oldFetch = global.fetch; let payload
  global.fetch = async (_, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ ok: true, perfil: { id } }) } }
  try {
    await view.button('Guardar cambios').props.onClick()
    assert.equal(payload.cambios.tipo_usuario, 'gratuito')
    assert.equal(payload.esperado.tipo_usuario, 'gratuito')
    assert.equal(payload.cambios.socias_farmaci_habilitada, undefined)
    assert.equal(payload.cambios.socias_farmasi_pendiente, undefined)
  } finally { global.fetch = oldFetch }
})
test('dashboard Farmasi habilitada mantiene sus otros planes, advertencia explícita si solicitud no se comprueba', () => {
  const activa = ui({ alumnas: [{ ...base, socias_farmaci_habilitada: true }] }).html()
  assert.equal((activa.match(/>Socias Farmasi</g) || []).length, 3)
  assert.doesNotMatch(activa, />Gratuito</)
  const mixta = ui({ alumnas: [{ ...base, tipo_usuario: 'socia', socias_farmaci_habilitada: true }] }).html()
  assert.match(mixta, />Socias Farmasi</); assert.match(mixta, />Socia</)
  const desconocida = ui({ alumnas: [{ ...base, socias_farmasi_pendiente: null }], solicitudesFarmasiPendientes: null }).html()
  assert.match(desconocida, /Farmasi sin comprobar/); assert.match(desconocida, /Ver Gratuitas: sin comprobar/); assert.doesNotMatch(desconocida, />Gratuito</)
})
