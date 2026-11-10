/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
function load(file, deps = {}, env = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', 'fetch', 'navigator', 'window', 'crypto', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in deps ? deps[name] : require(name), m, m.exports, env.fetch, env.navigator, env.window, env.crypto); return m.exports }
const d = load('src/lib/affiliate-hub.ts'), management = load('src/lib/class-management.ts'), materials = load('src/lib/class-materials.ts', { './class-management': management }), files = load('src/lib/affiliate-files.ts', { './class-materials': materials, './affiliate-hub': d }), campaigns = load('src/lib/affiliate-campaigns.ts', { './affiliate-hub': d }), id = '00000000-0000-4000-8000-000000000001'
const datos = { titulo: 'Recurso local de prueba', cuerpo: 'Texto de práctica <script>no ejecutar</script>', tipo: 'copy', campana: 'Campaña local', url: 'https://example.invalid/recurso', estado: 'publicado', destacado: true }
const row = { id, ...datos, version: 1, creado_en: '2026-11-02T12:00:00.000Z', actualizado_en: '2026-11-02T12:00:00.000Z' }
const Link = ({ prefetch, children, ...props }) => { void prefetch; return React.createElement('a', props, children) }
const Image = ({ children, ...props }) => React.createElement('img', props, children)
function harness(file, initial = { estado: 'lista', recursos: [row], limitado: false }, env = {}) {
  const states = [], refs = []; let stateIndex = 0, refIndex = 0
  const hooks = { useState(value) { const index = stateIndex++; if (!(index in states)) states[index] = typeof value === 'function' ? value() : value; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] }, useRef(value) { const index = refIndex++; return refs[index] ??= { current: value } }, useMemo(fn) { return fn() }, useEffect() {} }
  const Component = load(file, { react: hooks, 'next/link': { default: Link }, 'next/image': { default: Image }, '@/components/ArrowIcon': { default: () => null }, '@/components/NavigationIcon': { default: () => null }, '@/components/AdminSectionMenu': { default: () => null }, '@/lib/affiliate-hub': d, '@/lib/affiliate-files': files, '@/lib/affiliate-campaigns': campaigns, './AffiliateFileUpload': { default: () => null } }, { window: { confirm: () => true }, crypto: { randomUUID: () => id }, ...env }).default
  return { render() { stateIndex = 0; refIndex = 0; return Component({ inicial: initial, ...(env.props ?? {}) }) }, refs, states }
}
function nodes(node) { if (!node || typeof node !== 'object') return []; return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)] }
const by = (tree, pred) => { const node = nodes(tree).find(pred); assert.ok(node, 'No se encontró el control esperado'); return node }
const label = node => React.Children.toArray(node.props?.children).filter(x => typeof x === 'string').join('')
function dialog(h) { const tree = h.render(), node = by(tree, n => n.type === 'dialog'); let opened = 0, closed = 0; node.props.ref.current = { showModal: () => opened++, close: () => closed++ }; return { opened: () => opened, closed: () => closed } }
test('SSR distingue vacío/error, conserva marca y no interpreta HTML', () => {
  const h = harness('src/app/afiliadas/AfiliadasCliente.tsx'), html = renderToStaticMarkup(h.render())
  assert.ok(html.includes('data-student-section-header="true"')); assert.ok(html.includes('&lt;script&gt;no ejecutar&lt;/script&gt;')); assert.ok(!html.includes('<script>no ejecutar'))
  assert.ok(html.includes('rel="noopener noreferrer"')); assert.ok(html.includes('Destino externo:'))
  const empty = harness('src/app/afiliadas/AfiliadasCliente.tsx', { estado: 'lista', recursos: [], limitado: false }); assert.ok(renderToStaticMarkup(empty.render()).includes('Por ahora no hay recursos publicados'))
  const fail = harness('src/app/afiliadas/AfiliadasCliente.tsx', { estado: 'error', mensaje: 'No disponible' }); const failed = renderToStaticMarkup(fail.render()); assert.ok(failed.includes('No pudimos reunir')); assert.ok(!failed.includes('Por ahora no hay recursos'))
  const admin = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx'); const dlg = dialog(admin); by(admin.render(), n => n.type === 'button' && label(n) === 'Crear recurso +').props.onClick(); assert.equal(dlg.opened(), 1)
  const adminHtml = renderToStaticMarkup(admin.render()); assert.ok(adminHtml.includes('href="/admin/afiliadas/accesos"')); assert.ok(adminHtml.includes('Gestionar accesos')); assert.ok(adminHtml.includes('Campaña o tema')); assert.ok(adminHtml.includes('Drive, Canva'));  assert.ok(adminHtml.includes('No se interpreta HTML') || adminHtml.includes('no se interpreta HTML')); assert.ok(adminHtml.includes('Archivar retira'))
})
test('copiar comunica éxito solo después de confirmación del portapapeles; error conserva alternativa manual', async () => {
  let resolve, captured
  const h = harness('src/app/afiliadas/AfiliadasCliente.tsx', undefined, { navigator: { clipboard: { writeText: text => { captured = text; return new Promise(r => { resolve = r }) } } } })
  const card = by(h.render(), n => typeof n.type === 'function' && n.props.recurso?.id === id)
  const pending = card.props.alCopiar(row); assert.equal(captured, datos.cuerpo); assert.ok(!renderToStaticMarkup(h.render()).includes('Copiado:'))
  resolve(); await pending; assert.ok(renderToStaticMarkup(h.render()).includes('Copiado: Recurso local de prueba'))
  const fail = harness('src/app/afiliadas/AfiliadasCliente.tsx', undefined, { navigator: { clipboard: { writeText: async () => { throw new Error('denegado') } } } })
  await by(fail.render(), n => typeof n.type === 'function' && n.props.recurso?.id === id).props.alCopiar(row); assert.ok(renderToStaticMarkup(fail.render()).includes('seleccionalo para copiarlo'))
})
test('guardado administrativo congela intento ambiguo y reintenta mismo UUID y contenido', async () => {
  const calls = []; let attempt = 0
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', { estado: 'lista', recursos: [], limitado: false }, { fetch: async (url, input) => { const body = JSON.parse(input.body); calls.push({ url, body }); return attempt++ === 0 ? Response.json({ error: 'Respuesta no confirmada' }, { status: 503 }) : Response.json({ recurso: { id: body.id, ...body.recurso, version: 1, creado_en: row.creado_en, actualizado_en: row.actualizado_en } }) } })
  const dlg = dialog(h); by(h.render(), n => n.type === 'button' && label(n) === 'Crear recurso +').props.onClick()
  by(h.render(), n => n.type === 'input' && n.props.maxLength === 140).props.onChange({ target: { value: 'Aviso de prueba local' } })
  by(h.render(), n => n.type === 'textarea').props.onChange({ target: { value: 'Mensaje completo de prueba.' } })
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  let tree = h.render(); assert.equal(by(tree, n => n.type === 'fieldset').props.disabled, true); assert.ok(renderToStaticMarkup(tree).includes('Reintentar mismo guardado')); assert.equal(dlg.closed(), 0)
  await by(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]); assert.equal(calls[0].body.id, id); assert.equal(dlg.closed(), 1); assert.ok(renderToStaticMarkup(h.render()).includes('Borrador guardado'))
})
test('doble envío se bloquea sin depender del render y una respuesta de otra versión no confirma éxito', async () => {
  let resolve, calls = 0
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', undefined, { fetch: async () => { calls++; return new Promise(r => { resolve = r }) } })
  dialog(h); by(h.render(), n => n.type === 'button' && n.props['aria-label'] === 'Editar ' + row.titulo).props.onClick()
  const submit = by(h.render(), n => n.type === 'form').props.onSubmit, pending = submit({ preventDefault() {} }); await submit({ preventDefault() {} }); assert.equal(calls, 1)
  resolve(Response.json({ recurso: { ...row, version: 99 } })); await pending
  const html = renderToStaticMarkup(h.render()); assert.ok(html.includes('La respuesta no confirma este recurso')); assert.ok(!html.includes('Recurso publicado en el espacio'))
})
test('actualización fallida retira listado privado en vez de presentar un vacío falso', async () => {
  const h = harness('src/app/afiliadas/AfiliadasCliente.tsx', undefined, { fetch: async () => Response.json({ error: 'Sin permiso' }, { status: 403 }) })
  await by(h.render(), n => n.type === 'button' && label(n) === 'Actualizar recursos').props.onClick()
  // onClick inicia una Promise sin devolverla; esperar el siguiente turno de microtareas.
  await new Promise(resolve => setImmediate(resolve))
  const html = renderToStaticMarkup(h.render()); assert.ok(html.includes('No pudimos reunir')); assert.ok(!html.includes(datos.titulo)); assert.ok(!html.includes('Por ahora no hay recursos publicados'))
})
test('controles mantienen marca sólida, límites y tamaño táctil sin envíos ocultos', () => {
  for (const file of ['src/app/afiliadas/AfiliadasCliente.tsx', 'src/app/admin/afiliadas/AfiliadasAdmin.tsx']) {
    const source = read(file); assert.ok(source.includes('min-h-11')); assert.ok(source.includes('text-base')); assert.ok(source.includes('#E7DDD5')); assert.ok(!source.includes('dangerouslySetInnerHTML')); assert.ok(!source.includes('backdrop-blur')); assert.ok(!source.includes('type="file"')); assert.ok(!source.includes('/api/push/'))
  }
  const source = read('src/app/admin/afiliadas/AfiliadasAdmin.tsx'); assert.ok(source.includes('max-h-[calc(100dvh-2rem)]')); assert.ok(source.includes('safe-area-inset-bottom')); assert.ok(source.includes('onCancel=')); assert.ok(source.includes("addEventListener('beforeunload'")); assert.ok(source.includes('aria-busy={guardando || subiendo}'))
})

