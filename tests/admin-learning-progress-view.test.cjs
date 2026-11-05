/* eslint-disable @typescript-eslint/no-require-imports */
// Fixtures ficticias y transporte aislado: no consulta alumnas ni certifica tamaños de navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..'), uiFile = 'src/app/admin/lanzamiento/AvancesFormacion.tsx'
function loader(deps = {}, env = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.resolve(root, file); if (cache.has(full)) return cache.get(full).exports
    const m = { exports: {} }; cache.set(full, m)
    const req = name => {
      if (Object.hasOwn(deps, name)) return deps[name]
      if (name.startsWith('.') || name.startsWith('@/')) return load(path.relative(root, (name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(full), name)) + '.ts'))
      return require(name)
    }
    new Function('require', 'module', 'exports', 'fetch', 'window', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(req, m, m.exports, env.fetch, env.window)
    return m.exports
  }
  return load
}
const load = loader(), d = load('src/lib/admin-learning-progress.ts'), v = load('src/lib/admin-learning-progress-view.ts')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clase = (n, changes = {}) => ({ id: id(n), titulo: `Clase ${n}`, modulo: 'Desafío Socias', orden: n, acceso_gratuito: false, ...changes })
const alumna = (n, changes = {}) => ({ id: id(100 + n), nombre: `Alumna ${n}`, tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false, ...changes })
const avance = (a, c, changes = {}) => ({ alumna_id: id(100 + a), clase_id: id(c), posicion_seg: 14, duracion_seg: 120, completada: false, actualizado_en: '2026-11-05T12:00:00Z', ...changes })
const clases = [clase(1, { modulo: 'Introducción', acceso_gratuito: true }), clase(2, { modulo: 'Desafío Socias en vivo' }), clase(3, { modulo: 'Desafío Socias › Material de apoyo' })]
const alumnas = [alumna(1), alumna(2, { tipo_usuario: 'gratuito' }), alumna(3, { tipo_usuario: 'desafio', desafio_socias_habilitada: true }), alumna(4, { tipo_usuario: 'desafio', desafio_socias_habilitada: null }), alumna(5, { estado: 'pausada' }), alumna(6, { nombre: null, tipo_usuario: null, estado: null, desafio_socias_habilitada: null }), alumna(7)]
const progreso = [avance(1, 2, { completada: true }), avance(1, 3, { actualizado_en: '2026-11-05T15:30:00Z' }), avance(2, 2, { completada: true }), avance(3, 2, { completada: true }), avance(3, 3, { completada: true }), avance(4, 2, { completada: true }), avance(5, 2, { completada: true })]
const lista = changes => ({ estado: 'lista', clases, alumnas, progreso, ...changes })

