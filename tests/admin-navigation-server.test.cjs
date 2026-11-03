/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports); return m.exports }
const control = { digest: 'NEXT_DYNAMIC' }, uid = '00000000-0000-4000-8000-000000000001'
function reader(options = {}) {
  const calls = []
  const db = { auth: { getUser: async () => { if (options.authThrow) throw options.authThrow; return { data: { user: options.user === undefined ? { id: uid, user_metadata: { rol: 'admin' } } : options.user }, error: options.authError ?? null } } }, from: table => {
    const q = { table, filters: [] }, chain = { select(fields, opts) { q.fields = fields; q.opts = opts; return chain }, eq(k, v) { q.filters.push(['eq', k, v]); return chain }, neq(k, v) { q.filters.push(['neq', k, v]); return chain }, not(k, op, v) { q.filters.push(['not', k, op, v]); return chain }, maybeSingle() { return run() }, then(resolve, reject) { return run().then(resolve, reject) } }
    async function run() {
      calls.push(q); assert.equal(table, 'perfiles')
      if (q.opts?.head) { if (options.countThrow) throw options.countThrow; return { count: options.count === undefined ? 3 : options.count, error: options.countError ?? null } }
      if (options.profileThrow) throw options.profileThrow
      return { data: options.profile === undefined ? { id: uid, nombre: ' Flor Schauman ', rol: 'admin' } : options.profile, error: options.profileError ?? null }
    }
    return chain
  } }
  const api = load('src/lib/admin-navigation-server.ts', { 'next/navigation': { unstable_rethrow: e => { if (e?.digest === control.digest) throw e } }, './supabase/server': { createClient: async () => db }, './test-accounts': { FILTRO_CUENTAS_PRUEBA: '(prueba)' } })
  return { ...api, calls }
}
test('marco admin verifica Auth y perfil propio; metadata, roles alumna y errores no entregan navegación', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ authError: {} }, 401], [{ authThrow: new Error() }, 503], [{ profile: null }, 503], [{ profileError: {} }, 503], [{ profileThrow: new Error() }, 503], [{ profile: { id: 'ajena', rol: 'admin' } }, 503], [{ profile: { id: uid, rol: 'afiliada' } }, 403], [{ profile: { id: uid, rol: 'alumna' } }, 403]]) {
    const h = reader(options), result = await h.leerNavegacionAdmin()
    assert.equal(result.estado, 'error'); assert.equal(result.status, status); assert.ok(!Object.hasOwn(result, 'datos')); assert.ok(!h.calls.some(q => q.opts?.head))
  }
  const h = reader(), result = await h.leerNavegacionAdmin()
  assert.deepEqual(result, { estado: 'lista', datos: { nombre: 'Flor', solicitudesPendientes: 3 } })
  assert.deepEqual(h.calls[0].filters, [['eq', 'id', uid]])
  assert.deepEqual(Object.keys(result.datos).sort(), ['nombre', 'solicitudesPendientes'])
})
test('badge usa cantidad real de solicitudes pendientes, excluye admin y prueba, error no se convierte en cero', async () => {
  const h = reader({ count: 0 }); assert.equal((await h.leerNavegacionAdmin()).datos.solicitudesPendientes, 0)
  const q = h.calls[1]; assert.deepEqual(q.opts, { count: 'exact', head: true }); assert.deepEqual(q.filters, [['not', 'id', 'in', '(prueba)'], ['neq', 'rol', 'admin'], ['eq', 'tipo_usuario', 'desafio'], ['eq', 'desafio_socias_estado', 'pendiente'], ['eq', 'desafio_socias_habilitada', false]])
  for (const options of [{ count: null }, { count: -1 }, { count: '3' }, { count: 1.2 }, { countError: {} }, { countThrow: new Error() }]) assert.equal((await reader(options).leerNavegacionAdmin()).datos.solicitudesPendientes, null)
  for (const nombre of [null, '', ' ', 8]) assert.equal((await reader({ profile: { id: uid, rol: 'admin', nombre } }).leerNavegacionAdmin()).datos.nombre, 'Administradora')
  for (const options of [{ authThrow: control }, { profileThrow: control }, { countThrow: control }]) await assert.rejects(reader(options).leerNavegacionAdmin(), e => e === control)
})
test('layout envuelve todas las rutas admin; denegado o desconocido no renderiza el contenido privado', async () => {
  const datos = { nombre: 'Flor', solicitudesPendientes: 0 }
  for (const lectura of [{ estado: 'lista', datos }, { estado: 'error', status: 401, mensaje: 'Sesión requerida' }, { estado: 'error', status: 403, mensaje: 'Sin permiso' }, { estado: 'error', status: 503, mensaje: 'Acceso sin comprobar' }]) {
    const Layout = load('src/app/admin/layout.tsx', { 'next/navigation': { redirect: href => { throw { redirect: href } } }, '@/lib/admin-navigation-server': { leerNavegacionAdmin: async () => lectura }, '@/components/AdminShellFrame': { default: ({ datos: passed, children }) => { assert.equal(passed, datos); return React.createElement('div', { 'data-admin-shell': true }, children) } } }).default
    if (lectura.status === 401 || lectura.status === 403) await assert.rejects(Layout({ children: 'PRIVADO' }), e => e.redirect === (lectura.status === 401 ? '/login' : '/inicio'))
    else { const html = renderToStaticMarkup(await Layout({ children: React.createElement('main', null, 'PRIVADO') })); assert.equal(html.includes('PRIVADO'), lectura.estado === 'lista'); assert.equal(html.includes('role="alert"'), lectura.estado === 'error') }
  }
  const source = read('src/lib/admin-navigation-server.ts')
  for (const bad of ['createAdminClient', 'user_metadata', 'process.env', '.update(', '.insert(', 'unstable_cache']) assert.ok(!source.includes(bad))
  assert.ok(read('src/app/admin/page.tsx').includes("perfil?.rol !== 'admin'")); assert.ok(read('src/lib/affiliate-hub-server.ts').includes('autorizarAfiliadas'))
})
