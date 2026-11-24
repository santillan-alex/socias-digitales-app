/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated component interactions; no accounts, video requests or progress writes.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, deps = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const progress = load('src/lib/class-progress.ts')
const filters = load('src/lib/class-library-filters.ts', { './class-management': management })
const access = load('src/lib/class-access.ts')
const programModule = load('src/app/classroom/ClassroomProgram.tsx', { '@/lib/class-management': management, '@/lib/class-progress': progress,
  '@/lib/class-library-filters': filters, '@/components/ClassVideoThumbnail': { default: props => React.createElement('span', { 'data-fixture-thumbnail': props.id }) } })
const Program = programModule.default
const clase = (id, orden, extra = {}) => ({ id, titulo: `Clase ${id}`, descripcion: null, modulo: 'Socias Farmasi', orden,
  activo: true, puede_ver: true, solo_farmaci: true, acceso_gratuito: false, tiene_video_privado: true, vimeo_url: null, plan: '27', ...extra })
const clases = [clase('b', 2), clase('a', 1), clase('d', 4), clase('c', 3), clase('sin-grupo', 5), clase('apoyo', 6, { modulo: 'Socias Farmasi › Material de apoyo' })]
const grupos = [
  { id: 'segundo', nombre: 'Cuidado y práctica', orden: 2, claseIds: ['d', 'c'] },
  { id: 'primero', nombre: 'Primeros pasos', orden: 1, claseIds: ['b', 'a'] },
]
const registro = (id, cambios = {}) => ({ clase_id: id, completada: false, posicion_seg: 0, duracion_seg: 100, actualizado_en: '2026-11-24T13:00:00Z', ...cambios })
const propsBase = { programa: 'Farmasi', clases, progreso: [], buscar: '', esAdmin: false, tieneAcceso: false, cargando: false,
  abierto: true, gruposFarmasi: grupos, compactoFarmasi: true, onAbrir() {} }
function all(node, predicate) {
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))]
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return !node || typeof node !== 'object' ? '' : [node.props?.children].flat(Infinity).map(text).join('')
}
const render = props => Program({ ...propsBase, ...props })
const details = props => all(render(props), node => node.type === 'details')

test('Farmasi muestra submódulos directos y conserva orden, IDs y videos sin asignación', () => {
  const original = structuredClone(clases), originalGrupos = structuredClone(grupos)
  const blocks = programModule.organizarModulosFarmasi([...clases, clases[0]], [...grupos, { id: 'viejo', nombre: 'Vacío', orden: 9, claseIds: ['ajena'] }], false)
  assert.deepEqual(blocks.map(block => block.nombre), ['Primeros pasos', 'Cuidado y práctica', 'Clases', 'Material de apoyo'])
  assert.deepEqual(blocks.map(block => block.clases.map(item => item.id)), [['a', 'b'], ['c', 'd'], ['sin-grupo'], ['apoyo']])
  const view = render()
  assert.equal(view.type, 'section')
  assert.equal(details().length, 4)
  assert.equal(details().some(item => all(item, child => child.type === 'details').length > 1), false)
  assert.deepEqual(clases, original); assert.deepEqual(grupos, originalGrupos)
})
test('el módulo en curso se abre y una nueva alumna empieza por el primero', () => {
  assert.deepEqual(details().filter(item => item.props.open).map(text).map(value => value.startsWith('Primeros pasos')), [true])
  const resume = details({ claseDestacadaId: 'c', progreso: [registro('c', { posicion_seg: 24 })] })
  assert.equal(resume.filter(item => item.props.open).length, 1)
  assert.match(text(resume.find(item => item.props.open)), /^Cuidado y práctica/)
  const known = details({ progreso: [registro('a', { completada: true })] })
  assert.match(text(known.find(item => item.props.open)), /^Primeros pasos/)
  const finished = details({ progreso: [registro('c', { completada: true })] })
  assert.match(text(finished.find(item => item.props.open)), /^Cuidado y práctica/, 'finishing a class keeps its module available')
  const neverStarted = details({ progreso: [registro('a'), registro('ajena', { completada: true })] })
  assert.match(text(neverStarted.find(item => item.props.open)), /^Primeros pasos/, 'zero-minute records and unrelated progress do not hide a new classroom')
})
test('buscar y filtrar abre coincidencias sin recortar el denominador ni alterar el ordinal', () => {
  const view = render({ progreso: [registro('a', { completada: true })], idsVisibles: ['b'], buscar: 'Clase b' })
  const modules = all(view, node => node.type === 'details')
  assert.equal(modules.length, 1); assert.equal(modules[0].props.open, true)
  const html = renderToStaticMarkup(view)
  assert.match(html, /2 clases · 1 de 2 completadas/)
  assert.match(html, /02 · Clase grabada/)
  assert.match(html, /Reproducir Clase b/)
  assert.doesNotMatch(html, /Reproducir Clase a|Reproducir Clase c/)
  const stateFiltered = details({ idsVisibles: ['c'], filtrandoAvance: true })
  assert.equal(stateFiltered[0].props.open, true)
  const initial = details()[0]
  assert.notEqual(modules[0].key, initial.key, 'new search remounts native details so an earlier manual collapse does not hide a match')
})
test('avance por módulo usa la última lectura y no inventa ceros ante error', () => {
  const duplicados = [registro('a', { completada: true, actualizado_en: '2026-11-20T13:00:00Z' }), registro('a', { posicion_seg: 9 }), registro('b', { completada: true }), registro('no-autorizada', { completada: true })]
  const html = renderToStaticMarkup(render({ progreso: duplicados }))
  assert.match(html, /1 de 2 completadas/)
  assert.match(html, /En curso · 0:09/)
  assert.match(html, /aria-label="Progreso en Primeros pasos" aria-valuenow="50"/)
  const unknown = renderToStaticMarkup(render({ progreso: duplicados, errorProgreso: true }))
  assert.match(unknown, /Progreso no disponible/)
  assert.doesNotMatch(unknown, /role="progressbar"|de 2 completadas|>Pendiente</)
})
test('módulos no convierten permiso Socias general en permiso Farmasi ni muestran contenido sin video', () => {
  const supplied = [...clases, clase('cerrada', 10, { puede_ver: false }), clase('desconocida', 11, { puede_ver: undefined }), clase('oculta', 12, { activo: false }), clase('preparando', 13, { tiene_video_privado: false }), clase('socia', 14, { solo_farmaci: false })]
  const blocks = programModule.organizarModulosFarmasi(supplied, grupos, true)
  assert.deepEqual(blocks.flatMap(block => block.clases.map(item => item.id)), ['a', 'b', 'c', 'd', 'sin-grupo', 'apoyo'])
  assert.equal(renderToStaticMarkup(render({ clases: supplied, tieneAcceso: true })).includes('Reproducir Clase cerrada'), false)
})

