/* eslint-disable @typescript-eslint/no-require-imports */
// Navegación derivada de permisos y SSR simulado; no sustituye navegador,
// autenticación real ni autorización de las páginas de destino.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const navigation = load('src/lib/student-navigation.ts')
const data = {
  nombre: 'Socia', formacion: true, comunidad: true,
  herramientas: { miDia: true, metricas: true, resultados: true, logros: true },
  ahoraInicial: Date.parse('2026-10-26T15:00:00Z'), hitos: [], errorAgenda: false,
  avisos: { cantidad: 1, ultimoTitulo: 'Encuentro', errorCarga: false },
}
const wrapper = ({ children }) => React.createElement(React.Fragment, null, children)
const link = { default: ({ prefetch, onClick, ...props }) => { void prefetch; void onClick; return React.createElement('a', props) } }
const icon = { default: () => React.createElement('span', { 'aria-hidden': true }) }
function components(pathname = '/inicio', react = React) {
  const notices = {
    UnreadNoticesProvider: wrapper,
    UnreadNoticeLink: ({ variante, activo }) => React.createElement('a', { href: '/notificaciones', 'aria-current': activo ? 'page' : undefined, 'data-variante': variante }, variante === 'menu' ? 'Notificaciones' : 'Avisos'),
  }
  const Sidebar = load('src/components/StudentSidebar.tsx', {
    'next/link': link, 'next/navigation': { usePathname: () => pathname.split(/[?#]/)[0], useSearchParams: () => new URLSearchParams(pathname.split('?')[1]?.split('#')[0] ?? '') },
    './NavigationIcon': icon, './UnreadNotices': notices,
    '@/app/inicio/ProximaClase': { default: ({ variante }) => React.createElement('div', { 'data-proximo-hito': variante }) },
    '@/lib/student-navigation': navigation,
  }).default
  const Mobile = load('src/components/MobileNavigation.tsx', {
    'next/link': link, 'next/navigation': { usePathname: () => pathname.split(/[?#]/)[0], useSearchParams: () => new URLSearchParams(pathname.split('?')[1]?.split('#')[0] ?? '') },
    './NavigationIcon': icon, '@/lib/student-navigation': navigation,
  }).default
  const Frame = load('src/components/StudentShellFrame.tsx', {
    react, 'next/link': link, 'next/navigation': { usePathname: () => pathname.split(/[?#]/)[0], useSearchParams: () => new URLSearchParams(pathname.split('?')[1]?.split('#')[0] ?? '') },
    '@/app/inicio/AgendaProvider': { AgendaProvider: wrapper }, './UnreadNotices': notices,
    './StudentSidebar': { default: Sidebar }, './MobileNavigation': { default: Mobile },
  }).default
  return { Sidebar, Frame }
}
test('rutas activas: material, reproductor y contraseña comparten la sección correcta; no colisionan prefijos', () => {
  const sections = [...navigation.seccionesPrincipalesEstudiante(data), ...navigation.herramientasEstudiante(data)]
  const cases = [
    ['/inicio', 'inicio'], ['/inicio/?mes=2026-11#mi-calendario', 'inicio'],
    ['/lanzamiento/etapa', 'estrategia'], ['/clases/materiales', 'programa'],
    ['/classroom?clase=privada', 'programa'], ['/classroom/reproductor/', 'programa'],
    ['/perfil', 'perfil'], ['/cuenta/contrasena', 'perfil'], ['/comunidad/archivo', 'comunidad'],
    ['/notificaciones/comunicado', 'notificaciones'], ['/checklist?fecha=2026-10-27', 'mi-dia'],
    ['/metricas/historial', 'metricas'], ['/resultados', 'resultados'], ['/logros', 'logros'],
  ]
  for (const [pathname, expected] of cases) {
    assert.deepEqual(sections.filter(section => navigation.activoSeccionEstudiante(pathname, section)).map(section => section.id), [expected], pathname)
  }
  for (const pathname of ['/classroom-ajeno', '/clases-extra', '/perfilado', '/admin', '/admin/comunidad', '/']) {
    assert.deepEqual(sections.filter(section => navigation.activoSeccionEstudiante(pathname, section)), [], pathname)
  }
})
test('Farmasi y biblioteca general tienen una sola sección activa, incluida la query duplicada del servidor', () => {
  const dual = { ...data, farmasi: true, conocerSocias: false }
  const sections = navigation.seccionesPrincipalesEstudiante(dual)
  for (const [route, expected] of [
    ['/classroom?espacio=farmasi', 'farmasi'],
    ['/classroom?clase=propia&espacio=farmasi', 'farmasi'],
    ['/classroom?espacio=farmasi&espacio=farmasi', 'programa'],
    ['/classroom?espacio=farmasi&espacio=otro', 'programa'],
    ['/classroom?espacio=otro', 'programa'], ['/classroom', 'programa'], ['/clases/materiales', 'programa'],
  ]) assert.deepEqual(sections.filter(section => navigation.activoSeccionEstudiante(route, section)).map(section => section.id), [expected], route)
  for (const [query, expected] of [['espacio=farmasi', 'farmasi'], ['espacio=farmasi&espacio=farmasi', 'programa']]) {
    assert.deepEqual(sections.filter(section => navigation.activoSeccionEstudiante('/classroom', section, query)).map(section => section.id), [expected])
  }
  const html = renderToStaticMarkup(React.createElement(components('/classroom?espacio=farmasi').Sidebar, { datos: dual }))
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1)
  assert.match(html, /href="\/classroom\?espacio=farmasi" aria-current="page"/)
})
test('Farmasi sola conserva menú, avisos y upgrade sin Estrategia, calendario o herramientas de Socias', () => {
  const propia = { ...data, formacion: false, farmasi: true, conocerSocias: true, comunidad: false, herramientas: { miDia: false, metricas: false, resultados: false, logros: false } }
  const { Frame } = components('/classroom?espacio=farmasi')
  const html = renderToStaticMarkup(React.createElement(Frame, { datos: propia, children: React.createElement('main', null, 'Aula propia') }))
  assert.match(html, /Menú y próximo encuentro/)
  assert.match(html, /Socias Farmasi/)
  assert.match(html, /Conocer Socias/)
  assert.match(html, /aria-controls="sd-student-navigation-dialog"/)
  for (const href of ['/lanzamiento', '/clases', '/comunidad', '/metricas', '/resultados', '/checklist', '/logros']) assert.ok(!html.includes(`href="${href}"`), href)
  assert.ok(!html.includes('data-proximo-hito'))
  const socia = renderToStaticMarkup(React.createElement(components('/classroom').Sidebar, { datos: { ...data, farmasi: true } }))
  assert.match(socia, /href="\/clases"/); assert.match(socia, /href="\/classroom\?espacio=farmasi"/)
  assert.doesNotMatch(socia, /Conocer Socias/)
})
test('herramientas y comunidad solo aparecen con sus indicadores autorizados, sin desbloquear otros módulos', () => {
  for (let bits = 0; bits < 16; bits++) {
    const flags = { miDia: Boolean(bits & 1), metricas: Boolean(bits & 2), resultados: Boolean(bits & 4), logros: Boolean(bits & 8) }
    const allowed = navigation.herramientasEstudiante({ ...data, herramientas: flags })
    assert.deepEqual(allowed.map(section => section.href), ['/checklist', '/metricas', '/resultados', '/logros'].filter((_, index) => bits & 2 ** index))
    assert.ok(allowed.every(section => section.href.startsWith('/') && !section.href.startsWith('//')))
  }
  for (const formacion of [false, true]) for (const comunidad of [false, true]) {
    const sections = navigation.seccionesPrincipalesEstudiante({ ...data, formacion, comunidad })
    assert.equal(sections.some(section => section.id === 'estrategia'), formacion)
    assert.equal(sections.some(section => section.id === 'comunidad'), comunidad)
    assert.deepEqual(sections.filter(section => ['inicio', 'programa', 'perfil', 'notificaciones'].includes(section.id)).map(section => section.id), ['inicio', 'programa', 'perfil', 'notificaciones'])
    for (const forbidden of ['/admin', '/productos', '/objetivos', '/ranking']) assert.ok(!sections.some(section => section.href === forbidden))
  }
})
test('lateral real SSR mantiene cada sección activa e iconos, contador y solo herramientas permitidas', () => {
  for (const [pathname, href] of [['/inicio', '/inicio'], ['/classroom', '/clases'], ['/clases/materiales', '/clases'], ['/cuenta/contrasena', '/perfil'], ['/comunidad', '/comunidad'], ['/notificaciones', '/notificaciones'], ['/metricas', '/metricas']]) {
    const { Sidebar } = components(pathname)
    const html = renderToStaticMarkup(React.createElement(Sidebar, { datos: data }))
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1, pathname)
    assert.ok(html.includes(`href="${href}" aria-current="page"`), pathname)
    assert.ok(html.includes('aria-label="Navegación principal"'))
    assert.ok(html.includes('aria-label="Herramientas de Socias"'))
    assert.equal((html.match(/data-proximo-hito="contador"/g) || []).length, 1)
    assert.ok(html.includes('aria-hidden="true"'))
  }
  const { Sidebar } = components('/inicio')
  const html = renderToStaticMarkup(React.createElement(Sidebar, { datos: { ...data, comunidad: false, herramientas: { miDia: false, metricas: false, resultados: false, logros: false } } }))
  assert.ok(!html.includes('href="/comunidad"')); assert.ok(!html.includes('Herramientas de Socias'))
  for (const href of ['/checklist', '/metricas', '/resultados', '/logros']) assert.ok(!html.includes(`href="${href}"`))
})
test('frame real conserva un encabezado sticky en móvil y escritorio sin fijar el main de la sección', () => {
  const { Frame } = components('/classroom')
  const html = renderToStaticMarkup(React.createElement(Frame, { datos: data }, React.createElement('main', { id: 'seccion' }, 'Clase')))
  assert.equal((html.match(/<header\b/g) || []).length, 1)
  assert.equal((html.match(/<main\b/g) || []).length, 1)
  assert.ok(html.includes('data-platform-role="member"'))
  assert.match(html, /<header[^>]*lg:sticky lg:top-0 lg:z-40/)
  const headerClasses = html.match(/<header[^>]*class="([^"]*)"/)?.[1].split(/\s+/) ?? []
  for (const value of ['sticky', 'top-0', 'z-40']) assert.ok(headerClasses.includes(value), `El encabezado móvil conserva ${value}`)
  assert.ok(!headerClasses.includes('fixed'))
  const aside = html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/)?.[1]
  assert.match(aside, /role="region" aria-label="Menú y próximo encuentro" tabindex="0"/)
  for (const value of ['lg:sticky', 'lg:top-[104px]', 'lg:max-h-[calc(100dvh-132px)]', 'lg:overflow-y-auto', 'focus-visible:outline-2']) assert.ok(aside.includes(value))
  assert.ok(!html.match(/<main[^>]*>/)?.[0].includes('sticky'))
  assert.equal((html.match(/aria-label="Navegación principal"/g) || []).length, 1)
})
test('menú móvil accesible usa diálogo nativo cerrado, acciones grandes, altura dinámica y safe-area sin segundo muro de enlaces', () => {
  const { Frame } = components('/comunidad')
  const html = renderToStaticMarkup(React.createElement(Frame, { datos: data }, React.createElement('main', null, 'Muro')))
  assert.match(html, /aria-haspopup="dialog" aria-controls="sd-student-navigation-dialog" aria-expanded="false"/)
  const menuControl = html.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/)?.[0]
  for (const value of ['min-h-11', 'lg:hidden', 'focus-visible:outline-2', 'focus-visible:outline-offset-4']) assert.ok(menuControl.includes(value))
  assert.ok(html.includes('sr-only sm:not-sr-only">Menú</span>'))
  assert.match(html, /<dialog[^>]*id="sd-student-navigation-dialog" aria-labelledby="sd-student-navigation-title"/)
  assert.ok(!html.match(/<dialog[^>]*>/)?.[0].includes(' open'))
  assert.ok(html.includes('100dvh')); assert.ok(html.includes('env(safe-area-inset-bottom'))
  assert.match(html, /<button[^>]*autofocus=""[^>]*min-h-11[^>]*>Cerrar<\/button>/)
  assert.equal((html.match(/href="\/comunidad"/g) || []).length, 1)
  const source = read('src/components/StudentShellFrame.tsx')
  for (const feature of ['showModal()', "'(min-width: 1024px)'", "addEventListener('change'", "removeEventListener('change'", '[pathname]', 'onClose', 'onNavigate={cerrarMenu}']) assert.ok(source.includes(feature))
  for (const forbidden of ['window.location', 'localStorage', 'user_metadata', 'supabase', 'createAdminClient', 'fetch(']) assert.ok(!source.includes(forbidden))
})
test('sin formación no agrega menú o diálogo persistente ni cambia el contenido del recorrido restringido', () => {
  const { Frame } = components('/inicio')
  const html = renderToStaticMarkup(React.createElement(Frame, { datos: { ...data, formacion: false } }, React.createElement('main', null, 'Acceso en revisión')))
  assert.ok(html.includes('Acceso en revisión')); assert.equal((html.match(/<main\b/g) || []).length, 1)
  assert.ok(!html.includes('<aside')); assert.ok(!html.includes('<dialog')); assert.ok(!html.includes('aria-haspopup'))
  assert.ok(!html.match(/<header[^>]*>/)?.[0].includes('sticky'))
  assert.ok(html.includes('href="/perfil"')); assert.ok(html.includes('href="/notificaciones"'))
})
test('contrato móvil protege el avatar y la fila del encabezado frente a reglas globales de enlaces y menús', () => {
  const { Frame } = components('/comunidad')
  const html = renderToStaticMarkup(React.createElement(Frame, { datos: data }, React.createElement('main', null, 'Muro')))
  const avatar = html.match(/<a[^>]*aria-label="Mi perfil"[^>]*>/)?.[0]
  assert.ok(avatar.includes('data-student-mobile-avatar="hidden"'))
  const restricted = renderToStaticMarkup(React.createElement(Frame, { datos: { ...data, formacion: false } }, React.createElement('main', null, 'Perfil')))
  assert.ok(!restricted.includes('data-student-mobile-avatar="hidden"'))
  const css = read('src/app/globals.css')
  const mobile = css.slice(css.indexOf('@media (max-width: 639px) {'), css.indexOf('@media (max-width: 359px) {'))
  // El selector de tres clases/atributos gana a la regla global de enlaces.
  assert.match(mobile, /\.platform-design\s+\.sd-student-shell__header\s+\[data-student-mobile-avatar="hidden"\]\s*\{\s*display:\s*none\s*;/)
  // La regla global de wrap tiene especificidad (0,3,1). La anulación acotada
  // iguala ese peso, conserva el elemento header y aparece después.
  const nowrap = mobile.match(/\.platform-design\s+\.sd-student-shell\s+header\.sd-student-shell__header\s*\{\s*flex-wrap:\s*nowrap\s*;/)
  assert.ok(nowrap)
  const generalWrap = mobile.indexOf('.platform-design :is(header, nav):not(.sd-mobile-navigation):not(.sd-admin-section-menu)')
  assert.ok(generalWrap >= 0)
  assert.ok(nowrap.index > generalWrap)
})
test('enlaces principales y de herramientas conservan filas de ancho completo aunque el CSS móvil general use inline-flex', () => {
  const { Sidebar } = components('/comunidad')
  const html = renderToStaticMarkup(React.createElement(Sidebar, { datos: data }))
  const menus = [...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)]
  assert.equal(menus.length, 2)
  for (const menu of menus) {
    assert.ok(menu[1].includes('data-student-menu="true"'))
    assert.ok(menu[2].includes('<a '))
  }
  assert.ok(menus[0][1].includes('Navegación principal'))
  assert.ok(menus[0][2].includes('href="/notificaciones"'))
  assert.ok(menus[1][1].includes('Herramientas de Socias'))
  const core = renderToStaticMarkup(React.createElement(Sidebar, { datos: { ...data, herramientas: { miDia: false, metricas: false, resultados: false, logros: false } } }))
  assert.equal((core.match(/<nav\b/g) || []).length, 1)
  assert.equal((core.match(/data-student-menu="true"/g) || []).length, 1)
  const css = read('src/app/globals.css')
  assert.match(css, /\.platform-design\s+:is\(header,\s*nav\)\s+a\s*\{\s*display:\s*inline-flex\s*;/)
  // (0,3,2) supera al selector global (0,1,2), aunque este aparezca después.
  // display:flex crea una caja de bloque, no la fila inline de ancho intrínseco.
  assert.match(css, /\.platform-design\s+\.sd-student-shell\s+nav\[data-student-menu\]\s+a\s*\{\s*display:\s*flex\s*;/)
})
test('navegación programática deja margen al encabezado sticky sin cambiar el scroll de vistas ajenas al marco', () => {
  const css = read('src/app/globals.css')
  assert.match(css, /\.sd-student-shell\s+\.scroll-mt-5,\s*\.sd-student-shell\s+#reprogramar-titulo\s*\{\s*scroll-margin-top:\s*96px\s*;/)
  assert.ok(read('src/app/metricas/MetricasCliente.tsx').includes('scroll-mt-5'))
  const checklist = read('src/app/checklist/ChecklistCliente.tsx')
  assert.ok(checklist.includes('scroll-mt-5')); assert.ok(checklist.includes('id="reprogramar-titulo"'))
})
function descendants(node, match) {
  if (node === null || node === undefined || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => descendants(child, match))
  return [...(match(node) ? [node] : []), ...descendants(node.props?.children, match)]
}
test('acciones de menú abren una sola vez, cierran por enlace/Escape y reaccionan a ruta o escritorio sin guardar datos', () => {
  const events = [], effects = []
  const modal = { open: false, showModal() { events.push('abrir'); this.open = true }, close() { events.push('cerrar'); this.open = false } }
  let state = false
  const react = { ...React,
    useRef: () => ({ current: modal }),
    useState: () => [state, next => { state = next }],
    useEffect: callback => { effects.push(callback) },
  }
  const { Frame } = components('/comunidad', react)
  let tree = Frame({ datos: data, children: React.createElement('main', null, 'Muro') })
  const opener = () => descendants(tree, node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog')[0]
  const dialog = () => descendants(tree, node => node.type === 'dialog')[0]
  opener().props.onClick(); opener().props.onClick()
  assert.deepEqual(events, ['abrir']); assert.equal(state, true)
  tree = Frame({ datos: data, children: null })
  assert.equal(opener().props['aria-expanded'], true)
  const mobileSidebar = descendants(tree, node => typeof node.props?.onNavigate === 'function')[0]
  mobileSidebar.props.onNavigate(); assert.equal(modal.open, false)
  // Cierre nativo (también Escape) actualiza aria-expanded mediante onClose.
  dialog().props.onClose(); assert.equal(state, false)
  opener().props.onClick(); assert.equal(modal.open, true)
  effects[0](); assert.equal(modal.open, false)
  const media = { matches: false, addEventListener: (name, listener) => { assert.equal(name, 'change'); media.listener = listener }, removeEventListener: (name, listener) => { assert.equal(name, 'change'); assert.equal(listener, media.listener); events.push('retirar-escucha') } }
  const previousWindow = global.window
  global.window = { matchMedia: query => { assert.equal(query, '(min-width: 1024px)'); return media } }
  try {
    const cleanup = effects[1]()
    opener().props.onClick(); assert.equal(modal.open, true)
    media.listener(); assert.equal(modal.open, true)
    media.matches = true; media.listener(); assert.equal(modal.open, false)
    cleanup(); assert.equal(events.at(-1), 'retirar-escucha')
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
})
