/* eslint-disable @typescript-eslint/no-require-imports */
// Transporte y hooks aislados: no sube archivos, no reemplaza aceptación R2 ni navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}, env = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', 'fetch', 'XMLHttpRequest', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports, env.fetch, env.XMLHttpRequest); return m.exports }
const management = load('src/lib/class-management.ts'), materials = load('src/lib/class-materials.ts', { './class-management': management }), domain = load('src/lib/affiliate-hub.ts'), files = load('src/lib/affiliate-files.ts', { './class-materials': materials, './affiliate-hub': domain })
const recursoId = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003', parte = 16 * 1024 * 1024
const fakeFile = (name = 'Guía.pdf', size = 100) => ({ name, size, slice: (start, end) => ({ start, end, size: end - start }) })
const tick = () => new Promise(resolve => setImmediate(resolve))
async function until(predicate) { for (let n = 0; n < 25 && !predicate(); n++) await tick(); assert.ok(predicate(), 'El transporte no llegó al estado esperado') }
function harness(options = {}) {
  const states = [], refs = [], effects = [], requests = [], transfers = [], busy = [], pending = [], uploaded = [], completed = new Set(options.completed ?? [])
  let si = 0, ri = 0, file = null
  const hooks = { useState(v) { const i = si++; if (!(i in states)) states[i] = typeof v === 'function' ? v() : v; return [states[i], n => { states[i] = typeof n === 'function' ? n(states[i]) : n }] }, useRef(v) { const i = ri++; return refs[i] ??= { current: v } }, useEffect(fn) { effects.push(fn) }, useId: () => 'archivo-aislado' }
  class Xhr {
    constructor() { this.upload = {}; this.status = 0 }
    open(method, url) { this.method = method; this.url = url }
    send(body) { this.body = body; transfers.push(this) }
    progress(loaded) { this.upload.onprogress?.({ lengthComputable: true, loaded, total: this.body.size }) }
    succeed() { completed.add(Number(new URL(this.url).pathname.split('/').at(-1))); this.status = 200; this.onload?.() }
    abort() { this.aborted = true; this.onabort?.() }
    fail() { this.onerror?.() }
  }
  const confirmed = () => ({ id, recursoId, ...files.validarArchivoAfiliadas(file.name, file.size), url: files.urlArchivoAfiliadas(recursoId, id) })
  const fetch = async (_url, input) => {
    const body = JSON.parse(input.body); requests.push(body)
    if (options.fetch) { const result = await options.fetch(body, confirmed); if (result) return result }
    if (body.action === 'iniciar') return Response.json({ token: 'sesion-estable', parteBytes: parte, totalPartes: Math.ceil(file.size / parte) })
    assert.equal(body.token, 'sesion-estable')
    if (body.action === 'estado') return Response.json({ partes: [...completed] })
    if (body.action === 'firmar') return Response.json({ url: `https://account.r2.cloudflarestorage.com/parte/${body.numero}` })
    if (body.action === 'completar') return Response.json({ archivo: confirmed() })
    if (body.action === 'cancelar') return Response.json({ ok: true })
    throw new Error('Acción inesperada')
  }
  const Component = load('src/app/admin/afiliadas/AffiliateFileUpload.tsx', { react: hooks, '@/lib/affiliate-files': files }, { fetch, XMLHttpRequest: Xhr }).default
  const render = () => { si = 0; ri = 0; effects.length = 0; return Component({ recursoId, tipo: options.tipo ?? 'archivo', actualUrl: options.actualUrl ?? '', disabled: options.disabled ?? false, onUploaded: a => uploaded.push(a), onBusy: value => busy.push(value), onPending: value => pending.push(value) }) }
  return { render, requests, transfers, busy, pending, uploaded, effects, choose(next) { file = next; const input = by(render(), n => n.type === 'input' && n.props.type === 'file'); input.props.onChange({ target: { files: next ? [next] : [], value: 'seleccionado' } }) }, start() { by(render(), n => n.type === 'button' && ['Subir archivo', 'Continuar carga'].includes(text(n))).props.onClick() }, confirmed }
}
function nodes(n) { return n && typeof n === 'object' ? [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)] : [] }
function by(tree, pred) { const node = nodes(tree).find(pred); assert.ok(node, 'Control esperado ausente'); return node }
const text = n => React.Children.toArray(n.props.children).filter(c => typeof c === 'string').join('')
const html = h => renderToStaticMarkup(h.render())
const progress = h => by(h.render(), n => n.type === 'progress').props.value
test('archivo y video aceptan solo sus formatos/límites, sin pedir sesión de carga para una selección inválida', () => {
  for (const [tipo, file] of [['video', fakeFile('Guía.pdf')], ['archivo', fakeFile('Anuncio.mp4')], ['archivo', fakeFile('Guía.pdf', 25 * 1024 * 1024 + 1)], ['video', fakeFile('Anuncio.mp4', 1024 ** 3 + 1)], ['archivo', fakeFile('Guía.pdf', 0)], ['archivo', fakeFile('Instalador.exe')]]) {
    const h = harness({ tipo }); h.choose(file); assert.equal(h.requests.length, 0); assert.deepEqual(h.pending, [false]); assert.ok(html(h).includes('role="alert"')); assert.equal(h.uploaded.length, 0)
  }
  for (const [tipo, file] of [['video', fakeFile('Anuncio.MP4')], ['archivo', fakeFile('Guía.PDF')]]) {
    const h = harness({ tipo }); h.choose(file); assert.deepEqual(h.pending, [true]); assert.ok(html(h).includes(file.name)); assert.equal(h.requests.length, 0)
  }
})
test('doble clic no duplica sesión y progreso queda en 99 hasta confirmar exactamente el archivo', async () => {
  let resolveCompletion
  const h = harness({ fetch: async (body, confirmed) => body.action === 'completar' ? new Promise(resolve => { resolveCompletion = () => resolve(Response.json({ archivo: confirmed() })) }) : null })
  h.choose(fakeFile()); const button = by(h.render(), n => n.type === 'button' && text(n) === 'Subir archivo'); button.props.onClick(); button.props.onClick()
  await until(() => h.transfers.length === 1); assert.equal(h.requests.filter(r => r.action === 'iniciar').length, 1); assert.deepEqual(h.busy, [true])
  h.transfers[0].progress(100); assert.equal(progress(h), 99); assert.equal(h.uploaded.length, 0)
  h.transfers[0].succeed(); await until(() => Boolean(resolveCompletion)); assert.equal(progress(h), 99); assert.ok(html(h).includes('Verificando')); assert.deepEqual(h.pending, [true]); assert.equal(h.uploaded.length, 0)
  resolveCompletion(); await until(() => h.uploaded.length === 1)
  assert.equal(progress(h), 100); assert.deepEqual(h.uploaded[0], h.confirmed()); assert.deepEqual(h.pending, [true, false]); assert.deepEqual(h.busy, [true, false]); assert.ok(html(h).includes('Archivo listo. Guardá el recurso'))
})
test('pausar aborta la parte actual; continuar lee estado remoto y conserva token/partes ya recibidas', async () => {
  const h = harness(); h.choose(fakeFile('Documento.pdf', 20 * 1024 * 1024)); h.start()
  await until(() => h.transfers.length === 1); h.transfers[0].succeed(); await until(() => h.transfers.length === 2)
  by(h.render(), n => n.type === 'button' && text(n) === 'Pausar').props.onClick(); assert.equal(h.transfers[1].aborted, true); await until(() => h.busy.at(-1) === false)
  assert.ok(html(h).includes('Carga pausada')); assert.equal(h.uploaded.length, 0); assert.deepEqual(h.pending, [true])
  h.start(); await until(() => h.transfers.length === 3)
  assert.equal(h.requests.filter(r => r.action === 'iniciar').length, 1); assert.equal(h.requests.filter(r => r.action === 'estado').length, 2); assert.deepEqual(h.requests.filter(r => r.action === 'firmar').map(r => r.numero), [1, 2, 2]); assert.ok(h.requests.filter(r => r.action !== 'iniciar').every(r => r.token === 'sesion-estable'))
  h.transfers[2].succeed(); await until(() => h.uploaded.length === 1); assert.deepEqual(h.busy, [true, false, true, false]); assert.deepEqual(h.pending, [true, false]); assert.equal(progress(h), 100)
})
test('finalización incoherente no llama onUploaded ni libera pendiente; reintento verifica y completa sin duplicar', async () => {
  for (const cambio of [{ id: other }, { recursoId: other }, { nombre: 'Otro.pdf' }, { bytes: 50 }, { mime: 'image/png' }, { extension: 'png' }, { url: files.urlArchivoAfiliadas(other, id) }]) {
    let completeCalls = 0
    const h = harness({ completed: [1], fetch: async (body, confirmed) => body.action === 'completar' ? Response.json({ archivo: ++completeCalls === 1 ? { ...confirmed(), ...cambio } : confirmed() }) : null })
    h.choose(fakeFile()); h.start(); await until(() => h.busy.length === 2)
    assert.equal(h.uploaded.length, 0); assert.equal(progress(h), 99); assert.deepEqual(h.pending, [true]); assert.ok(html(h).includes('La respuesta no confirma este archivo')); assert.equal(h.transfers.length, 0)
    h.start(); await until(() => h.uploaded.length === 1); assert.equal(h.requests.filter(r => r.action === 'iniciar').length, 1); assert.deepEqual(h.pending, [true, false]); assert.deepEqual(h.busy, [true, false, true, false])
  }
})
test('fallo de transporte conserva pendiente y la carga; cancelar se confirma antes de permitir otro archivo', async () => {
  const h = harness(); h.choose(fakeFile()); h.start(); await until(() => h.transfers.length === 1)
  h.transfers[0].fail(); await until(() => h.busy.at(-1) === false); assert.equal(h.uploaded.length, 0); assert.deepEqual(h.pending, [true]); assert.ok(html(h).includes('Podés continuar esta misma carga'))
  by(h.render(), n => n.type === 'button' && text(n) === 'Cancelar y elegir otro').props.onClick(); await until(() => h.pending.at(-1) === false)
  assert.equal(h.requests.filter(r => r.action === 'cancelar').length, 1); assert.ok(by(h.render(), n => n.type === 'input' && n.props.type === 'file')); assert.deepEqual(h.busy, [true, false, true, false]); assert.equal(h.uploaded.length, 0)
})
test('destino ajeno no recibe el archivo, deshabilitado no inicia y desmontar aborta la transferencia', async () => {
  const bad = harness({ fetch: async body => body.action === 'firmar' ? Response.json({ url: 'https://otra.example.invalid/upload' }) : null }); bad.choose(fakeFile()); bad.start(); await until(() => bad.busy.length === 2); assert.equal(bad.transfers.length, 0); assert.equal(bad.uploaded.length, 0); assert.ok(html(bad).includes('El destino de carga no es válido'))
  const disabled = harness({ disabled: true }); disabled.choose(fakeFile()); assert.equal(disabled.requests.length, 0); assert.deepEqual(disabled.pending, [])
  const h = harness(); h.choose(fakeFile()); h.start(); await until(() => h.transfers.length === 1); const cleanup = h.effects[0](); cleanup(); await until(() => h.requests.some(r => r.action === 'cancelar')); await tick(); assert.equal(h.transfers[0].aborted, true); assert.equal(h.uploaded.length, 0); assert.deepEqual(h.busy, [true]); assert.deepEqual(h.pending, [true])
  const source = read('src/app/admin/afiliadas/AffiliateFileUpload.tsx'); for (const token of ['min-h-11', 'text-base', 'aria-label="Progreso de la carga"', '#E7DDD5']) assert.ok(source.includes(token)); assert.ok(!source.includes('<form')); assert.ok(!source.includes('window.confirm'))
})