test('archivo nuevo exige carga confirmada y guardar no compite con el envío', async () => {
  let calls = 0
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', { estado: 'lista', recursos: [], limitado: false }, { fetch: async (_url, input) => { calls++; const body = JSON.parse(input.body); return Response.json({ recurso: { id: body.id, ...body.recurso, version: 1, creado_en: row.creado_en, actualizado_en: row.actualizado_en } }) } })
  dialog(h); by(h.render(), n => n.type === 'button' && label(n) === 'Crear recurso +').props.onClick()
  by(h.render(), n => n.type === 'input' && n.props.maxLength === 140).props.onChange({ target: { value: 'Guía para vender' } })
  by(h.render(), n => n.type === 'select' && n.props.value === 'aviso').props.onChange({ target: { value: 'archivo' } })
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(calls, 0); assert.ok(renderToStaticMarkup(h.render()).includes('Subí el archivo'))
  let upload = by(h.render(), n => n.props.recursoId === id && typeof n.props.onUploaded === 'function')
  upload.props.onPending(true); upload.props.onBusy(true)
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(calls, 0); assert.equal(by(h.render(), n => n.type === 'button' && n.props.type === 'submit').props.disabled, true)
  upload.props.onBusy(false); upload.props.onUploaded({ id: '00000000-0000-4000-8000-000000000002', recursoId: id, nombre: 'guia.pdf', bytes: 30, mime: 'application/pdf', extension: 'pdf', url: `https://app.sociasdigitales.com/api/afiliadas/${id}/archivo/00000000-0000-4000-8000-000000000002` })
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(calls, 0)
  upload.props.onPending(false)
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(calls, 1); assert.ok(renderToStaticMarkup(h.render()).includes('Borrador guardado'))
})
test('cambiar origen conserva archivo y enlace preparados sin publicar ni perder el anterior', () => {
  const stored = { ...row, tipo: 'video', url: `https://app.sociasdigitales.com/api/afiliadas/${id}/archivo/00000000-0000-4000-8000-000000000002` }
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', { estado: 'lista', recursos: [stored], limitado: false })
  dialog(h); by(h.render(), n => n.type === 'button' && n.props['aria-label'] === 'Editar ' + stored.titulo).props.onClick()
  by(h.render(), n => n.type === 'button' && label(n) === 'Usar enlace').props.onClick()
  by(h.render(), n => n.type === 'input' && n.props.type === 'url').props.onChange({ target: { value: 'https://example.invalid/video' } })
  by(h.render(), n => n.type === 'button' && label(n) === 'Desde mi dispositivo').props.onClick()
  assert.equal(by(h.render(), n => n.props.recursoId === id && n.props.onUploaded).props.actualUrl, stored.url)
  by(h.render(), n => n.type === 'button' && label(n) === 'Usar enlace').props.onClick()
  assert.equal(by(h.render(), n => n.type === 'input' && n.props.type === 'url').props.value, 'https://example.invalid/video')
})
test('confirmar descarte no permite cerrar durante carga iniciada después de abrir el aviso', () => {
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx'); const dlg = dialog(h)
  by(h.render(), n => n.type === 'button' && label(n) === 'Crear recurso +').props.onClick()
  by(h.render(), n => n.type === 'select' && n.props.value === 'aviso').props.onChange({ target: { value: 'archivo' } })
  by(h.render(), n => n.type === 'button' && label(n) === 'Cerrar').props.onClick()
  const uploader = by(h.render(), n => n.props.recursoId === id && n.props.onUploaded)
  uploader.props.onBusy(true)
  const discard = by(h.render(), n => n.type === 'button' && label(n) === 'Descartar cambios y cerrar'); assert.equal(discard.props.disabled, true)
  discard.props.onClick(); assert.equal(dlg.closed(), 0)
  uploader.props.onBusy(false); by(h.render(), n => n.type === 'button' && label(n) === 'Descartar cambios y cerrar').props.onClick(); assert.equal(dlg.closed(), 1)
})

