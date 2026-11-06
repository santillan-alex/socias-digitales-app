/* eslint-disable @typescript-eslint/no-require-imports */
// Página privada con transporte aislado: no lee catálogo real ni concede accesos.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..'), pageFile = 'src/app/propuesta/afiliadas-productos/page.tsx'
function load(file, deps = {}, globals = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => Object.hasOwn(deps, n) ? deps[n] : require(n), m, m.exports, ...Object.values(globals))
  return m.exports
}
const classes = load('src/lib/class-management.ts')
const base = { id: '00000000-0000-4000-8000-000000000001', nombre: '  Producto local ficticio  ', descripcion: '  Descripción del catálogo  ', tipo: 'fisico', imagen_url: 'https://example.invalid/producto.jpg', precio: 99, moneda: 'USD', comision_pct: 20, link_compra: 'no-serializar-link', email: 'no-serializar@example.invalid', habilitada: true }
function fixture(options = {}) {
  const calls = [], Preview = () => React.createElement('section', null, 'Propuesta')
  const result = Object.hasOwn(options, 'result') ? options.result : { data: [base], error: null, count: 1 }
  const db = { from(table) {
    assert.equal(calls[0]?.[0], 'auth'); calls.push(['from', table]); assert.equal(table, 'productos')
    const builder = {
      select(...args) { calls.push(['select', ...args]); return builder }, eq(...args) { calls.push(['eq', ...args]); return builder }, order(...args) { calls.push(['order', ...args]); return builder }, limit(...args) { calls.push(['limit', ...args]); return builder },
      then(resolve, reject) { if (options.readThrow) return Promise.reject(options.readThrow).then(resolve, reject); return Promise.resolve(result).then(resolve, reject) },
    }
    for (const action of ['insert', 'update', 'upsert', 'delete']) builder[action] = () => { throw new Error('La propuesta no debe escribir ni habilitar') }
    return builder
  } }
  const auth = options.auth ?? { userId: 'admin-no-serializar', admin: true, supabase: db }
  const pageExports = load(pageFile, {
    'next/navigation': { redirect: href => { throw { redirect: href } }, unstable_rethrow: e => { if (e?.digest === 'NEXT_CONTROL') throw e } },
    '@/lib/affiliate-hub-server': { autorizarAfiliadas: async required => { calls.push(['auth', required]); assert.equal(required, true); if (options.authThrow) throw options.authThrow; return auth } },
    '@/lib/class-management': classes,
    '@/components/affiliate-commerce/CommerceStructurePreview': { default: Preview },
  })
  return { Page: pageExports.default, pageExports, Preview, calls }
}
test('propuesta requiere administración antes del catálogo: sin sesión, alumna y error no reciben productos', async () => {
  for (const [auth, destino] of [[{ error: { status: 401, mensaje: 'Sesión requerida' } }, '/login?next=%2Fpropuesta%2Fafiliadas-productos'], [{ error: { status: 403, mensaje: 'Equipo de Flor' } }, '/inicio'], [{ admin: false, userId: 'alumna' }, '/inicio']]) {
    const h = fixture({ auth }); await assert.rejects(h.Page(), e => e.redirect === destino); assert.deepEqual(h.calls, [['auth', true]])
  }
  const h = fixture({ auth: { error: { status: 503, mensaje: 'detalle-privado-no-serializar' }, supabase: { token: 'no-serializar' } } }), rendered = renderToStaticMarkup(await h.Page())
  assert.deepEqual(h.calls, [['auth', true]]); assert.ok(rendered.includes('role="alert"')); assert.ok(!rendered.includes('no-serializar')); assert.ok(!rendered.includes(base.nombre.trim()))
})
test('lee solo catálogo físico real y proyecta DTO público mínimo, sin permisos, precios, enlaces ni sesión', async () => {
  const h = fixture(), result = await h.Page()
  assert.equal(result.type, h.Preview); assert.deepEqual(Object.keys(result.props), ['productos'])
  assert.deepEqual(Object.keys(result.props.productos[0]).sort(), ['categoria', 'descripcion', 'detalles', 'id', 'imagenUrl', 'nombre', 'variantes'].sort())
  assert.equal(result.props.productos[0].nombre, base.nombre.trim()); assert.equal(result.props.productos[0].descripcion, base.descripcion.trim()); assert.deepEqual(result.props.productos[0].variantes, [])
  for (const forbidden of ['no-serializar', 'precio', 'moneda', 'comision_pct', 'habilitada', 'supabase', 'userId', 'link_compra', 'email']) assert.ok(!JSON.stringify(result.props).includes(forbidden), forbidden)
  assert.deepEqual(h.calls, [['auth', true], ['from', 'productos'], ['select', 'id,nombre,descripcion,tipo,imagen_url', { count: 'exact' }], ['eq', 'tipo', 'fisico'], ['order', 'orden'], ['order', 'id'], ['limit', 200]])
  assert.equal(h.pageExports.dynamic, 'force-dynamic'); assert.deepEqual(h.pageExports.metadata.robots, { index: false, follow: false })
})
test('fallo, count desconocido y lectura parcial no se convierten en una propuesta vacía', async () => {
  for (const result of [{ data: null, error: { message: 'detalle proveedor' }, count: null }, { data: [], error: null, count: null }, { data: [base], error: null, count: 2 }, { data: [base], error: null, count: '1' }, { data: Array(200).fill(base), error: null, count: 201 }]) {
    const h = fixture({ result }), node = await h.Page(), rendered = renderToStaticMarkup(node)
    assert.notEqual(node.type, h.Preview); assert.ok(rendered.includes('role="alert"')); assert.ok(rendered.includes('Reintentar')); assert.ok(!rendered.includes(base.nombre.trim())); assert.ok(!rendered.includes('detalle proveedor'))
  }
  const empty = fixture({ result: { data: [], error: null, count: 0 } }), node = await empty.Page(); assert.equal(node.type, empty.Preview); assert.deepEqual(node.props.productos, [])
})
test('fila inválida o repetida falla cerrada; imagen insegura no se entrega y descripción nula no inventa contenido', async () => {
  for (const row of [{ ...base, id: 'invalido' }, { ...base, nombre: ' ' }, { ...base, tipo: 'digital' }, { ...base, descripcion: {} }, { ...base, descripcion: 'x'.repeat(12001) }]) {
    const h = fixture({ result: { data: [row], count: 1, error: null } }); assert.notEqual((await h.Page()).type, h.Preview)
  }
  const duplicate = fixture({ result: { data: [base, base], count: 2, error: null } }); assert.notEqual((await duplicate.Page()).type, duplicate.Preview)
  for (const imagen_url of ['javascript:alert(1)', 'http://example.invalid/foto.jpg', 'https://user:password@example.invalid/foto.jpg', {}, null]) {
    const h = fixture({ result: { data: [{ ...base, imagen_url, descripcion: null }], count: 1, error: null } }), p = (await h.Page()).props.productos[0]
    assert.equal(p.imagenUrl, null); assert.equal(p.descripcion, ''); assert.deepEqual(p.detalles, [])
  }
})
test('excepciones de lectura muestran recuperación y señales de Next mantienen su control', async () => {
  const h = fixture({ readThrow: new Error('no-serializar-detalle') }), node = await h.Page(); assert.ok(!renderToStaticMarkup(node).includes('no-serializar'))
  const control = { digest: 'NEXT_CONTROL' }
  await assert.rejects(fixture({ readThrow: control }).Page(), e => e === control)
  await assert.rejects(fixture({ authThrow: control }).Page(), e => e === control)
})
test('propuesta no registra push ni consulta sesión aunque el permiso ya esté concedido o hubiera un prompt abierto', () => {
  for (const promptAbierto of [false, true]) {
    let state = 0; const effects = [], calls = []
    const hooks = { useState: value => [state++ === 0 && promptAbierto ? true : value, () => {}], useCallback: fn => fn, useEffect: fn => effects.push(fn) }
    const sideEffect = name => () => { calls.push(name); throw new Error('Sin efectos reales en propuesta') }
    const notification = { permission: 'granted', requestPermission: sideEffect('requestPermission') }
    const Push = load('src/components/PushNotifications.tsx', {
      react: hooks, 'next/navigation': { usePathname: () => '/propuesta/afiliadas-productos' },
      '@/lib/supabase/client': { createClient: sideEffect('auth') }, '@/lib/push-client': { registrarPush: sideEffect('registrarPush') },
    }, { navigator: { serviceWorker: {} }, window: { PushManager: function () {}, Notification: notification }, Notification: notification, localStorage: { getItem: sideEffect('storage') }, fetch: sideEffect('fetch') }).default
    assert.equal(Push(), null); for (const effect of effects) assert.equal(effect(), undefined); assert.deepEqual(calls, [])
  }
})
