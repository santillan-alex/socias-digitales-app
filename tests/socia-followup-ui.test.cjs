/* eslint-disable @typescript-eslint/no-require-imports */
// Pruebas locales de UI y reintentos; las dimensiones visuales se revisan en navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports); return m.exports }
const metrics = load('src/lib/metrics.ts'), d = load('src/lib/socia-followup.ts', { './metrics': metrics })
const id = '00000000-0000-4000-8000-000000000001', cid = '00000000-0000-4000-8000-000000000002', stamp = '2026-11-02T12:00:00.123456+00:00', hoy = '2026-11-02'
const period = inicio => ({ usuaria_id: id, inicio, fin: d.finAcompanamiento(inicio), version: 1, actualizado_en: stamp })
const socia = changes => ({ id, nombre: 'Socia real', whatsapp: null, estado: 'activa', alta: '2026-09-01', acompanamiento: null, cobros: [], prueba: false, ...changes })
const detail = changes => ({ socia: socia(), historial: [], historialLimitado: false, cobrosLimitados: false, hoy, ...changes })
const list = changes => ({ estado: 'lista', socias: [], hoy, limitado: false, incluyePrueba: false, ...changes })
function ui(props, nombre = 'default') {
  const states = [], refs = []; let cursor = 0, rcursor = 0
  const hooks = { useState: initial => { const n = cursor++; if (!(n in states)) states[n] = typeof initial === 'function' ? initial() : initial; return [states[n], value => { states[n] = typeof value === 'function' ? value(states[n]) : value }] }, useRef: initial => { const n = rcursor++; return refs[n] ?? (refs[n] = { current: initial }) }, useEffect: () => {} }
  const Link = ({ children, ...attributes }) => React.createElement('a', attributes, children)
  const Component = load('src/app/admin/socias/SociasSeguimiento.tsx', { react: hooks, 'next/link': { default: Link }, '@/components/ArrowIcon': { default: () => null }, '@/components/AdminSectionMenu': { default: () => null }, '@/lib/socia-followup': d })[nombre]
  function render() { cursor = 0; rcursor = 0; return Component(props) }
  function text(n) { return typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' ? [n.props?.children].flat(Infinity).map(text).join('') : '' }
  function all(n, predicate) { if (!n || typeof n !== 'object') return []; return [...(predicate(n) ? [n] : []), ...[n.props?.children].flat(Infinity).flatMap(c => all(c, predicate))] }
  return { render, html: () => renderToStaticMarkup(render()), all: predicate => all(render(), predicate), button: label => all(render(), n => n.type === 'button' && text(n) === label)[0], submit: entries => render().props.onSubmit({ preventDefault() {}, currentTarget: entries }) }
}
async function withNetwork(fn) {
  const original = { fetch: global.fetch, FormData: global.FormData }
  const calls = [], replies = []
  global.FormData = class { constructor(values) { this.values = values } get(key) { return Object.hasOwn(this.values, key) ? this.values[key] : null } }
  global.fetch = async (url, options) => { calls.push({ url, ...options, body: options?.body ? JSON.parse(options.body) : null }); assert.ok(replies.length, 'Falta respuesta simulada'); const reply = replies.shift(); if (reply instanceof Error) throw reply; return Response.json(reply.data, { status: reply.status ?? 200 }) }
  try { await fn({ calls, replies }) } finally { Object.assign(global, original) }
}
test('resumen operativo distingue vacío, error y lectura parcial; prueba no participa ni muestra totales monetarios mezclados', () => {
  const empty = ui({ inicial: list() }).html(); assert.match(empty, /Las Socias van a aparecer acá/); assert.match(empty, /Acompañamientos vigentes/)
  const error = ui({ inicial: { estado: 'error', mensaje: 'No pudimos comprobar el seguimiento.', hoy } }).html(); assert.match(error, /No pudimos comprobar/); assert.ok(!error.includes('Las Socias van')); assert.ok(!error.includes('Acompañamientos vigentes')); assert.match(error, /Volver a comprobar/)
  const partial = ui({ inicial: list({ socias: [socia()], limitado: true }) }).html(); assert.match(partial, /Vista parcial/); assert.match(partial, /Los indicadores quedan sin calcular/); assert.equal((partial.match(/tabular-nums">—</g) ?? []).length, 6); assert.ok(!partial.includes('0 cobros pendientes'))
  const prueba = ui({ inicial: list({ socias: [socia({ prueba: true, nombre: 'Prueba' })], incluyePrueba: true }) }).html(); assert.match(prueba, /Prueba excluida/); assert.match(prueba, /Fecha por confirmar/); assert.equal((prueba.match(/tabular-nums">0</g) ?? []).length, 6); assert.ok(!prueba.includes('Ingresos totales'))
})
test('búsqueda por nombre o WhatsApp y estado no mezcla Afiliadas con Socias ni cambia permisos al vencer', () => {
  const view = ui({ inicial: list({ socias: [socia({ nombre: 'María', whatsapp: '351 1234567' }), socia({ id: cid, nombre: 'Flor alumna', acompanamiento: { ...period('2026-04-01'), usuaria_id: cid } })] }) })
  const search = view.all(n => n.type === 'input' && n.props.placeholder === 'Nombre o WhatsApp')[0]
  search.props.onChange({ target: { value: 'maria' } }); assert.match(view.html(), /María/); assert.ok(!view.html().includes('Flor alumna'))
  view.all(n => n.type === 'input' && n.props.placeholder === 'Nombre o WhatsApp')[0].props.onChange({ target: { value: '1234567' } }); assert.match(view.html(), /María/)
  view.all(n => n.type === 'input' && n.props.placeholder === 'Nombre o WhatsApp')[0].props.onChange({ target: { value: '' } }); view.all(n => n.type === 'select')[0].props.onChange({ target: { value: 'vencido' } }); const html = view.html(); assert.ok(!html.includes('María')); assert.match(html, /Flor alumna/); assert.match(html, /Acompañamiento vencido/); assert.ok(!html.includes('Acceso bloqueado'))
})
test('ficha muestra fin exclusivo y último día incluido, pagos y un historial comprensible sin información inventada', async () => withNetwork(async ({ replies }) => {
  const view = ui({ inicial: list({ socias: [socia()] }) })
  replies.push({ data: detail({ socia: socia({ acompanamiento: period('2026-09-01'), cobros: [{ id: cid, socia_id: id, concepto: 'Cuota', vencimiento: '2026-11-01', monto: 100, moneda: 'USD', estado: 'pendiente', pagado_en: null, nota: 'Contactar cuando acuerden renovación', version: 1, creado_en: stamp, actualizado_en: stamp }] }), historial: [{ id: cid, entidad: 'acompanamiento', registro_id: id, creado_en: stamp, anterior: null, nuevo: { inicio: '2026-09-01', fin: '2027-03-01' } }] }) })
  await view.button('Ver seguimiento ').props.onClick()
  // El controlador visual despacha sin bloquear el evento; esperamos una microtarea de red.
  await new Promise(resolve => setTimeout(resolve, 0))
  const html = view.html(); assert.match(html, /Último día incluido/); assert.match(html, /28\/02\/2027/); assert.match(html, /01\/03\/2027/); assert.match(html, /Pendiente vencido/); assert.match(html, /USD/); assert.match(html, /Historial de seguimiento/); assert.match(html, /Inicio confirmado/); assert.match(html, /El historial no se reemplaza al renovar/); assert.ok(!html.includes('Correo:')); assert.ok(!html.includes('Bloquear cuenta'))
}))
test('inicio toma el campo visible del formulario y conserva exactamente el envío después de perder la respuesta', async () => withNetwork(async ({ calls, replies }) => {
  const confirmed = [], view = ui({ detalle: detail(), onCerrar() {}, onGuardado: row => confirmed.push(row) }, 'EditorPeriodo')
  assert.equal(view.all(n => n.props?.name === 'inicio')[0].props.value, '')
  replies.push({ status: 503, data: { error: 'No pudimos confirmar el guardado.' } })
  await view.submit({ inicio: '2026-10-01', confirmacion_pago: 'on' }); assert.equal(calls[0].body.inicio, '2026-10-01'); assert.equal(confirmed.length, 0); assert.match(view.html(), /Reintentar mismo guardado/); assert.equal(view.all(n => n.type === 'fieldset')[0].props.disabled, true)
  replies.push({ data: { ok: true, periodo: period('2026-10-01') } })
  await view.submit({ inicio: '2026-11-02', confirmacion_pago: 'on' }); assert.deepEqual(calls[0].body, calls[1].body); assert.equal(confirmed.length, 1); assert.equal(confirmed[0].fin, '2027-04-01')
}))
test('cobro conserva UUID y contenido en reintento; el éxito exige confirmar la misma Socia, versión y datos', async () => withNetwork(async ({ calls, replies }) => {
  const confirmed = [], view = ui({ sociaId: id, hoy, inicial: null, onCerrar() {}, onGuardado: row => confirmed.push(row) }, 'EditorCobro')
  const native = { concepto: '  Nueva cuota  ', vencimiento: hoy, monto: '120,50', moneda: 'USD', estado: 'pendiente', nota: '' }
  replies.push(new Error('Respuesta de red perdida'))
  await view.submit(native); const first = calls[0].body; assert.equal(first.concepto, 'Nueva cuota'); assert.equal(first.monto, 120.5); assert.match(first.id, metrics.UUID_METRICA); assert.equal(confirmed.length, 0); assert.match(view.html(), /Reintentar mismo guardado/)
  const row = { ...first, socia_id: id, version: 1, creado_en: stamp, actualizado_en: stamp }
  replies.push({ data: { ok: true, cobro: { ...row, socia_id: cid } } })
  await view.submit({ ...native, concepto: 'Cambio no enviado' }); assert.deepEqual(calls[1].body, first); assert.equal(confirmed.length, 0); assert.match(view.html(), /No pudimos comprobar el cobro guardado/)
  replies.push({ data: { ok: true, cobro: row } }); await view.submit(native); assert.deepEqual(calls[2].body, first); assert.equal(confirmed.length, 1); assert.ok(calls.every(c => c.url.endsWith('/cobros') && c.method === 'POST'))
}))
test('confirmar pago exige verificación, importe no admite separadores de miles y errores mantienen formulario editable', async () => withNetwork(async ({ calls }) => {
  const view = ui({ sociaId: id, hoy, inicial: null, onCerrar() {}, onGuardado() { throw new Error('No corresponde confirmar') } }, 'EditorCobro')
  await view.submit({ concepto: 'Cuota', vencimiento: hoy, estado: 'pagado', monto: '', moneda: '', pagado_en: hoy, nota: '' }); assert.equal(calls.length, 0); assert.match(view.html(), /Confirmá que verificaste el pago/); assert.equal(view.all(n => n.type === 'fieldset')[0].props.disabled, false)
  await view.submit({ concepto: 'Cuota', vencimiento: hoy, estado: 'pendiente', monto: '1.234,56', moneda: 'ARS', nota: '' }); assert.equal(calls.length, 0); assert.match(view.html(), /sin separadores de miles/)
}))
test('controles tienen objetivos cómodos, texto móvil legible, bordes crema y ninguna transparencia o máscara', () => {
  const source = read('src/app/admin/socias/SociasSeguimiento.tsx'), main = ui({ inicial: list({ socias: [socia({ nombre: 'UnNombreExtensísimo'.repeat(8) })] }) })
  for (const control of main.all(n => n.type === 'button')) assert.ok(control.props.className.includes('min-h-11'))
  const editors = [ui({ detalle: detail(), onCerrar() {}, onGuardado() {} }, 'EditorPeriodo'), ui({ sociaId: id, hoy, inicial: null, onCerrar() {}, onGuardado() {} }, 'EditorCobro')]
  for (const editor of editors) for (const control of editor.all(n => ['input', 'select', 'textarea'].includes(n.type) && n.props.type !== 'checkbox')) { assert.ok(control.props.name); assert.ok(control.props.className.includes('text-base')); assert.ok(control.props.className.includes('min-h-11')) }
  assert.match(main.html(), /break-words/); assert.ok(source.includes('border-[#E7DDD5]')); assert.ok(source.includes('bg-[#FFFDFA]')); assert.ok(!source.includes('backdrop-blur')); assert.ok(!source.includes('overflow-x-hidden')); assert.ok(!source.includes('localStorage')); assert.ok(!source.includes('type="password"'))
})