test('producto elegido filtra materiales y se conserva al crear un copy sin tocar la publicación', async () => {
  const product = '00000000-0000-4000-8000-000000000020', other = '00000000-0000-4000-8000-000000000021', calls = []
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', { estado: 'lista', recursos: [{ ...row, producto_id: product }, { ...row, id: other, titulo: 'General separado', producto_id: null }], limitado: false }, { props: { productos: [{ id: product, nombre: 'Producto de prueba' }], productoInicial: product }, fetch: async (_url, input) => { const body = JSON.parse(input.body); calls.push(body); return Response.json({ recurso: { ...row, id: body.id, ...body.recurso, version: 1 } }) } })
  let html = renderToStaticMarkup(h.render()); assert.ok(html.includes('Producto de prueba')); assert.ok(!html.includes('General separado'))
  dialog(h); by(h.render(), n => n.type === 'button' && label(n) === 'Crear recurso +').props.onClick()
  assert.equal(nodes(h.render()).filter(n => n.type === 'select' && n.props.value === product).length, 2)
  by(h.render(), n => n.type === 'input' && n.props.maxLength === 140).props.onChange({ target: { value: 'Material del producto' } })
  by(h.render(), n => n.type === 'textarea').props.onChange({ target: { value: 'Copy del producto.' } })
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(calls[0].recurso.producto_id, product); assert.equal(calls[0].recurso.estado, 'borrador')
  html = renderToStaticMarkup(h.render()); assert.ok(html.includes('Borrador guardado'))
})
test('fallo de opciones conserva asociación existente y bloquea asociación nueva sin perder textos', async () => {
  const product = '00000000-0000-4000-8000-000000000020', calls = []
  const existing = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', { estado: 'lista', recursos: [{ ...row, producto_id: product }], limitado: false }, { props: { errorProductos: true }, fetch: async (_url, input) => { const body = JSON.parse(input.body); calls.push(body); return Response.json({ recurso: { ...row, ...body.recurso, version: 2 } }) } })
  dialog(existing); by(existing.render(), n => n.type === 'button' && n.props['aria-label'] === 'Editar ' + row.titulo).props.onClick()
  assert.equal(by(existing.render(), n => n.type === 'select' && n.props.value === product).props.disabled, true)
  await by(existing.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(calls[0].recurso.producto_id, product)
  const h = harness('src/app/admin/afiliadas/AfiliadasAdmin.tsx', { estado: 'lista', recursos: [], limitado: false }, { props: { errorProductos: true, productoInicial: product }, fetch: async () => { throw new Error('No debe enviar') } })
  dialog(h); by(h.render(), n => n.type === 'button' && label(n) === 'Crear recurso +').props.onClick()
  by(h.render(), n => n.type === 'input' && n.props.maxLength === 140).props.onChange({ target: { value: 'Texto conservado' } })
  by(h.render(), n => n.type === 'textarea').props.onChange({ target: { value: 'Copy conservado.' } })
  await by(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  const html = renderToStaticMarkup(h.render()); assert.ok(html.includes('Actualizá los productos')); assert.ok(html.includes('Texto conservado')); assert.ok(html.includes('Copy conservado.'))
})