test('el recorrido reúne alias y materiales del mismo programa sin mezclar otra introducción', () => {
  assert.deepEqual(v.clasesDeRecorrido(clases, 'Desafío Socias').map(c => c.id), [id(2), id(3)])
  assert.deepEqual(v.clasesDeRecorrido(clases, 'Bienvenida').map(c => c.id), [id(1)])
  assert.deepEqual(v.clasesDeRecorrido(clases, 'Desafío Socias', id(3)).map(c => c.id), [id(3)])
  assert.deepEqual(v.clasesDeRecorrido(clases, 'Bienvenida', id(3)), [])
  assert.deepEqual(v.clasesDeRecorrido(clases, '', id(999)), [])
})
test('los registros con acceso anterior no inflan el avance actual ni la fecha del último avance', () => {
  assert.ok(d.esSeguimientoFormacion(lista()))
  const rows = v.filasAprendizaje(alumnas, clases.slice(1), v.indiceAprendizaje(progreso)), first = rows[0]
  assert.deepEqual({ disponibles: first.disponibles, iniciadas: first.iniciadas, completadas: first.completadas, ultima: first.ultima, estado: first.estado }, { disponibles: 2, iniciadas: 2, completadas: 1, ultima: '2026-11-05T15:30:00Z', estado: 'en_curso' })
  assert.equal(rows[2].estado, 'completado'); assert.equal(rows[6].estado, 'sin_registro')
  for (const n of [1, 3, 4, 5]) assert.deepEqual({ disponibles: rows[n].disponibles, iniciadas: rows[n].iniciadas, completadas: rows[n].completadas, ultima: rows[n].ultima, estado: rows[n].estado }, { disponibles: 0, iniciadas: 0, completadas: 0, ultima: null, estado: 'sin_acceso' })
  assert.deepEqual(v.resumenAprendizaje(rows), { conAcceso: 3, conActividad: 2, completaron: 1, sinRegistro: 1 })
})
test('el porcentaje por clase incluye a quienes aún no registraron actividad y no divide por iniciadas', () => {
  const index = v.indiceAprendizaje(progreso)
  assert.deepEqual(v.resumenClaseAprendizaje(clases[1], alumnas, index), { conAcceso: 3, conActividad: 2, completaron: 2, sinRegistro: 1, porcentaje: 67 })
  assert.deepEqual(v.resumenClaseAprendizaje(clases[2], alumnas, index), { conAcceso: 3, conActividad: 2, completaron: 1, sinRegistro: 1, porcentaje: 33 })
  assert.deepEqual(v.resumenClaseAprendizaje(clases[1], [alumnas[1], alumnas[4]], index), { conAcceso: 0, conActividad: 0, completaron: 0, sinRegistro: 0, porcentaje: null })
  assert.deepEqual(v.resumenAprendizaje(v.filasAprendizaje(alumnas, [], index)), { conAcceso: 0, conActividad: 0, completaron: 0, sinRegistro: 0 })
})
test('una muestra sigue accesible y una marca manual sin reproducción no simula tiempo visto', () => {
  const manual = avance(6, 1, { posicion_seg: 0, duracion_seg: 0, completada: true }), started = avance(2, 1, { posicion_seg: 0, duracion_seg: 0 })
  const rows = v.filasAprendizaje(alumnas, [clases[0]], v.indiceAprendizaje([manual, started]))
  assert.ok(rows.every(r => r.disponibles === 1)); assert.equal(rows[5].estado, 'completado'); assert.equal(rows[1].estado, 'en_curso')
  assert.equal(rows[0].estado, 'sin_registro'); assert.equal(rows[0].ultima, null)
})
test('la búsqueda sin acentos combina tipo, acceso y pendientes, incluyendo nombres y tipos nulos', () => {
  const rows = v.filasAprendizaje(alumnas.map(a => a.id === id(101) ? { ...a, nombre: 'María Álvarez' } : a), clases, v.indiceAprendizaje(progreso))
  const filters = { busqueda: '', tipo: '', acceso: '', actividad: '' }
  assert.deepEqual(v.filtrarAprendizaje(rows, { ...filters, busqueda: ' MARIA ALVAREZ ', tipo: 'socia', acceso: 'con_acceso', actividad: 'en_curso' }).map(r => r.alumna.id), [id(101)])
  assert.deepEqual(v.filtrarAprendizaje(rows, { ...filters, busqueda: 'sin nombre', tipo: 'sin_tipo' }).map(r => r.alumna.id), [id(106)])
  const privateRows = v.filasAprendizaje(alumnas, [clases[1]], v.indiceAprendizaje(progreso))
  assert.deepEqual(v.filtrarAprendizaje(privateRows, { ...filters, acceso: 'con_acceso', actividad: 'sin_registro' }).map(r => r.alumna.id), [id(107)])
  assert.equal(v.filtrarAprendizaje(privateRows, { ...filters, tipo: 'desafio', acceso: 'sin_acceso' })[0].alumna.id, id(104))
  assert.deepEqual(v.filtrarAprendizaje(rows, { ...filters, busqueda: 'No existe' }), [])
})

