/* eslint-disable @typescript-eslint/no-require-imports */
// Dobles de interfaz: las pruebas de backend verifican el parser y la descarga autorizada real.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}, env = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', 'fetch', 'navigator', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports, env.fetch, env.navigator); return m.exports }
const d = load('src/lib/affiliate-hub.ts'), c = load('src/lib/affiliate-campaigns.ts', { './affiliate-hub': d })
const id = '00000000-0000-4000-8000-000000000001', asset = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003'
const canonical = `https://app.sociasdigitales.com/api/afiliadas/${id}/archivo/${asset}`, alias = `https://flor.sociasdigitales.com/api/afiliadas/${id}/archivo/${asset}`, ajena = `https://app.sociasdigitales.com/api/afiliadas/${other}/archivo/${asset}`
const urls = new Map([[canonical, { recursoId: id, archivoId: asset }], [alias, { recursoId: id, archivoId: asset }], [ajena, { recursoId: other, archivoId: asset }]])
const base = { id, titulo: 'Copy para tu próxima campaña', cuerpo: 'Texto <script>nunca ejecutar</script> completo para adaptar.', tipo: 'copy', campana: 'Campaña Noviembre', url: null, estado: 'publicado', destacado: false, version: 1, creado_en: '2026-11-03T00:00:00Z', actualizado_en: '2026-11-03T00:00:00Z' }
const Link = ({ prefetch, children, ...props }) => { void prefetch; return React.createElement('a', props, children) }
function harness(recursos = [base], env = {}) {
  const states = [], refs = []; let si = 0, ri = 0
  const hooks = { useState(v) { const i = si++; if (!(i in states)) states[i] = typeof v === 'function' ? v() : v; return [states[i], n => { states[i] = typeof n === 'function' ? n(states[i]) : n }] }, useRef(v) { const i = ri++; return refs[i] ??= { current: v } } }
  const Component = load('src/app/afiliadas/AfiliadasCliente.tsx', { react: hooks, 'next/link': { default: Link }, 'next/image': { default: props => React.createElement('img', props) }, '@/components/ArrowIcon': { default: () => null }, '@/components/NavigationIcon': { default: () => null }, '@/lib/affiliate-hub': d, '@/lib/affiliate-campaigns': c, '@/lib/affiliate-files': { analizarArchivoAfiliadasUrl: url => urls.get(url) ?? null } }, env).default
  return { render() { si = 0; ri = 0; return Component({ inicial: Array.isArray(recursos) ? { estado: 'lista', recursos, limitado: false } : recursos }) }, states }
}
function nodes(n) { return n && typeof n === 'object' ? [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)] : [] }
const by = (tree, predicate) => { const found = nodes(tree).find(predicate); assert.ok(found, 'Control esperado ausente'); return found }
const text = n => React.Children.toArray(n.props.children).filter(c => typeof c === 'string').join('')
const html = h => renderToStaticMarkup(h.render())
const tarjeta = (h, recursoId) => { const node = by(h.render(), n => typeof n.type === 'function' && n.props.recurso?.id === recursoId); return node.type(node.props) }
const feedback = (h, recursoId) => by(tarjeta(h, recursoId), n => n.props?.['data-copy-feedback'] === recursoId)
test('descarga propia se reconoce por parser y binding del recurso, conserva sesión local y deja claros los destinos externos', () => {
  for (const tipo of ['video', 'archivo']) for (const url of [canonical, alias]) {
    const h = harness([{ ...base, tipo, url }]), out = html(h)
    assert.ok(out.includes(tipo === 'video' ? 'Descargar video' : 'Descargar archivo')); assert.ok(out.includes(`href="/api/afiliadas/${id}/archivo/${asset}"`)); assert.ok(!out.includes('Destino externo:')); assert.ok(!out.includes('r2.cloudflarestorage.com'))
  }
  const externo = html(harness([{ ...base, tipo: 'video', url: 'https://example.invalid/video' }]))
  assert.ok(externo.includes('Abrir video')); assert.ok(externo.includes('Destino externo:')); assert.ok(externo.includes('rel="noopener noreferrer"')); assert.ok(!externo.includes('Descargar video'))
  const incorrecta = html(harness([{ ...base, tipo: 'archivo', url: ajena }]))
  assert.ok(incorrecta.includes('El archivo necesita una revisión')); assert.ok(!incorrecta.includes('Descargar archivo')); assert.ok(!incorrecta.includes(`href="${ajena}"`))
})
test('campañas plegables reúnen variantes legacy y muestran cantidades/tipos; aviso destacado arriba sin duplicado', () => {
  const aviso = { ...base, id: other, tipo: 'aviso', destacado: true, titulo: 'Aviso importante' }, video = { ...base, id: asset, tipo: 'video', url: 'https://example.invalid/video', campana: ' campaña   NOVIEMBRE ', titulo: 'Video para vender' }
  const h = harness([base, aviso, video]), out = html(h)
  assert.equal((out.match(/<details\b/g) ?? []).length, 1); assert.equal((out.match(/Aviso importante/g) ?? []).length, 1); assert.ok(out.indexOf('Aviso importante') < out.indexOf('Tus campañas y materiales'))
  assert.ok(out.includes('2 recursos')); assert.ok(out.includes('Copies para vender · 1')); assert.ok(out.includes('Videos para anuncios · 1')); assert.ok(out.includes('De Flor para vos')); assert.ok(out.includes('<summary'))
  const selects = nodes(h.render()).filter(n => n.type === 'select'), opciones = nodes(selects[1]).filter(n => n.type === 'option')
  assert.equal(opciones.length, 2); assert.ok(opciones.some(n => n.props.value === c.claveCampanaAfiliada(base.campana)))
})
test('filtros búsqueda/tipo/campaña y limpiar se combinan sin perder variantes o dibujar un vacío falso', () => {
  const h = harness([base, { ...base, id: asset, tipo: 'video', titulo: 'Video especial', url: 'https://example.invalid/video', campana: ' campaña NOVIEMBRE ' }, { ...base, id: other, campana: null, titulo: 'Texto común' }])
  let tree = h.render(); const selects = nodes(tree).filter(n => n.type === 'select')
  selects[1].props.onChange({ target: { value: c.claveCampanaAfiliada(base.campana) } }); tree = h.render(); assert.ok(html(h).includes('2 recursos disponibles'))
  by(tree, n => n.type === 'select').props.onChange({ target: { value: 'video' } }); tree = h.render(); assert.ok(html(h).includes('1 recurso disponible'))
  by(tree, n => n.type === 'input').props.onChange({ target: { value: 'imposible' } }); assert.ok(html(h).includes('No hay recursos que coincidan'))
  by(h.render(), n => n.type === 'button' && text(n) === 'Limpiar filtros').props.onClick(); const out = html(h); assert.ok(out.includes('3 recursos disponibles')); assert.ok(out.includes('Sin campaña')); assert.ok(!out.includes('No hay recursos que coincidan'))
  assert.ok(html(harness({ estado: 'error', mensaje: 'No disponible' })).includes('No pudimos reunir')); assert.ok(!html(harness({ estado: 'error', mensaje: 'No disponible' })).includes('Por ahora no hay recursos publicados'))
})
test('clipboard confirma éxito o error junto a su tarjeta, permite retry y no mezcla dos tarjetas', async () => {
  const resolvers = [], textos = [], h = harness([{ ...base, cuerpo: 'a'.repeat(900) }, { ...base, id: asset, titulo: 'Segundo copy' }], { navigator: { clipboard: { writeText: value => { textos.push(value); return new Promise((resolve, reject) => resolvers.push({ resolve, reject })) } } } })
  const cards = nodes(h.render()).filter(n => typeof n.type === 'function' && n.props.recurso), primero = cards[0].props.alCopiar(cards[0].props.recurso)
  assert.equal(textos[0].length, 900); assert.ok(!html(h).includes('Copiado:'))
  const busy = by(tarjeta(h, id), n => n.type === 'button' && text(n) === 'Copiando…'); assert.equal(busy.props.disabled, true)
  assert.equal(text(feedback(h, id)), ''); assert.equal(text(feedback(h, asset)), '')
  resolvers[0].reject(new Error('no permitido')); await primero
  const failed = feedback(h, id); assert.ok(text(failed).includes('volver a intentarlo')); assert.ok(text(failed).includes('seleccionalo para copiarlo')); assert.ok(!failed.props.className.includes('sr-only')); assert.equal(text(feedback(h, asset)), '')
  assert.equal(by(tarjeta(h, id), n => n.type === 'button' && text(n) === 'Copiar texto completo').props.disabled, false)
  const retry = cards[0].props.alCopiar(cards[0].props.recurso); resolvers[1].resolve(); await retry
  const confirmed = feedback(h, id); assert.ok(text(confirmed).includes('Copiado: Copy para tu próxima campaña')); assert.equal(confirmed.props.role, 'status'); assert.equal(confirmed.props['aria-live'], 'polite'); assert.equal(confirmed.props['aria-atomic'], 'true'); assert.ok(!confirmed.props.className.includes('sr-only'))
  const copied = by(tarjeta(h, id), n => n.type === 'button' && text(n) === 'Copiado'); assert.equal(copied.props.disabled, false); assert.equal(text(feedback(h, asset)), '')
  // Solo las tarjetas contienen el live de copia: no queda otro anuncio arriba.
  assert.equal(nodes(h.render()).filter(n => n.props?.['aria-live']).length, 0)
  assert.equal((html(h).match(/Copiado: Copy para tu próxima campaña/g) ?? []).length, 1)
  const a = cards[0].props.alCopiar(cards[0].props.recurso), b = cards[1].props.alCopiar(cards[1].props.recurso)
  resolvers[3].resolve(); await b; resolvers[2].reject(new Error('respuesta antigua')); await a
  assert.equal(text(feedback(h, id)), ''); assert.ok(text(feedback(h, asset)).includes('Copiado: Segundo copy')); assert.ok(!html(h).includes('No pudimos copiar automáticamente'))
  assert.ok(by(tarjeta(h, asset), n => n.type === 'button' && text(n) === 'Copiado'))
})
test('actualización fallida retira contenido y feedback privado; una copia pendiente no reaparece al perder acceso', async () => {
  let resolve; const h = harness([base], { fetch: async () => Response.json({ error: 'Sin permiso' }, { status: 403 }), navigator: { clipboard: { writeText: () => new Promise(r => { resolve = r }) } } })
  const card = by(h.render(), n => typeof n.type === 'function' && n.props.recurso), copying = card.props.alCopiar(base)
  by(h.render(), n => n.type === 'button' && text(n) === 'Actualizar recursos').props.onClick(); await new Promise(r => setImmediate(r)); resolve(); await copying
  const out = html(h); assert.ok(out.includes('No pudimos reunir')); assert.ok(!out.includes(base.titulo)); assert.ok(!out.includes('Copiado:')); assert.ok(!out.includes('Por ahora no hay recursos publicados'))
})
test('actualizar correctamente borra Copiado y descarta una respuesta de copia anterior aunque conserve la tarjeta', async () => {
  const resolvers = [], h = harness([base], { fetch: async () => Response.json({ estado: 'lista', recursos: [base], limitado: false }), navigator: { clipboard: { writeText: () => new Promise(resolve => resolvers.push(resolve)) } } })
  const card = by(h.render(), n => typeof n.type === 'function' && n.props.recurso)
  const first = card.props.alCopiar(base); resolvers[0](); await first; assert.ok(by(tarjeta(h, id), n => n.type === 'button' && text(n) === 'Copiado'))
  const pending = card.props.alCopiar(base)
  by(h.render(), n => n.type === 'button' && text(n) === 'Actualizar recursos').props.onClick(); await new Promise(r => setImmediate(r)); resolvers[1](); await pending
  assert.equal(text(feedback(h, id)), ''); assert.ok(feedback(h, id).props.className.includes('sr-only')); assert.ok(by(tarjeta(h, id), n => n.type === 'button' && text(n) === 'Copiar texto completo')); assert.ok(!html(h).includes('Copiado:'))
})
test('sin portapapeles muestra alternativa manual local, sin éxito en la tarjeta vecina', async () => {
  const h = harness([base, { ...base, id: asset }], { navigator: {} }), card = by(h.render(), n => typeof n.type === 'function' && n.props.recurso?.id === asset)
  await card.props.alCopiar(card.props.recurso)
  assert.equal(text(feedback(h, id)), ''); assert.ok(text(feedback(h, asset)).includes('seleccionalo para copiarlo')); assert.ok(!feedback(h, asset).props.className.includes('sr-only')); assert.ok(!html(h).includes('Copiado:'))
})
test('texto largo es seguro y expandible, controles táctiles y superficies mantienen identidad sin reproductores automáticos', () => {
  const out = html(harness([{ ...base, cuerpo: '<script>no ejecutar</script> ' + 'a'.repeat(900) }]))
  assert.ok(out.includes('&lt;script&gt;no ejecutar&lt;/script&gt;')); assert.ok(!out.includes('<script>no ejecutar')); assert.ok(out.includes('Ver texto completo')); assert.ok(out.includes('aria-expanded="false"'))
  const source = read('src/app/afiliadas/AfiliadasCliente.tsx'); for (const token of ['min-w-0', 'break-words', 'text-base', 'min-h-11', '#E7DDD5', 'group-open:rotate-180', 'aria-busy={copiando}']) assert.ok(source.includes(token))
  for (const token of ['dangerouslySetInnerHTML', 'backdrop-blur', '<iframe', '<video', 'overflow-x-hidden', 'setTimeout']) assert.ok(!source.includes(token))
})
