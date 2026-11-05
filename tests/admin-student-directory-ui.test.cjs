/* eslint-disable @typescript-eslint/no-require-imports */
// Eventos y render con transporte aislado; no consulta usuarias ni reemplaza QA de navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const root = path.join(__dirname, '..')
function loader(deps = {}, env = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.join(root, file); if (cache.has(full)) return cache.get(full).exports
    const m = { exports: {} }; cache.set(full, m)
    const req = n => { if (Object.hasOwn(deps, n)) return deps[n]; if (n.startsWith('.') || n.startsWith('@/')) { const p = n.startsWith('@/') ? path.join(root, 'src', n.slice(2)) : path.resolve(path.dirname(full), n); return load(path.relative(root, p + '.ts')) } return require(n) }
    new Function('require', 'module', 'exports', 'fetch', 'window', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(req, m, m.exports, env.fetch, env.window); return m.exports
  }
  return load
}
const d = loader()('src/lib/admin-student-directory.ts'), id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, stamp = '2026-11-05T12:00:00Z'
const cuenta = changes => ({ id: id(1), nombre: 'María Alba', email: 'maria@example.invalid', email_confirmado: true, cuenta_encontrada: true, whatsapp: '+5493511234567', pais: 'Argentina', estado: 'activa', tipo_usuario: 'socia', desafio_socias_habilitada: false, desafio_socias_estado: 'no_aplica', created_at: stamp, ultimo_acceso: stamp, afiliadas_habilitada: true, ...changes })
const roster = [cuenta(), cuenta({ id: id(2), nombre: 'Ana Desafío', email: 'ana@example.invalid', pais: 'Chile', tipo_usuario: 'desafio', desafio_socias_habilitada: false, desafio_socias_estado: 'pendiente', afiliadas_habilitada: false }), cuenta({ id: id(3), nombre: 'Celia Libre', email: 'celia@example.invalid', pais: 'Uruguay', tipo_usuario: 'gratuito', estado: 'pausada', afiliadas_habilitada: false })]
const lista = (cuentas = roster, changes = {}) => ({ estado: 'lista', cuentas, limitado: false, errorIdentidades: false, errorAfiliadas: false, ...changes })
const Link = ({ prefetch, children, ...p }) => { void prefetch; return React.createElement('a', p, children) }
function harness(inicial = lista(), env = {}) {
  assert.ok(d.esDirectorioAlumnas(inicial), 'Fixture debe respetar el contrato real')
  const states = [], refs = [], requests = [], effects = []; let si = 0, ri = 0, opened = 0, closed = 0
  const hooks = { useState(v) { const i = si++; if (!(i in states)) states[i] = typeof v === 'function' ? v() : v; return [states[i], n => { states[i] = typeof n === 'function' ? n(states[i]) : n }] }, useRef(v) { const i = ri++; return refs[i] ??= { current: v } }, useEffect(fn) { effects.push(fn) } }
  const Component = loader({ react: hooks, 'next/link': { default: Link }, '@/components/ArrowIcon': { default: () => null }, '@/lib/admin-student-directory': d }, { fetch: async (url, opts) => { requests.push({ url, opts }); if (!env.fetch) throw new Error('Sin respuesta simulada'); return env.fetch(url, opts) }, window: { setTimeout, clearTimeout } })('src/app/admin/alumnas/AlumnasDirectorio.tsx').default
  const render = () => { si = 0; ri = 0; effects.length = 0; return Component({ inicial }) }
  const dialog = by(render(), n => n.type === 'dialog')
  dialog.props.ref.current = { open: false, showModal() { this.open = true; opened++ }, close() { if (!this.open) return; this.open = false; closed++; dialog.props.onClose() } }
  return { render, requests, effects, dialog: () => dialog.props.ref.current, opened: () => opened, closed: () => closed }
}
function nodes(n) { return n && typeof n === 'object' ? [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)] : [] }
function by(tree, predicate) { const n = nodes(tree).find(predicate); assert.ok(n, 'Control esperado ausente'); return n }
const text = n => React.Children.toArray(n.props?.children).filter(c => typeof c === 'string').join('')
const html = h => renderToStaticMarkup(h.render())
const cards = h => by(h.render(), n => n.props?.['aria-label'] === 'Alumnas en tarjetas')
const tile = (h, label) => by(h.render(), n => n.type === 'button' && n.props['aria-label']?.startsWith(`Ver ${label}:`))
const select = (h, index) => nodes(h.render()).filter(n => n.type === 'select')[index]
const tick = () => new Promise(r => setImmediate(r))
async function settle() { await tick(); await tick() }
test('Socia con Afiliadas se cuenta una persona, mantiene ambas etiquetas y una fila por formato', () => {
  const h = harness()
  assert.equal(tile(h, 'Todas las alumnas').props['aria-label'], 'Ver Todas las alumnas: 3'); assert.equal(tile(h, 'Socias').props['aria-label'], 'Ver Socias: 1'); assert.equal(tile(h, 'Afiliadas').props['aria-label'], 'Ver Afiliadas: 1')
  assert.equal(nodes(cards(h)).filter(n => n.type === 'article').length, 3)
  const table = by(h.render(), n => n.type === 'tbody'); assert.equal(nodes(table).filter(n => n.type === 'tr').length, 3)
  const first = nodes(cards(h)).find(n => n.type === 'article'), out = renderToStaticMarkup(first)
  assert.ok(out.includes('María Alba'))
  assert.ok(out.includes('Socias Digitales')); assert.ok(out.includes('Afiliada')); assert.ok(!out.includes('Desafío sin habilitar'))
  assert.ok(html(h).includes('3 alumnas en esta vista')); assert.ok(!html(h).includes('4 en total'))
})
test('combina filtros y búsqueda; cada resumen reinicia los demás filtros y limpiar devuelve roster completo', () => {
  const h = harness(); by(h.render(), n => n.type === 'input').props.onChange({ target: { value: 'MARIA@' } })
  select(h, 0).props.onChange({ target: { value: 'socia' } }); select(h, 1).props.onChange({ target: { value: 'habilitadas' } }); select(h, 2).props.onChange({ target: { value: 'activa' } })
  assert.equal(nodes(cards(h)).filter(n => n.type === 'article').length, 1); assert.ok(html(h).includes('1 alumna en esta vista'))
  tile(h, 'Gratuitas').props.onClick(); assert.equal(select(h, 0).props.value, 'gratuito'); assert.equal(select(h, 1).props.value, 'todas'); assert.equal(select(h, 2).props.value, 'todas'); assert.equal(by(h.render(), n => n.type === 'input').props.value, '')
  assert.ok(html(h).includes('Celia Libre')); assert.ok(!renderToStaticMarkup(cards(h)).includes('María Alba'))
  tile(h, 'Afiliadas').props.onClick(); assert.equal(select(h, 0).props.value, 'todas'); assert.equal(select(h, 1).props.value, 'habilitadas'); assert.ok(renderToStaticMarkup(cards(h)).includes('María Alba'))
  by(h.render(), n => n.type === 'button' && text(n) === 'Limpiar filtros').props.onClick(); assert.equal(nodes(cards(h)).filter(n => n.type === 'article').length, 3)
  by(h.render(), n => n.type === 'input').props.onChange({ target: { value: 'inexistente' } }); assert.ok(html(h).includes('No hay coincidencias'))
  tile(h, 'Todas las alumnas').props.onClick(); assert.equal(nodes(cards(h)).filter(n => n.type === 'article').length, 3); assert.ok(!html(h).includes('No hay coincidencias'))
})
test('permisos desconocidos, identidades fallidas y límite no se presentan como cero ni como ausencia de confirmación', () => {
  const unknown = harness(lista(roster.map(r => ({ ...r, afiliadas_habilitada: null })), { errorAfiliadas: true }))
  const badge = tile(unknown, 'Afiliadas'); assert.equal(badge.props.disabled, true); assert.ok(badge.props['aria-label'].includes('sin confirmar')); assert.ok(!badge.props['aria-label'].endsWith(': 0')); assert.ok(html(unknown).includes('No los contamos como deshabilitados'))
  select(unknown, 1).props.onChange({ target: { value: 'sin_acceso' } }); assert.ok(html(unknown).includes('No hay coincidencias'))
  select(unknown, 1).props.onChange({ target: { value: 'sin_comprobar' } }); assert.equal(nodes(cards(unknown)).filter(n => n.type === 'article').length, 3)
  const noIdentidad = harness(lista(roster.map(r => ({ ...r, email: null, email_confirmado: null, cuenta_encontrada: null, ultimo_acceso: null })), { errorIdentidades: true })), out = html(noIdentidad)
  assert.ok(out.includes('Email sin comprobar')); assert.ok(out.includes('Sin comprobar')); assert.ok(!out.includes('Email sin confirmar')); assert.ok(!out.includes('Cuenta de ingreso no encontrada')); assert.equal(tile(noIdentidad, 'Todas las alumnas').props.disabled, false)
  const parcial = harness(lista(roster, { limitado: true })); for (const label of ['Todas las alumnas', 'Socias', 'Desafío', 'Afiliadas', 'Gratuitas']) { assert.equal(tile(parcial, label).props.disabled, true); assert.ok(tile(parcial, label).props['aria-label'].includes('sin confirmar')) }
  assert.ok(html(parcial).includes('los totales quedan sin confirmar')); assert.ok(html(parcial).includes('3 alumnas en esta vista')); assert.ok(!html(parcial).includes('3 en total'))
})
test('campos nullable y nombres largos no rompen el render ni convierten un estado desconocido en suspensión', () => {
  const row = cuenta({ nombre: null, tipo_usuario: null, estado: null, email: null, email_confirmado: null, cuenta_encontrada: null, ultimo_acceso: null, whatsapp: null, pais: null, created_at: null, desafio_socias_habilitada: null, desafio_socias_estado: null })
  const h = harness(lista([row], { errorIdentidades: true })), out = html(h)
  assert.ok(out.includes('Sin nombre')); assert.ok(out.includes('>SD</span>')); assert.ok(out.includes('Tipo por revisar')); assert.ok(out.includes('Estado por revisar'))
  assert.ok(!out.includes('cuenta esté suspendida')); assert.ok(!out.includes('Email sin confirmar'))
  by(cards(h), n => n.type === 'button').props.onClick({ currentTarget: { focus() {} } })
  const ficha = renderToStaticMarkup(by(h.render(), n => n.type === 'dialog'))
  assert.ok(ficha.includes('Datos de la cuenta')); assert.ok(ficha.includes('Tipo por revisar')); assert.ok(ficha.includes('Estado por revisar'))
  assert.ok(!ficha.includes('cuenta esté suspendida')); assert.ok(!ficha.includes('Seguimiento de Socias')); assert.ok(!ficha.includes('Desafío Socias'))
  const largo = harness(lista([cuenta({ nombre: 'Nombre largo '.repeat(17), pais: 'País '.repeat(20) })])); assert.doesNotThrow(() => html(largo))
})
test('GET401 retira personas y ficha; distingue error de vacío y un reintento recupera datos verificados', async () => {
  let resolve, numero = 0, focus = 0
  const h = harness(lista(), { fetch: async () => ++numero === 1 ? new Promise(r => { resolve = r }) : Response.json(lista()) })
  const open = by(cards(h), n => n.type === 'button'); open.props.onClick({ currentTarget: { focus: () => focus++ } }); assert.equal(h.dialog().open, true)
  const update = by(h.render(), n => n.type === 'button' && text(n) === 'Actualizar').props.onClick; update(); update(); assert.equal(h.requests.length, 1); assert.equal(h.dialog().open, false)
  const busy = by(h.render(), n => n.type === 'button' && text(n) === 'Actualizando…'); assert.equal(busy.props.disabled, true); assert.equal(busy.props['aria-busy'], true)
  resolve(Response.json({ error: 'Sesión requerida' }, { status: 401 })); await settle()
  const failed = html(h); for (const row of roster) { assert.ok(!failed.includes(row.nombre)); assert.ok(!failed.includes(row.email)) }
  assert.ok(failed.includes('No pudimos reunir las alumnas')); assert.ok(!failed.includes('Todavía no hay alumnas')); assert.ok(!failed.includes('Resumen de alumnas y accesos')); assert.ok(focus > 0)
  by(h.render(), n => n.type === 'button' && text(n) === 'Reintentar').props.onClick(); await settle(); assert.ok(html(h).includes('María Alba')); assert.equal(h.requests.length, 2)
  assert.ok(h.requests.every(r => r.url === '/api/admin/alumnas' && r.opts.cache === 'no-store' && r.opts.method === undefined && r.opts.signal instanceof AbortSignal))
})
test('respuesta inválida o duplicada no confirma un directorio; vacío verificado sí muestra cero real', async () => {
  for (const response of [{ ...lista(), cuentas: [roster[0], roster[0]] }, { ...lista(), errorAfiliadas: true }, { estado: 'lista', cuentas: [] }]) {
    const h = harness(lista(), { fetch: async () => Response.json(response) }); by(h.render(), n => n.type === 'button' && text(n) === 'Actualizar').props.onClick(); await settle(); assert.ok(html(h).includes('No pudimos reunir las alumnas')); assert.ok(!html(h).includes('María Alba')); assert.ok(!html(h).includes('Todavía no hay alumnas'))
  }
  const empty = harness(lista([])); assert.equal(tile(empty, 'Todas las alumnas').props['aria-label'], 'Ver Todas las alumnas: 0'); assert.equal(tile(empty, 'Todas las alumnas').props.disabled, false); assert.ok(html(empty).includes('Todavía no hay alumnas para mostrar'))
})
test('ficha nativa es solo lectura, conserva destinos, cierra por botón/fondo/Escape y devuelve foco', () => {
  const h = harness(); let focused = 0
  const open = () => by(cards(h), n => n.type === 'button').props.onClick({ currentTarget: { focus: () => focused++ } })
  open(); assert.equal(h.opened(), 1); const dlg = by(h.render(), n => n.type === 'dialog'), out = renderToStaticMarkup(dlg)
  assert.ok(out.includes('maria@example.invalid')); assert.ok(out.includes('Seguimiento de Socias')); assert.ok(out.includes('href="/admin/afiliadas/accesos"')); assert.ok(out.includes('href="/admin#acceso-actividad"'))
  assert.ok(!nodes(dlg).some(n => ['input', 'textarea', 'select', 'form'].includes(n.type))); assert.equal(dlg.props.onCancel, undefined); assert.equal(by(dlg, n => n.type === 'button' && text(n) === 'Cerrar').props.autoFocus, true)
  by(dlg, n => n.type === 'button' && text(n) === 'Cerrar').props.onClick(); assert.equal(h.closed(), 1); assert.equal(focused, 1); assert.ok(!renderToStaticMarkup(by(h.render(), n => n.type === 'dialog')).includes('maria@example.invalid'))
  open(); const next = by(h.render(), n => n.type === 'dialog'); next.props.onClick({ target: {}, currentTarget: next }); assert.equal(h.dialog().open, true); next.props.onClick({ target: next, currentTarget: next }); assert.equal(h.closed(), 2)
  open(); h.dialog().close(); assert.equal(focused, 3); assert.equal(h.closed(), 3)
})