const Link = ({ prefetch, children, ...props }) => { void prefetch; return React.createElement('a', props, children) }
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] }
function text(tree) { return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : !tree || typeof tree !== 'object' ? '' : React.Children.toArray(tree.props?.children).map(text).join('') }
function by(tree, predicate) { const found = nodes(tree).find(predicate); assert.ok(found, 'Falta un control esperado'); return found }
function harness(inicial = lista(), options = {}) {
  assert.ok(d.esSeguimientoFormacion(inicial), 'Fixture debe cumplir el contrato real')
  const states = [], refs = [], effects = [], requests = [], cleanups = []; let stateIndex = 0, refIndex = 0, mounted = false, opened = 0
  const hooks = {
    useState(value) { const i = stateIndex++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
    useRef(value) { const i = refIndex++; return refs[i] ??= { current: value } }, useMemo: fn => fn(),
    useEffect(fn) { if (!mounted) effects.push(fn) },
  }
  const Component = loader({ react: hooks, 'next/link': { default: Link } }, { fetch: async (url, request) => { requests.push({ url, request }); if (!options.fetch) throw new Error('Transporte no preparado'); return options.fetch(url, request) }, window: { setTimeout, clearTimeout } })(uiFile).default
  const render = () => { stateIndex = 0; refIndex = 0; return Component({ inicial, claseInicial: options.claseInicial }) }
  const first = render(), dialog = by(first, n => n.type === 'dialog')
  dialog.props.ref.current = { open: false, showModal() { this.open = true; opened++ }, close() { if (this.open) { this.open = false; by(render(), n => n.type === 'dialog').props.onClose() } } }
  mounted = true; for (const effect of effects) cleanups.push(effect())
  return { render, requests, dialog: () => dialog.props.ref.current, opened: () => opened, unmount: () => { for (const cleanup of cleanups) cleanup?.() } }
}
const html = h => renderToStaticMarkup(h.render()), button = (h, name) => by(h.render(), n => n.type === 'button' && text(n) === name)
const selects = h => nodes(h.render()).filter(n => n.type === 'select')
const section = (h, label) => by(h.render(), n => n.props?.['aria-label'] === label)
const change = (control, value) => control.props.onChange({ target: { value } })
const tick = () => new Promise(resolve => setImmediate(resolve))
async function settle() { await tick(); await tick() }

test('el enlace de una clase abre su recorrido y los pendientes incluyen a alumnas sin registros', () => {
  const h = harness(lista(), { claseInicial: id(2) })
  assert.equal(selects(h)[1].props.value, id(2))
  assert.match(renderToStaticMarkup(section(h, 'Resumen del recorrido elegido')), /Con acceso al recorrido.*?>3<.*?Registraron actividad.*?>2<.*?Completaron el recorrido.*?>2<.*?Sin actividad registrada.*?>1</)
  assert.equal(nodes(section(h, 'Avance por alumna')).filter(n => n.type === 'article').length, 3)
  change(selects(h)[4], 'sin_registro')
  const pending = renderToStaticMarkup(section(h, 'Avance por alumna'))
  assert.ok(pending.includes('Alumna 7')); assert.ok(pending.includes('Sin registro')); assert.ok(!pending.includes('Alumna 1'))
  assert.ok(html(h).includes('Sin actividad registrada no significa que nunca haya visto la clase'))
})
test('vista por clase usa acceso actual y vuelve a las alumnas de la clase elegida', () => {
  const h = harness(); button(h, 'Por clase').props.onClick()
  const card = by(section(h, 'Avance por clase'), n => n.type === 'article' && text(n).includes('Clase 2'))
  assert.match(renderToStaticMarkup(card), /67% de las alumnas con acceso la completaron/)
  by(card, n => n.type === 'button').props.onClick()
  assert.equal(selects(h)[1].props.value, id(2)); assert.equal(button(h, 'Por alumna').props['aria-pressed'], true)
  assert.equal(nodes(section(h, 'Avance por alumna')).filter(n => n.type === 'article').length, 3)
  const summary = loader({ 'next/link': { default: Link } })('src/app/admin/classroom/ClassProgressAdmin.tsx').default
  const out = renderToStaticMarkup(React.createElement(summary, { clases: clases.map(c => ({ ...c, activo: true })), estadisticas: [{ clase_id: id(2), iniciadas: 2, completadas: 2 }], error: false }))
  assert.ok(out.includes(`href="/admin/lanzamiento?clase=${id(2)}"`)); assert.ok(out.includes('No pudimos comprobar el resumen de esta clase.')); assert.ok(!out.includes('NaN'))
})
test('selector, tarjetas y ficha respetan programa, sección y secuencia aunque los UUID lleguen en otro orden', () => {
  const source = [clase(1, { titulo: 'Segunda clase', orden: 2 }), clase(3, { titulo: 'Apoyo', modulo: 'Desafío Socias › Material de apoyo', orden: 0 }), clase(9, { titulo: 'Primera clase', orden: 1 }), clase(4, { titulo: 'Introducción', modulo: 'Bienvenida', orden: 1 })]
  const before = structuredClone(source), h = harness(lista({ clases: source, alumnas: [alumna(2, { nombre: 'Zulema' }), alumna(1, { nombre: 'Alba' })], progreso: [] }))
  const expected = ['Introducción', 'Primera clase', 'Segunda clase', 'Apoyo']
  assert.deepEqual(nodes(selects(h)[1]).filter(n => n.type === 'option').slice(1).map(n => text(n).split(' · ')[0]), expected)
  const cards = section(h, 'Avance por alumna'); assert.deepEqual(nodes(cards).filter(n => n.type === 'h2').map(text), ['Alba', 'Zulema'])
  by(cards, n => n.type === 'button').props.onClick({ currentTarget: { focus() {} } })
  assert.deepEqual(nodes(by(h.render(), n => n.type === 'dialog')).filter(n => n.type === 'h3').map(text), expected)
  button(h, 'Cerrar').props.onClick(); button(h, 'Por clase').props.onClick()
  assert.deepEqual(nodes(section(h, 'Avance por clase')).filter(n => n.type === 'h2').map(text), expected)
  assert.deepEqual(source, before, 'El orden de presentación no muta el DTO recibido')
})
test('ficha conserva la marca de completada y el tiempo real sin atribuir reproducción a una marca manual', () => {
  const h = harness(lista({ alumnas: [alumnas[0]], progreso: [avance(1, 2, { completada: true, posicion_seg: 0, duracion_seg: 0 }), avance(1, 3)] }))
  let focused = 0
  by(section(h, 'Avance por alumna'), n => n.type === 'button').props.onClick({ currentTarget: { focus: () => focused++ } })
  const out = renderToStaticMarkup(by(h.render(), n => n.type === 'dialog'))
  assert.equal(h.opened(), 1); assert.ok(out.includes('Completada por la alumna')); assert.ok(out.includes('Última posición: 0:14 de 2:00.')); assert.ok(!out.includes('Última posición: 0:00 de 0:00'))
  assert.ok(out.includes('Sin actividad registrada')); assert.ok(out.includes('Solo las clases del recorrido elegido con acceso actual'))
  assert.ok(html(h).includes('no una certificación')); button(h, 'Cerrar').props.onClick(); assert.equal(focused, 1); assert.equal(h.dialog().open, false)
})
test('SSR distingue vacío y error, trata campos nulos y conserva contratos de controles móviles', () => {
  const missing = harness(lista({ alumnas: [alumnas[5]], progreso: [] })), nullable = html(missing)
  for (const label of ['Sin nombre', 'Tipo por revisar', 'Estado por revisar', 'Sin actividad registrada']) assert.ok(nullable.includes(label), label)
  const long = harness(lista({ clases: [clase(1, { acceso_gratuito: true, titulo: 'Clase '.repeat(30).trim(), modulo: 'Programa '.repeat(10).trim() })], alumnas: [alumna(1, { nombre: 'NombreLargo'.repeat(20) })], progreso: [] }))
  assert.doesNotThrow(() => html(long)); assert.ok(html(long).includes('break-words')); assert.ok(html(long).includes('min-w-0'))
  for (const control of nodes(long.render()).filter(n => ['input', 'select'].includes(n.type))) { assert.ok(control.props.className.includes('text-base')); assert.ok(control.props.className.includes('min-h-11')) }
  assert.ok(by(long.render(), n => n.type === 'dialog').props.className.includes('overflow-y-auto'))
  const empty = html(harness(lista({ clases: [], alumnas: [], progreso: [] })))
  assert.ok(empty.includes('El seguimiento empieza con la primera clase')); assert.ok(empty.includes('href="/admin/classroom"'))
  const failed = html(harness({ estado: 'error', mensaje: 'No pudimos comprobar los avances.' }))
  assert.ok(failed.includes('role="alert"')); assert.ok(failed.includes('Reintentar')); assert.ok(!failed.includes('Resumen del recorrido elegido')); assert.ok(!failed.includes('El seguimiento empieza con la primera clase'))
  const unavailable = html(harness(lista(), { claseInicial: id(999) })); assert.ok(unavailable.includes('La clase de este enlace ya no está disponible')); assert.ok(!unavailable.includes('NaN'))
})
test('paginación local, filtros combinados y reinicio mantienen los recuentos del recorrido completo', () => {
  const roster = Array.from({ length: 25 }, (_, n) => alumna(n + 1)), h = harness(lista({ clases: [clases[1]], alumnas: roster, progreso: [] }))
  assert.equal(nodes(section(h, 'Avance por alumna')).filter(n => n.type === 'article').length, 24); assert.ok(html(h).includes('1–24'))
  button(h, 'Siguiente').props.onClick(); assert.equal(nodes(section(h, 'Avance por alumna')).filter(n => n.type === 'article').length, 1)
  change(by(h.render(), n => n.type === 'input'), 'No existe'); assert.ok(html(h).includes('No hay resultados para estos filtros')); assert.ok(renderToStaticMarkup(section(h, 'Resumen del recorrido elegido')).includes('>25<'))
  button(h, 'Limpiar filtros').props.onClick(); assert.equal(nodes(section(h, 'Avance por alumna')).filter(n => n.type === 'article').length, 24); assert.equal(button(h, 'Anterior').props.disabled, true)
})
test('actualizar usa una sola lectura privada y retira los datos ante respuesta fallida o inválida', async () => {
  for (const result of [Response.json({ estado: 'error', mensaje: 'Acceso no comprobado.' }, { status: 503 }), Response.json({ error: 'Sesión requerida' }, { status: 401 }), Response.json({ ...lista(), alumnas: [alumnas[0], alumnas[0]] })]) {
    let finish
    const h = harness(lista(), { fetch: () => new Promise(resolve => { finish = resolve }) })
    const update = button(h, 'Actualizar').props.onClick; update(); update()
    assert.equal(h.requests.length, 1); assert.equal(button(h, 'Actualizando…').props.disabled, true)
    assert.match(html(h), /Comprobando clases y avances/); finish(result); await settle()
    const out = html(h); assert.ok(out.includes('No pudimos cargar el seguimiento')); assert.ok(!out.includes('Resumen del recorrido elegido')); assert.ok(!out.includes('Alumna 1'))
    const request = h.requests[0]; assert.equal(request.url, '/api/admin/formacion'); assert.equal(request.request.cache, 'no-store'); assert.ok(request.request.signal instanceof AbortSignal); assert.equal(request.request.method, undefined)
  }
  const h = harness({ estado: 'error', mensaje: 'No pudimos comprobar los avances.' }, { fetch: async () => Response.json(lista()) })
  button(h, 'Reintentar').props.onClick(); await settle(); assert.ok(html(h).includes('Alumna 1')); assert.ok(!html(h).includes('No pudimos cargar el seguimiento'))
})
