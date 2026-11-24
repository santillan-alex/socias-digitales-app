/* eslint-disable @typescript-eslint/no-require-imports */
// Datos ficticios y componentes con hooks simulados. No reemplaza QA de navegador ni E2E.
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
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : n === '@/lib/farmasi-registration' ? load('src/lib/farmasi-registration.ts') : require(n), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const progress = load('src/lib/class-progress.ts')
const filters = load('src/lib/class-library-filters.ts', { './class-management': management })
const access = load('src/lib/class-access.ts')
const base = { id: 'a', titulo: 'Elegí tu nicho', descripcion: null, modulo: 'Desafío Socias', orden: 0, activo: true, puede_ver: true, vimeo_url: 'https://vimeo.com/123', tiene_video_privado: false, plan: '27' }
const clases = [base, { ...base, id: 'b', titulo: 'Producto ganador', orden: 1 }, { ...base, id: 'c', titulo: 'Apoyo Hotmart', modulo: 'Desafío Socias › Material de apoyo' }, { ...base, id: 'bloqueada', titulo: 'Privada', puede_ver: false }, { ...base, id: 'sin-video', titulo: 'En preparación', vimeo_url: null }, { ...base, id: 'oculta', activo: false }]
const avance = (id, cambios = {}) => ({ clase_id: id, posicion_seg: 0, duracion_seg: 100, completada: false, actualizado_en: '2026-10-23T12:00:00Z', ...cambios })
const registros = [avance('a', { completada: true, posicion_seg: 5 }), avance('b', { posicion_seg: 20 }), avance('bloqueada', { completada: true }), avance('sin-video', { posicion_seg: 30 }), avance('oculta', { completada: true })]
test('los estados particionan solo clases publicadas y reproducibles; bloqueadas no son pendientes ni desbloquean', () => {
  const result = filters.filtrarBibliotecaClases([...clases, base], registros, { tieneAcceso: true })
  assert.deepEqual(result.conteos, { todas: 3, pendiente: 1, en_curso: 1, completada: 1 })
  assert.equal(result.bloqueadas, 2)
  assert.deepEqual(result.idsVisibles, ['a', 'b', 'c', 'bloqueada', 'sin-video'])
  for (const [estado, ids] of [['completada', ['a']], ['en_curso', ['b']], ['pendiente', ['c']]]) {
    const filtered = filters.filtrarBibliotecaClases(clases, registros, { avance: estado, tieneAcceso: true })
    assert.deepEqual(filtered.idsVisibles, ids)
    assert.deepEqual(filtered.conteos, result.conteos)
  }
  assert.equal(clases[3].puede_ver, false)
  assert.equal(filters.claseDisponibleBiblioteca({ ...base, puede_ver: undefined }, false), false)
  assert.equal(filters.claseDisponibleBiblioteca({ ...base, puede_ver: false }, true), false)
  assert.equal(filters.claseDisponibleBiblioteca({ ...base, vimeo_url: null, tiene_video_privado: true }), true)
})
test('programa y búsqueda normalizada acotan los conteos, no el chip activo; no alteran sus entradas', () => {
  const originalClases = structuredClone(clases), originalRegistros = structuredClone(registros)
  const result = filters.filtrarBibliotecaClases(clases, registros, { programa: 'Desafío Socias', buscar: '  ELEGI TU NICHO  ', avance: 'pendiente' })
  assert.deepEqual(result.conteos, { todas: 1, pendiente: 0, en_curso: 0, completada: 1 })
  assert.deepEqual(result.idsVisibles, [])
  assert.equal(result.filtrosActivos, true)
  assert.equal(filters.filtrarBibliotecaClases(clases, registros, { buscar: '   ' }).filtrosActivos, false)
  assert.deepEqual(filters.filtrarBibliotecaClases(clases, registros, { programa: 'Bienvenida' }).idsVisibles, [])
  assert.deepEqual(clases, originalClases); assert.deepEqual(registros, originalRegistros)
})
test('completada prevalece al minuto; Vimeo sin minuto queda pendiente; duplicados usan la última lectura sin inflar', () => {
  assert.equal(filters.estadoAvanceClase(avance('a', { completada: true, posicion_seg: 30 })), 'completada')
  assert.equal(filters.estadoAvanceClase(avance('a', { posicion_seg: Infinity })), 'pendiente')
  assert.equal(filters.estadoAvanceClase(), 'pendiente')
  const newer = avance('a', { actualizado_en: '2026-10-23T13:00:00Z', posicion_seg: 20 })
  for (const rows of [[registros[0], newer], [newer, registros[0]]]) {
    const result = filters.filtrarBibliotecaClases([base], rows)
    assert.deepEqual(result.conteos, { todas: 1, pendiente: 0, en_curso: 1, completada: 0 })
  }
})
test('un error de progreso es desconocido, no cero, incluso con filas parciales y un filtro solicitado', () => {
  const result = filters.filtrarBibliotecaClases(clases, registros, { errorProgreso: true, avance: 'completada' })
  assert.deepEqual(result.conteos, { todas: 3, pendiente: null, en_curso: null, completada: null })
  assert.deepEqual(result.idsVisibles, ['a', 'b', 'c', 'bloqueada', 'sin-video'])
  assert.equal(result.filtrosActivos, false)
})
const Program = load('src/app/classroom/ClassroomProgram.tsx', {
  '@/lib/class-management': management, '@/lib/class-progress': progress, '@/lib/class-library-filters': filters,
  '@/components/ClassVideoThumbnail': { default: props => React.createElement('span', { 'data-poster': props.id }) },
}).default
function all(node, predicate) { if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))] }
function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); return !node || typeof node !== 'object' ? '' : [node.props?.children].flat(Infinity).map(text).join('') }
function ui(props = {}) {
  const cells = []; let cursor = 0
  const Player = () => null
  const Classroom = load('src/app/classroom/ClassroomCliente.tsx', {
    react: { ...React, useCallback: callback => callback, useEffect() {}, useRef: initial => { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] }, useState: initial => { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }] } },
    '@/components/SociasUpgradePanel': { default: () => null }, './ClassPlayer': { default: Player }, './ClassroomProgram': { default: Program },
    '@/lib/class-management': management, '@/lib/class-progress': progress, '@/lib/class-access': access, '@/lib/class-library-filters': filters,
  }).default
  const render = () => { cursor = 0; return Classroom({ clases: clases.filter(clase => clase.activo), esAdmin: false, perfil: { rol: 'alumna', estado: 'activa', tipo_usuario: 'socia' }, progresoInicial: registros, ...props }) }
  return {
    render, html: () => renderToStaticMarkup(render()),
    buttons: () => all(render(), node => node.type === 'button'),
    button: label => all(render(), node => node.type === 'button').find(node => text(node).startsWith(label)),
    search: () => all(render(), node => node.type === 'input' && node.props.type === 'search')[0],
    select: () => all(render(), node => node.type === 'select')[0],
    programs: () => all(render(), node => node.type === Program),
    player: () => all(render(), node => node.type === Player)[0],
  }
}
test('chips filtran por IDs con conteos estables y Limpiar filtros restaura la biblioteca', () => {
  const view = ui()
  view.button('Pendientes').props.onClick()
  assert.deepEqual(view.programs()[0].props.idsVisibles, ['c'])
  assert.equal(view.programs()[0].props.clases.length, clases.filter(clase => clase.activo).length)
  assert.match(view.html(), /aria-pressed="true"[^>]*>[\s\S]*?Pendientes/)
  view.search().props.onChange({ target: { value: 'producto inexistente' } })
  assert.equal(view.programs().length, 0)
  assert.match(view.html(), /No hay clases que coincidan/)
  view.select().props.onChange({ target: { value: 'Desafío Socias' } })
  view.button('Limpiar filtros').props.onClick()
  assert.equal(view.search().props.value, '')
  assert.equal(view.select().props.value, 'Todos')
  assert.deepEqual(view.programs()[0].props.idsVisibles, ['a', 'b', 'c', 'bloqueada', 'sin-video'])
  assert.equal(view.button('Limpiar filtros'), undefined)
})
test('búsqueda y estado abren el apoyo; el ordinal y resumen pertenecen al programa completo, no al subconjunto', () => {
  const view = ui()
  view.button('Pendientes').props.onClick()
  let html = view.html()
  assert.match(html, /<details open=""[^>]*class="group\/programa/)
  assert.match(html, /<details open=""[^>]*class="group\/seccion/)
  assert.ok(html.includes('Material de apoyo')); assert.ok(!html.includes('Reproducir Elegí tu nicho'))
  assert.match(html, /1 de 3 completadas/)
  view.button('Limpiar filtros').props.onClick()
  view.search().props.onChange({ target: { value: 'PRODUCTO GANADOR' } })
  html = view.html()
  assert.match(html, /04 · Clase grabada/)
  assert.match(html, /1 de 3 completadas/)
  assert.ok(!html.includes('Reproducir Elegí tu nicho'))
  view.search().props.onChange({ target: { value: '  APOYO HOTMART  ' } })
  html = view.html()
  assert.match(html, /<details open=""[^>]*class="group\/seccion/)
  assert.ok(!html.includes('Reproducir Producto ganador'))
})
test('Continuar y Siguiente conservan catálogo completo; un guardado confirmado actualiza los chips', () => {
  const view = ui({ progresoInicial: [avance('a', { posicion_seg: 20 })] })
  view.button('Pendientes').props.onClick()
  view.search().props.onChange({ target: { value: 'Hotmart' } })
  assert.match(view.html(), /Continuar viendo/)
  view.button('Retomar clase').props.onClick()
  assert.equal(view.player().props.clase.id, 'a')
  assert.equal(view.player().props.siguiente, 'Producto ganador')
  view.player().props.onSiguiente()
  assert.equal(view.player().props.clase.id, 'b')
  view.player().props.onCerrar()
  view.button('Limpiar filtros').props.onClick()
  view.programs()[0].props.onAbrir(base)
  view.player().props.onProgreso(avance('a', { completada: true }))
  view.player().props.onCerrar()
  assert.ok(!view.html().includes('Continuar viendo'))
  assert.equal(text(view.button('Completadas')), 'Completadas1')
  assert.equal(text(view.button('Pendientes')), 'Pendientes2')
  view.programs()[0].props.onAbrir(base)
  view.player().props.onProgreso(avance('a', { completada: false, posicion_seg: 0 }))
  assert.equal(text(view.button('Completadas')), 'Completadas0')
  assert.equal(text(view.button('Pendientes')), 'Pendientes3')
})
test('error mantiene clases pero no etiquetas pendientes, barras ni continuar ficticio; admin no tiene filtros personales', () => {
  const view = ui({ errorProgreso: true })
  const html = view.html()
  assert.match(html, /No pudimos cargar tu progreso/)
  assert.match(html, /Progreso no disponible/)
  assert.ok(!html.includes('role="progressbar"'))
  assert.ok(!html.includes('de 3 completadas'))
  assert.ok(!html.includes('Continuar viendo'))
  assert.ok(!html.includes('>Pendiente</p>'))
  for (const label of ['Pendientes', 'En curso', 'Completadas']) {
    assert.equal(view.button(label).props.disabled, true)
    assert.ok(text(view.button(label)).endsWith('—'))
  }
  assert.equal(view.button('Todas').props.disabled, false)
  const admin = ui({ esAdmin: true })
  assert.equal(admin.button('Pendientes'), undefined)
  assert.ok(!admin.html().includes('role="progressbar"'))
  assert.ok(!admin.html().includes('Continuar viendo'))
})
test('vacío real conserva mensaje; controles tienen objetivos táctiles, foco y estados accesibles sin red nueva', () => {
  assert.match(ui({ clases: [] }).html(), /Estamos preparando tus clases/)
  assert.equal(ui({ clases: [] }).button('Todas'), undefined)
  const view = ui()
  for (const label of ['Todas', 'Pendientes', 'En curso', 'Completadas']) {
    const button = view.button(label)
    assert.match(button.props.className, /min-h-11/)
    assert.match(button.props.className, /focus-visible:outline/)
    assert.equal(typeof button.props['aria-pressed'], 'boolean')
  }
  assert.match(view.search().props.className, /text-base/)
  assert.match(view.html(), /grid-cols-2/)
  assert.match(view.html(), /aria-live="polite"/)
  assert.ok(!read('src/lib/class-library-filters.ts').includes('fetch('))
})
