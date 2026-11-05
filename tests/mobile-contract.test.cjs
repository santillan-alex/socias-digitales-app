/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function cargar(file, deps = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const link = { default: ({ prefetch, ...props }) => { void prefetch; return React.createElement('a', props) } }
const icon = { default: () => null }
test('navegación móvil: cinco destinos reales, ruta activa correcta y sin precargar avisos o alterar permisos', () => {
  for (const [ruta, destino] of [['/inicio','/inicio'],['/classroom/parte-1','/clases'],['/checklist','/checklist'],['/notificaciones','/notificaciones'],['/cuenta/contrasena','/perfil']]) {
    const Nav = cargar('src/components/MobileNavigation.tsx', { 'next/link': link, 'next/navigation': { usePathname: () => ruta }, './NavigationIcon': icon }).default
    const html = renderToStaticMarkup(React.createElement(Nav))
    assert.equal((html.match(/href=/g) || []).length, 5)
    assert.ok(html.includes(`href="${destino}" aria-current="page"`))
    assert.ok(html.includes('Navegación móvil'))
  }
  const src = read('src/components/MobileNavigation.tsx')
  assert.ok(src.includes('prefetch={false}')); assert.ok(!src.includes('fetch(')); assert.ok(!src.includes('supabase')); assert.ok(!src.includes('user_metadata'))
})
test('Flor dispone de diecinueve destinos desde el lateral y el diálogo móvil, sin pestañas horizontales', () => {
  const sections = cargar('src/lib/admin-sections.ts')
  const navigation = cargar('src/lib/admin-navigation.ts', { './admin-sections': sections })
  const Sidebar = cargar('src/components/AdminSidebar.tsx', { 'next/link': link, 'next/navigation': { usePathname: () => '/admin/checklist' }, './NavigationIcon': icon, '@/lib/admin-sections': sections, '@/lib/admin-navigation': navigation }).default
  const html = renderToStaticMarkup(React.createElement(Sidebar, { datos: { nombre: 'Flor', solicitudesPendientes: 2 } }))
  assert.equal(sections.ADMIN_SECTIONS.length, 19)
  for (const s of sections.ADMIN_SECTIONS) assert.ok(html.includes(`href="${s.href}"`))
  assert.ok(html.includes('href="/admin/alumnas"')); assert.ok(html.includes('Todas las alumnas'))
  assert.ok(html.includes('href="/admin/checklist" aria-current="page"'))
  assert.ok(html.includes('2 solicitudes pendientes'))
  assert.ok(html.includes('<summary')); assert.ok(html.includes('min-h-11'))
  const frame = read('src/components/AdminShellFrame.tsx'), adapter = read('src/components/AdminSectionMenu.tsx')
  assert.ok(frame.includes('<dialog')); assert.ok(frame.includes('aria-controls="sd-admin-menu-dialog"')); assert.ok(frame.includes('<AdminSidebar datos={datos} onNavigate={cerrarMenu}'))
  assert.ok(frame.includes('safe-area-inset-bottom')); assert.ok(frame.includes('100dvh')); assert.ok(frame.includes('onClose='))
  assert.ok(adapter.includes('dentroDelPanel ? null')); assert.ok(!adapter.includes('overflow-x-auto')); assert.ok(!adapter.includes('<select'))
})
test('contrato móvil conserva zoom, usa safe areas y no esconde desbordes para simular adaptación', () => {
  const layout = read('src/app/layout.tsx'), css = read('src/app/globals.css')
  assert.match(layout, /viewportFit: 'cover'/); assert.match(layout, /interactiveWidget: 'resizes-content'/)
  assert.ok(!layout.includes('userScalable: false')); assert.ok(!layout.includes('maximumScale: 1'))
  assert.match(css, /min-height: 44px/); assert.match(css, /font-size: 16px/); assert.match(css, /env\(safe-area-inset-bottom/)
  assert.ok(!css.includes('overflow-x: hidden')); assert.ok(!css.includes('zoom:'))
  assert.match(css, /\.sd-mobile-navigation \{ display: none; \}/)
  assert.match(css, /data-platform-role="admin"/)
})
test('formularios y módulos mantienen identidad y el teclado no tapa el cierre de ventanas', () => {
  const perfil = read('src/app/perfil/PerfilCliente.tsx'), clases = read('src/app/classroom/ClassroomCliente.tsx')
  assert.ok(perfil.includes('data-platform-role={esAdmin')); assert.ok(clases.includes('data-platform-role={esAdmin'))
  const reproductor = read('src/app/classroom/ClassPlayer.tsx')
  assert.ok(reproductor.includes('playsInline')); assert.ok(reproductor.includes('100dvh'))
  assert.ok(clases.includes('ClassPlayer'))
  for (const file of ['src/app/admin/AdminDashboard.tsx','src/app/admin/productos/ProductosAdmin.tsx','src/app/admin/classroom/ClassroomAdmin.tsx']) assert.ok(read(file).includes('100dvh'))
  assert.ok(read('src/components/PushNotifications.tsx').includes('sd-push-prompt'))
})
test('gráfico móvil mantiene información legible fuera del SVG y conserva acceso a los valores', () => {
  const src = read('src/components/MetricsVisuals.tsx')
  assert.ok(src.includes('Último registro ·')); assert.ok(src.includes('Ver valores del gráfico')); assert.ok(src.includes('hidden sm:block'))
  assert.ok(src.includes('font-impact text-xl font-semibold tabular-nums'))
})
test('nombres de campaña largos no fuerzan el ancho del selector ni de toda la página', () => {
  const src = read('src/app/metricas/MetricasCliente.tsx')
  assert.ok(src.includes('min-w-0 w-full text-xs text-[#746a64] sm:w-auto'))
  assert.ok(src.includes('mt-2 block w-full min-w-0 max-w-full'))
  const manifest = JSON.parse(read('public/manifest.json'))
  assert.equal(manifest.orientation, 'any')
})
test('fichas móviles usan los mismos filtros y acción que la tabla de escritorio', () => {
  const source = read('src/app/admin/AdminDashboard.tsx')
  assert.match(source, /aria-label="Alumnas en vista móvil"/)
  assert.match(source, /alumnasFiltradas\.map\(alumna => <article/)
  assert.match(source, /onClick=\{\(\) => abrirFicha\(alumna\)\}/)
  assert.ok(source.includes('hidden overflow-x-auto md:block'))
  assert.ok(source.includes('aria-label="Cerrar ficha"'))
  assert.ok(source.includes('sm:col-span-2'))
})
test('no se publican pantallas de prueba ni datos de muestra como plataforma real', () => {
  assert.ok(!fs.existsSync(path.join(__dirname,'../src/app/preview/mobile-qa/page.tsx')))
})