function aula(overrides = {}) {
  const cells = []; let cursor = 0
  const Player = () => null, Upgrade = () => null
  const ClaseProgram = props => React.createElement(Program, props)
  const Classroom = load('src/app/classroom/ClassroomCliente.tsx', {
    react: { ...React, useCallback: fn => fn, useEffect() {}, useRef: initial => { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] },
      useState: initial => { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }] } },
    'next/link': { default: ({ prefetch, ...props }) => { void prefetch; return React.createElement('a', props) } },
    './ClassPlayer': { default: Player }, './ClassroomProgram': { default: ClaseProgram }, '@/components/SociasUpgradePanel': { default: Upgrade },
    '@/lib/class-management': management, '@/lib/class-progress': progress, '@/lib/class-access': access,
    '@/lib/class-library-filters': filters, '@/lib/farmasi-registration': load('src/lib/farmasi-registration.ts'),
  }).default
  const initial = { clases: clases.map(c => ({ ...c, tiene_video_privado: false, vimeo_url: 'https://vimeo.com/123' })), esAdmin: false,
    perfil: { nombre: null, avatar_url: null, rol: 'alumna', plan: null, estado: 'activa', tipo_usuario: 'gratuito' },
    espacioFarmasi: true, submodulosFarmasi: grupos, ...overrides }
  const view = () => { cursor = 0; return Classroom(initial) }
  const button = label => all(view(), node => node.type === 'button').find(node => text(node).startsWith(label))
  return { view, html: () => renderToStaticMarkup(view()), button,
    programs: () => all(view(), node => node.type === ClaseProgram),
    player: () => all(view(), node => node.type === Player)[0],
    search: () => all(view(), node => node.type === 'input' && node.props.type === 'search')[0],
    upgrades: () => all(view(), node => node.type === Upgrade),
  }
}

test('aula Farmasi elimina selector redundante; navegación general conserva Programa', () => {
  const farmasi = aula()
  assert.equal(all(farmasi.view(), node => node.type === 'select').length, 0)
  assert.equal(farmasi.programs().length, 1)
  assert.equal(farmasi.programs()[0].props.compactoFarmasi, true)
  assert.doesNotMatch(farmasi.html(), /Contenido de Farmasi|>Tu biblioteca</)
  assert.equal(farmasi.upgrades()[0].props.contexto, 'farmasi')
  const general = aula({ espacioFarmasi: false, perfil: { rol: 'alumna', estado: 'activa', tipo_usuario: 'socia' } })
  assert.equal(all(general.view(), node => node.type === 'select').length, 1)
  assert.equal(general.programs().some(item => item.props.compactoFarmasi), false)
})
test('la búsqueda y el estado no alteran el siguiente video ni saltan entre submódulos', () => {
  const view = aula({ progresoInicial: [registro('a', { posicion_seg: 20 })] })
  view.button('Pendientes').props.onClick()
  view.search().props.onChange({ target: { value: 'Clase c' } })
  assert.deepEqual(view.programs()[0].props.idsVisibles, ['c'])
  view.button('Retomar clase').props.onClick()
  assert.equal(view.player().props.clase.id, 'a')
  assert.equal(view.player().props.siguiente, 'Clase b')
  view.player().props.onSiguiente()
  assert.equal(view.player().props.clase.id, 'b')
  assert.equal(view.player().props.siguiente, undefined)
  view.player().props.onCerrar()
  view.button('Limpiar filtros').props.onClick()
  assert.equal(view.search().props.value, '')
  assert.equal(view.programs()[0].props.idsVisibles.length, clases.length)
})
test('aula Farmasi con progreso desconocido mantiene clases y filtros de estado deshabilitados', () => {
  const view = aula({ errorProgreso: true, progresoInicial: [registro('a', { completada: true })] })
  assert.match(view.html(), /No pudimos cargar tu progreso/)
  assert.doesNotMatch(view.html(), /Continuar viendo|role="progressbar"/)
  for (const label of ['Pendientes', 'En curso', 'Completadas']) assert.equal(view.button(label).props.disabled, true)
  assert.equal(view.programs()[0].props.errorProgreso, true)
})