test('iniciar pendiente al desmontar cancela el token tardío sin transferir ni avisar al padre desmontado', async () => {
  let resolveStart
  const h = harness({ fetch: async body => body.action === 'iniciar' ? new Promise(resolve => { resolveStart = resolve }) : null })
  h.choose(fakeFile()); h.start(); await until(() => Boolean(resolveStart))
  assert.deepEqual(h.busy, [true]); assert.deepEqual(h.pending, [true]); assert.equal(h.transfers.length, 0)
  const cleanup = h.effects[0](); cleanup()
  resolveStart(Response.json({ token: 'sesion-estable', parteBytes: parte, totalPartes: 1 }))
  await until(() => h.requests.some(r => r.action === 'cancelar')); await tick()
  assert.deepEqual(h.requests.map(r => r.action), ['iniciar', 'cancelar']); assert.equal(h.requests[1].token, 'sesion-estable')
  assert.equal(h.transfers.length, 0); assert.deepEqual(h.uploaded, []); assert.deepEqual(h.busy, [true]); assert.deepEqual(h.pending, [true])
})
test('completar pendiente al desmontar no emite éxito ni callbacks aunque llegue metadata válida después', async () => {
  let resolveCompletion
  const h = harness({ completed: [1], fetch: async (body, confirmed) => body.action === 'completar' ? new Promise(resolve => { resolveCompletion = () => resolve(Response.json({ archivo: confirmed() })) }) : null })
  h.choose(fakeFile()); h.start(); await until(() => Boolean(resolveCompletion)); assert.equal(progress(h), 99)
  const cleanup = h.effects[0](); cleanup(); await until(() => h.requests.some(r => r.action === 'cancelar'))
  resolveCompletion(); await tick(); await tick()
  assert.equal(h.requests.filter(r => r.action === 'completar').length, 1); assert.equal(h.requests.filter(r => r.action === 'cancelar').length, 1)
  assert.equal(h.transfers.length, 0); assert.deepEqual(h.uploaded, []); assert.deepEqual(h.busy, [true]); assert.deepEqual(h.pending, [true])
})
