/* eslint-disable @typescript-eslint/no-require-imports -- Pruebas CommonJS del runner nativo. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports)
  return m.exports
}
const money = load('src/lib/product-money.ts')
const base = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Producto ficticio local', descripcion: '', tipo: 'digital', subtipo: 'Ebook', marca: '', precio: 120, moneda: 'USD', comision_pct: 20, imagen_url: '', link_compra: '', activo: true, orden: 0 }
function all(node, predicate) { if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))] }
function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); if (!node || typeof node !== 'object') return ''; return [node.props?.children].flat(Infinity).map(text).join('') }
function ui(props = {}, handle = async q => ({ data: { ...base, ...q.payload, id: q.payload?.id ?? base.id }, error: null }), upload = async () => ({ error: null })) {
  const cells = [], queries = [], uploads = [], effects = []; let cursor = 0, refreshes = 0
  let current = { productos: [base], cotizacion: 1000, ...props }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial; return [cells[i], v => { cells[i] = typeof v === 'function' ? v(cells[i]) : v }] },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useEffect(effect) { effects.push(effect) },
  }
  const supabase = {
    from(table) {
      const q = { table, op: 'select', payload: null, filters: [] }
      const builder = {
        update(payload) { q.op = 'update'; q.payload = payload; return builder },
        insert(payload) { q.op = 'insert'; q.payload = payload; return builder },
        select(fields) { q.fields = fields; return builder },
        eq(key, value) { q.filters.push([key, value]); return builder },
        async maybeSingle() { queries.push(q); return handle(q, queries.length) },
      }
      return builder
    },
    storage: { from(bucket) { return { async upload(name, file, options) { uploads.push({ bucket, name, file, options }); return upload(name, file, options) }, getPublicUrl(name) { return { data: { publicUrl: `https://example.invalid/${name}` } } } } } },
  }
  const Component = load('src/app/admin/productos/ProductosAdmin.tsx', { react, 'next/navigation': { useRouter: () => ({ refresh: () => { refreshes++ } }) }, '@/lib/supabase/client': { createClient: () => supabase }, '@/components/AdminSectionMenu': { default: () => null }, '@/lib/product-money': money }).default
  const render = () => { cursor = 0; return Component(current) }
  const button = title => all(render(), n => n.type === 'button').find(n => text(n).trim() === title)
  const field = id => all(render(), n => n.props?.id === `producto-${id}`)[0]
  return { render, queries, uploads, effects, refreshes: () => refreshes, html: () => renderToStaticMarkup(render()), button, field, setProps: p => { current = { ...current, ...p } }, modal: () => all(render(), n => n.type === 'dialog')[0], change: (id, value) => field(id).props.onChange({ target: { value } }) }
}
test('Productos conserva ficha y datos ante fallo, respuesta vacía o caída; solo confirma la fila retornada', async () => {
  for (const failure of [{ data: null, error: { message: 'RLS' } }, { data: null, error: null }, 'throw']) {
    const view = ui({}, async () => { if (failure === 'throw') throw new Error('red'); return failure })
    view.button('Editar').props.onClick({ currentTarget: null }); view.change('nombre', 'Edición conservada')
    await view.button('Guardar producto').props.onClick()
    assert.ok(view.modal()); assert.equal(view.field('nombre').props.value, 'Edición conservada')
    assert.match(view.html(), /role="alert"/); assert.equal(view.refreshes(), 0)
    assert.equal(view.button('Guardar producto').props.disabled, false)
  }
  const good = ui(); good.button('Editar').props.onClick({ currentTarget: null }); good.change('precio', '45.50')
  await good.button('Guardar producto').props.onClick()
  assert.equal(good.modal(), undefined); assert.equal(good.refreshes(), 1); assert.match(good.html(), /Producto guardado/)
  assert.equal(good.queries[0].payload.precio, 45.5); assert.ok(!('id' in good.queries[0].payload))
})
test('alta conserva UUID al reintentar y recupera una respuesta perdida sin insertar otra identidad', async () => {
  let inserted = null, attempts = 0
  const view = ui({ productos: [] }, async q => {
    if (q.op === 'insert') { attempts++; inserted = q.payload; return { data: null, error: { message: 'respuesta perdida' } } }
    return { data: attempts === 1 ? null : inserted, error: null }
  })
  view.button('+ Nuevo producto').props.onClick({ currentTarget: null }); view.change('nombre', 'Alta ficticia')
  await view.button('Guardar producto').props.onClick(); assert.ok(view.modal()); assert.equal(view.refreshes(), 0)
  const id = view.queries[0].payload.id
  await view.button('Guardar producto').props.onClick()
  assert.equal(view.queries.filter(q => q.op === 'insert').length, 2)
  assert.equal(view.queries[2].payload.id, id); assert.equal(view.modal(), undefined); assert.equal(view.refreshes(), 1)
  assert.match(view.html(), /Alta ficticia/)
})
test('validaciones no escriben precios inválidos, comisión fuera de rango ni enlaces inseguros', async () => {
  for (const [field, value] of [['precio', '-2'], ['precio', '1.001'], ['comision', '101'], ['nombre', '   '], ['link', 'javascript:alert(1)'], ['link', 'https://usuario:clave@example.invalid']]) {
    const view = ui(); view.button('Editar').props.onClick({ currentTarget: null }); view.change(field, value)
    await view.button('Guardar producto').props.onClick()
    assert.equal(view.queries.length, 0); assert.ok(view.modal()); assert.match(view.html(), /role="alert"/)
  }
})
test('estado se actualiza solo al confirmar; fallo mantiene estado y ofrece actualizar, sin borrar históricos', async () => {
  const view = ui({}, async () => ({ data: null, error: null }))
  await view.button('Desactivar').props.onClick()
  assert.ok(view.button('Desactivar')); assert.match(view.html(), /No pudimos confirmar el cambio/); assert.equal(view.refreshes(), 0)
  assert.deepEqual(view.queries[0].filters, [['id', base.id], ['activo', true]])
  const good = ui()
  await good.button('Desactivar').props.onClick(); assert.ok(good.button('Activar')); assert.match(good.html(), /Su historial se conserva/)
  await good.button('Activar').props.onClick(); assert.ok(good.button('Desactivar'))
  assert.ok(!read('src/app/admin/productos/ProductosAdmin.tsx').includes('.delete()'))
  assert.ok(!read('src/app/admin/productos/ProductosAdmin.tsx').includes('confirm('))
  good.setProps({ productos: [{ ...base, nombre: 'Cambio de otra administradora', activo: false }] })
  assert.match(good.html(), /Cambio de otra administradora/); assert.ok(good.button('Activar'))
})
test('guardado y cambio de estado bloquean el doble clic antes de esperar la red', async () => {
  for (const editing of [true, false]) {
    let release
    const view = ui({}, q => new Promise(resolve => { release = () => resolve({ data: { ...base, ...q.payload }, error: null }) }))
    if (editing) view.button('Editar').props.onClick({ currentTarget: null })
    const action = view.button(editing ? 'Guardar producto' : 'Desactivar')
    const first = action.props.onClick(), second = action.props.onClick()
    await second; assert.equal(view.queries.length, 1)
    if (editing) { assert.equal(view.button('Cancelar').props.disabled, true); assert.equal(view.button('Cerrar ficha de producto'), undefined) }
    release(); await first; assert.equal(view.refreshes(), 1)
  }
})
test('imagen fallida conserva la anterior y no cierra ficha; carga bloquea guardar/cancelar y limita formato/tamaño', async () => {
  let release
  const view = ui({ productos: [{ ...base, imagen_url: 'https://example.invalid/anterior.jpg' }] }, undefined, () => new Promise(resolve => { release = resolve }))
  view.button('Editar').props.onClick({ currentTarget: null })
  const input = all(view.render(), n => n.type === 'input' && n.props.type === 'file')[0]
  const uploading = input.props.onChange({ target: { files: [{ type: 'image/png', size: 12 }], value: 'imagen.png' } })
  assert.equal(view.button('Guardar producto').props.disabled, true); assert.equal(view.button('Cancelar').props.disabled, true)
  await view.button('Guardar producto').props.onClick(); assert.equal(view.queries.length, 0)
  release({ error: { message: 'falló' } }); await uploading
  assert.match(view.html(), /Conservamos la anterior/); assert.match(view.html(), /anterior.jpg/); assert.ok(view.modal())
  for (const file of [{ type: 'image/svg+xml', size: 10 }, { type: 'image/jpeg', size: 3 * 1024 * 1024 + 1 }]) await input.props.onChange({ target: { files: [file], value: 'otra' } })
  assert.equal(view.uploads.length, 1); assert.equal(view.uploads[0].options.upsert, false)
})
test('moneda visible y etiqueta del editor siguen ARS/USD/MXN/EUR; conversión solo USD con cotización comprobada', () => {
  for (const moneda of ['ARS', 'MXN', 'EUR']) {
    const view = ui({ productos: [{ ...base, moneda }] })
    assert.match(view.html(), new RegExp(moneda)); assert.ok(!view.html().includes('Aprox.'))
    view.button('Editar').props.onClick({ currentTarget: null }); assert.match(view.html(), new RegExp(`Precio en ${moneda}`))
    assert.ok(!view.html().includes('Precio en USD'))
  }
  assert.match(ui().html(), /Aprox./)
  assert.ok(!ui({ cotizacion: null }).html().includes('Aprox.'))
})
test('catálogo fallido no muestra ceros ni vacío y bloquea altas; formulario usa diálogo y campos de 16px', () => {
  const view = ui({ errorCarga: true, productos: [] })
  assert.match(view.html(), /No pudimos cargar el catálogo completo/); assert.ok(!view.html().includes('No hay productos todavía'))
  assert.equal(view.button('+ Nuevo producto').props.disabled, true)
  const good = ui(); good.button('Editar').props.onClick({ currentTarget: null })
  assert.ok(good.modal()); assert.equal(good.modal().props['aria-labelledby'], 'titulo-producto')
  for (const node of all(good.render(), n => ['input', 'select', 'textarea'].includes(n.type) && n.props.type !== 'file')) assert.match(node.props.className, /text-base/)
})

test('lectura administrativa distingue catálogo completo, parcial y fallido; cotización ausente no se inventa', async () => {
  async function page({ products = { data: [base], error: null, count: 1 }, config = { data: [], error: null }, role = 'admin', user = { id: 'administradora-ficticia' } } = {}) {
    const calls = []
    const client = { auth: { async getUser() { return { data: { user } } } }, from(table) {
      const q = { table, calls: [] }; calls.push(q)
      const b = { select(...args) { q.calls.push(['select', ...args]); return b }, order(...args) { q.calls.push(['order', ...args]); return b }, limit(...args) { q.calls.push(['limit', ...args]); return b }, eq(...args) { q.calls.push(['eq', ...args]); return b }, async single() { return { data: role ? { rol: role } : null } }, then(resolve, reject) { return Promise.resolve(table === 'productos' ? products : config).then(resolve, reject) } }
      return b
    } }
    const Component = load('src/app/admin/productos/page.tsx', { '@/lib/supabase/server': { createClient: async () => client }, 'next/navigation': { redirect: url => { throw new Error(`redirect:${url}`) } }, './ProductosAdmin': { default: () => null }, '@/lib/product-money': money }).default
    return { node: await Component(), calls }
  }
  const good = await page(); assert.equal(good.node.props.errorCarga, false); assert.equal(good.node.props.cotizacion, null); assert.equal(good.node.props.productos.length, 1)
  const configured = await page({ config: { data: [{ clave: 'cotizacion_dolar', valor: '1250' }], error: null } }); assert.equal(configured.node.props.cotizacion, 1250)
  for (const products of [{ data: [base], error: null, count: 2 }, { data: [], error: { message: 'fallo' }, count: 0 }, { data: [], error: null, count: null }]) {
    const result = await page({ products }); assert.equal(result.node.props.errorCarga, true); assert.deepEqual(result.node.props.productos, [])
  }
  for (const value of ['0', '-1', 'infinito']) assert.equal((await page({ config: { data: [{ clave: 'cotizacion_dolar', valor: value }], error: null } })).node.props.cotizacion, null)
  await assert.rejects(page({ user: null }), /redirect:\/login/)
  await assert.rejects(page({ role: 'alumna' }), /redirect:\/perfil/)
})

test('catálogo heredado conserva moneda del producto en precio y comisión estimada; no convierte ARS/MXN/EUR', () => {
  const Legacy = load('src/app/productos/ProductosCliente.tsx', {
    react: { useState: initial => [initial, () => {}] },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    'next/link': { default: ({ children, ...props }) => require('react').createElement('a', props, children) },
    '@/lib/supabase/client': { createClient: () => ({}) }, '@/lib/product-money': money,
  }).default
  const html = (moneda, cotizacion = 1250) => renderToStaticMarkup(Legacy({ productos: [{ ...base, moneda }], misLinks: [], userId: 'administradora-ficticia', cotizacion }))
  for (const moneda of ['USD', 'ARS', 'MXN', 'EUR']) {
    const rendered = html(moneda)
    assert.ok(rendered.includes(money.precioProducto(120, moneda)))
    assert.ok(rendered.includes(money.precioProducto(24, moneda)))
    assert.match(rendered, /comisión estimada por venta/)
    assert.equal(rendered.includes('Aprox.'), moneda === 'USD')
    if (moneda !== 'USD') assert.ok(!rendered.includes('USD'))
  }
  assert.ok(!html('USD', null).includes('Aprox.'))
  assert.equal(money.cotizacionProducto(undefined), null)
  assert.equal(money.cotizacionProducto(null), null)
  assert.equal(money.cotizacionProducto(''), null)
  assert.equal(money.cotizacionProducto(false), null)
  assert.equal(money.cotizacionProducto(Infinity), null)
  assert.equal(money.cotizacionProducto('1250'), 1250)
})

test('ruta anterior de Productos conserva bloqueo alumno y administración usa el catálogo real de Afiliadas', async () => {
  async function page(admin, config = { data: [], error: null }) {
    const calls = []
    const client = { auth: { async getUser() { return { data: { user: { id: 'cuenta-ficticia' } } } } }, from(table) {
      calls.push(table)
      const b = { select() { return b }, eq() { return b }, order() { return b }, then(resolve, reject) { return Promise.resolve(table === 'configuracion' ? config : { data: [], error: null }).then(resolve, reject) } }
      return b
    } }
    const Locked = () => null
    const Component = load('src/app/productos/page.tsx', {
      '@/lib/supabase/server': { createClient: async () => client }, '@/lib/module-guard': { esAdministradora: async () => admin },
      '@/components/ModuleLocked': { default: Locked }, 'next/navigation': { redirect: url => { throw new Error(`redirect:${url}`) } },
      './ProductosCliente': { default: () => null }, '@/lib/product-money': money,
    }).default
    return { node: await Component(), calls, Locked }
  }
  const locked = await page(false)
  assert.equal(locked.node.type, locked.Locked); assert.equal(locked.node.props.id, 'productos'); assert.deepEqual(locked.calls, [])
  await assert.rejects(page(true), /redirect:\/admin\/afiliadas\/productos/)
})

test('cerrar ficha devuelve foco a su botón de origen mientras siga en el documento', () => {
  for (const title of ['Editar', '+ Nuevo producto']) for (const isConnected of [true, false]) {
    const view = ui(), focus = [], calls = []
    const origin = { isConnected, focus: options => focus.push(options) }
    view.button(title).props.onClick({ currentTarget: origin })
    const dialog = view.modal()
    dialog.props.ref.current = { showModal: () => calls.push('open'), close: () => calls.push('close') }
    const cleanup = view.effects.at(-1)()
    cleanup()
    assert.deepEqual(calls, ['open', 'close'])
    assert.deepEqual(focus, isConnected ? [{ preventScroll: true }] : [])
  }
})
