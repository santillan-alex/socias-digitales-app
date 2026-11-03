/* eslint-disable @typescript-eslint/no-require-imports */
// SSR y eventos aislados. La aceptación de foco real/viewport corresponde al navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}, env = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', 'window', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports, env.window); return m.exports }
const sections = load('src/lib/admin-sections.ts'), navigation = load('src/lib/admin-navigation.ts', { './admin-sections': sections }), datos = { nombre: 'Flor', solicitudesPendientes: 4 }
const Link = ({ prefetch, children, ...p }) => { void prefetch; return React.createElement('a', p, children) }
const icon = { default: () => React.createElement('span', { 'data-icon': true, 'aria-hidden': true }) }
function sidebar(ruta = '/admin', react = React) { return load('src/components/AdminSidebar.tsx', { react, 'next/link': { default: Link }, 'next/navigation': { usePathname: () => ruta }, './NavigationIcon': icon, '@/lib/admin-sections': sections, '@/lib/admin-navigation': navigation }).default }
function nodes(node) { if (!node || typeof node !== 'object') return []; return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)] }
function by(tree, pred) { const node = nodes(tree).find(pred); assert.ok(node, 'Control esperado ausente'); return node }
const label = n => React.Children.toArray(n.props.children).filter(c => typeof c === 'string').join('')
function frame(options = {}) {
  const states = [], refs = [], effects = [], events = [], pushes = []; const media = { matches: false, addEventListener: (e, fn) => events.push({ e, fn }), removeEventListener: (e, fn) => events.push({ removed: e, fn }) }; let si = 0, ri = 0, pathname = '/admin'
  const hooks = { ...React, useState(v) { const i = si++; if (!(i in states)) states[i] = typeof v === 'function' ? v() : v; return [states[i], n => { states[i] = typeof n === 'function' ? n(states[i]) : n }] }, useRef(v) { const i = ri++; return refs[i] ??= { current: v } }, useEffect(fn) { effects.push(fn) } }
  const Sidebar = sidebar('/admin/afiliadas/accesos')
  const api = load('src/components/AdminShellFrame.tsx', { react: hooks, 'next/link': { default: Link }, 'next/image': { default: props => React.createElement('img', props) }, 'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push: p => pushes.push(p), refresh: () => pushes.push('refresh') }) }, '@/lib/supabase/client': { createClient: () => ({ auth: { signOut: options.signOut ?? (async () => ({ error: null })) } }) }, './AdminSidebar': { default: Sidebar } }, { window: { matchMedia: () => media } })
  const render = () => { si = 0; ri = 0; effects.length = 0; return api.default({ datos, children: React.createElement('main', null, 'Contenido operativo') }) }
  const tree = render(), dialog = by(tree, n => n.type === 'dialog'); let opened = 0, closed = 0
  dialog.props.ref.current = { open: false, showModal() { this.open = true; opened++ }, close() { this.open = false; closed++; dialog.props.onClose() } }
  return { api, render, refs, effects, events, pushes, media, open: () => opened, close: () => closed, route: p => { pathname = p } }
}
test('dieciocho secciones únicas y activos correctos sin colisiones ni raíces duplicadas', () => {
  const grouped = navigation.ADMIN_NAVIGATION_GROUPS.flatMap(g => navigation.seccionesGrupoAdmin(g.rutas)).map(s => s.href)
  const all = ['/admin', ...grouped, '/admin/configuracion']; assert.equal(all.length, 18); assert.equal(new Set(all).size, 18); assert.deepEqual([...all].sort(), sections.ADMIN_SECTIONS.map(s => s.href).sort())
  for (const [ruta, esperado] of [['/admin', '/admin'], ['/admin/?x=1', '/admin'], ['/admin/afiliadas/accesos?x=1', '/admin/afiliadas'], ['/admin/classroom/editar/', '/admin/classroom'], ['/admin/checklist', '/admin/checklist'], ['/admin/afiliadas-ajeno', null], ['/inicio', null], ['/administracion', null]]) assert.equal(navigation.seccionAdminActiva(ruta), esperado)
})
test('sidebar conserva dieciocho links, iconos, grupo activo abierto y badge real en todas las secciones', () => {
  for (const s of sections.ADMIN_SECTIONS) {
    const Sidebar = sidebar(s.href), html = renderToStaticMarkup(React.createElement(Sidebar, { datos }))
    assert.equal((html.match(/href=/g) ?? []).length, 18); assert.equal((html.match(/data-icon=/g) ?? []).length, 18); assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1)
    assert.ok(html.includes(`href="${s.href}" aria-current="page"`)); assert.ok(html.includes('4 solicitudes pendientes')); assert.ok(html.includes('group-open:hidden')); assert.ok(!html.includes('<select')); assert.ok(!html.includes('overflow-x'))
    const grupo = navigation.ADMIN_NAVIGATION_GROUPS.find(g => g.rutas.includes(s.href)); assert.equal((html.match(/<details open=""/g) ?? []).length, grupo ? 1 : 0)
    for (const section of sections.ADMIN_SECTIONS) assert.ok(html.includes(`href="${section.href}"`))
  }
  const Sidebar = sidebar(); const zero = renderToStaticMarkup(React.createElement(Sidebar, { datos: { ...datos, solicitudesPendientes: 0 } })); assert.ok(!zero.includes('solicitudes pendientes'))
  const unknown = renderToStaticMarkup(React.createElement(Sidebar, { datos: { ...datos, solicitudesPendientes: null } })); assert.ok(unknown.includes('Solicitudes pendientes sin comprobar'))
})
test('marco único: encabezado, sidebar sticky y diálogo cerrado sin repetir navegación ni tocar el main', () => {
  const h = frame(), html = renderToStaticMarkup(h.render())
  assert.equal((html.match(/<header/g) ?? []).length, 1); assert.equal((html.match(/<main/g) ?? []).length, 1); assert.equal((html.match(/<aside/g) ?? []).length, 1); assert.equal((html.match(/href="\/admin\/invitar"/g) ?? []).length, 1)
  assert.ok(html.includes('Contenido operativo')); assert.ok(html.includes('data-platform-role="admin"')); assert.ok(html.includes('aria-expanded="false"')); assert.ok(!html.includes('<dialog open'))
  assert.ok(html.includes('lg:sticky lg:top-[100px]')); assert.ok(html.includes('lg:max-h-[calc(100dvh-124px)]')); assert.ok(html.includes('lg:overflow-y-auto')); assert.ok(html.includes('safe-area-inset-bottom')); assert.ok(html.includes('safe-area-inset-top'))
  assert.ok(html.includes('Ir al contenido')); assert.ok(html.includes('Menú de administración')); assert.ok(html.includes('data-admin-desktop="true"'))
})
test('menú móvil abre una vez, incluye las dieciocho rutas y cierra por enlace, ruta y escritorio', () => {
  const h = frame(); let tree = h.render(), open = by(tree, n => n.type === 'button' && n.props['aria-controls'] === 'sd-admin-menu-dialog').props.onClick
  open(); open(); assert.equal(h.open(), 1); tree = h.render(); assert.equal(by(tree, n => n.type === 'button' && n.props['aria-controls']).props['aria-expanded'], true)
  const mobile = by(tree, n => typeof n.type === 'function' && typeof n.props.onNavigate === 'function'); const html = renderToStaticMarkup(React.createElement(mobile.type, mobile.props)); for (const s of sections.ADMIN_SECTIONS) assert.ok(html.includes(`href="${s.href}"`))
  mobile.props.onNavigate(); assert.equal(h.close(), 1); assert.equal(by(h.render(), n => n.type === 'button' && n.props['aria-controls']).props['aria-expanded'], false)
  open(); h.route('/admin/socias'); h.render(); h.effects[0](); assert.equal(h.close(), 2)
  open(); h.render(); const cleanup = h.effects[1](); assert.equal(typeof cleanup, 'function'); h.events[0].fn(); assert.equal(h.close(), 2); h.media.matches = true; h.events[0].fn(); assert.equal(h.close(), 3); cleanup(); assert.equal(h.events[1].removed, 'change')
  const dialog = by(h.render(), n => n.type === 'dialog'); assert.equal(dialog.props.onCancel, undefined); assert.ok(by(dialog, n => n.type === 'button' && label(n) === 'Cerrar').props.autoFocus)
})
test('cerrar sesión bloquea doble clic y navega solamente tras confirmación; error se anuncia sin éxito falso', async () => {
  let resolve, calls = 0
  const h = frame({ signOut: () => { calls++; return new Promise(r => { resolve = r }) } }), button = by(h.render(), n => n.type === 'button' && label(n) === 'Cerrar sesión')
  button.props.onClick(); button.props.onClick(); assert.equal(calls, 1); assert.deepEqual(h.pushes, [])
  resolve({ error: new Error('falló') }); await new Promise(r => setImmediate(r)); assert.deepEqual(h.pushes, []); assert.ok(renderToStaticMarkup(h.render()).includes('No pudimos cerrar la sesión'))
  const ok = frame(); by(ok.render(), n => n.type === 'button' && label(n) === 'Cerrar sesión').props.onClick(); await new Promise(r => setImmediate(r)); assert.deepEqual(ok.pushes, ['/login', 'refresh'])
})
test('adaptador no duplica navegación dentro del marco; cabeceras de acciones y formularios siguen presentes', () => {
  for (const inside of [false, true]) {
    const Menu = load('src/components/AdminSectionMenu.tsx', { './AdminSidebar': { default: () => React.createElement('nav', null, '18 rutas') }, './AdminShellFrame': { useAdminShell: () => inside } }).default
    assert.equal(renderToStaticMarkup(React.createElement(Menu)).includes('18 rutas'), !inside)
  }
  const dashboard = read('src/app/admin/AdminDashboard.tsx'); assert.ok(!dashboard.includes('<aside')); assert.ok(!dashboard.includes('<header')); assert.ok(!dashboard.includes('<AdminSectionMenu')); assert.ok(dashboard.includes('aria-label="Cerrar ficha"')); assert.ok(dashboard.includes('guardarFicha'))
  for (const file of ['src/app/admin/classroom/ClassroomAdmin.tsx', 'src/app/admin/productos/ProductosAdmin.tsx', 'src/app/admin/notificaciones/NotificacionesAdmin.tsx', 'src/app/admin/configuracion/ConfiguracionAdmin.tsx']) assert.ok(!read(file).includes('data-admin-section-header'))
  for (const file of ['src/components/AdminShellFrame.tsx', 'src/components/AdminSidebar.tsx']) { const source = read(file); assert.ok(source.includes('min-h-11')); assert.ok(!source.includes('backdrop-blur')); assert.ok(!source.includes('overflow-x-auto')); assert.ok(source.includes('#E7DDD5')) }
  const header = read('src/components/AdminShellFrame.tsx'); assert.ok(header.includes('aria-haspopup="dialog"')); assert.ok(header.includes('onClose=')); assert.ok(!header.includes('preventDefault()'))
})
