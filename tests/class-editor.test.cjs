const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, deps = {}) {
  const m = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const nueva = { titulo: 'Abrí tu cuenta en Hotmart', modulo: 'Desafío Socias en vivo', descripcion: '', orden: 1, vimeo_url: '', tieneVideo: false, activo: false, acceso_gratuito: false }
function editor(ficha, extra = {}, busy = false, materialStates = []) {
  // null = no newer, server-confirmed Farmasi group list; material state follows it.
  const updates = [], values = ['clases', 'Todos', ficha, busy, false, '', '', '', [], null, ...materialStates]
  let index = 0
  const Component = load('src/app/admin/classroom/ClassroomAdmin.tsx', {
    react: { ...React, useEffect: () => {}, useRef: () => ({ current: null }), useState: initial => { const n = index++; return [n < values.length ? values[n] : initial, value => updates.push([n, value])] } },
    'next/link': { default: props => React.createElement('a', props) },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/AdminSectionMenu': { default: () => null },
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/lib/class-management': management,
    './VideoUpload': { default: props => React.createElement('section', { 'data-upload-for': props.claseId }, 'Elegir archivo') },
    './ClassProgressAdmin': { default: () => null },
    '@/components/ClassVideoThumbnail': { default: () => null },
    './ClassMaterialsEditor': { default: props => React.createElement('section', { 'data-materials-for': props.claseId }, 'Materiales de la clase') },
    './FarmasiSubmodulosAdmin': { default: () => null },
  }).default
  const tree = Component({ clases: [], alumnas: [], ...extra })
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return null
    if (predicate(node)) return node
    for (const child of React.Children.toArray(node.props?.children)) {
      const match = find(predicate, child)
      if (match) return match
    }
    return null
  }
  return { html: renderToStaticMarkup(tree), find, updates }
}
test('solo un video cargado o Vimeo válido habilita publicar; texto y URLs falsas no', () => {
  assert.equal(management.puedePublicarClase(nueva), false)
  assert.equal(management.puedePublicarClase({ ...nueva, tieneVideo: true }), true)
  for (const url of ['https://vimeo.com/123456', ' https://www.vimeo.com/123456/abc ']) assert.equal(management.puedePublicarClase({ ...nueva, vimeo_url: url }), true)
  for (const url of ['', 'https://', 'javascript:alert(1)', 'https://vimeo.com.evil.test/123456', 'https://youtube.com/123']) assert.equal(management.puedePublicarClase({ ...nueva, vimeo_url: url }), false)
})
test('nueva ficha ofrece guardar borrador, tres pasos y publicación deshabilitada', () => {
  const view = editor(nueva)
  assert.ok(view.html.includes('Pasos para publicar una clase'))
  assert.ok(view.html.includes('Guardar borrador y continuar al video'))
  assert.ok(view.html.includes('Al guardar el borrador aparecerá aquí el selector'))
  const publication = view.find(n => n.type === 'input' && n.props['aria-describedby'] === 'clase-publicacion-ayuda')
  assert.equal(publication.props.disabled, true)
  assert.equal(publication.props.checked, false)
  assert.ok(!view.html.includes('data-upload-for'))
})
test('después de guardar aparece carga de video y se conserva el borrador hasta publicar', () => {
  const view = editor({ ...nueva, id: 'fixture' })
  assert.ok(view.html.includes('data-upload-for="fixture"'))
  assert.ok(view.html.includes('Guardar borrador'))
  assert.ok(view.html.includes('aria-current="step"'))
  const ready = editor({ ...nueva, id: 'fixture', tieneVideo: true })
  assert.equal(ready.find(n => n.type === 'input' && n.props['aria-describedby'] === 'clase-publicacion-ayuda').props.disabled, false)
  assert.ok(!ready.html.includes('Guardar y publicar clase'))
})
test('clases publicadas y Vimeo conservan publicación; retirar Vimeo vuelve a borrador', () => {
  for (const ficha of [{ ...nueva, id: 'fixture', tieneVideo: true, activo: true }, { ...nueva, vimeo_url: 'https://vimeo.com/123456', activo: true }]) {
    const view = editor(ficha)
    assert.ok(view.html.includes('Guardar y publicar clase'))
    assert.equal(view.find(n => n.type === 'input' && n.props['aria-describedby'] === 'clase-publicacion-ayuda').props.checked, true)
  }
  const view = editor({ ...nueva, vimeo_url: 'https://vimeo.com/123456', activo: true })
  view.find(n => n.type === 'input' && n.props.placeholder === 'https://vimeo.com/123456789').props.onChange({ target: { value: '' } })
  assert.equal(view.updates.at(-1)[1].activo, false)
})
test('guardar sin video corrige publicación obsoleta y usa el id devuelto sin crear otra ficha', async () => {
  const before = global.fetch
  let sent
  global.fetch = async (_url, opts) => { sent = JSON.parse(opts.body); return { ok: true, json: async () => ({ id: 'persisted-fixture' }) } }
  try {
    const view = editor({ ...nueva, activo: true })
    await view.find(n => n.type === 'form', view.find(n => n.props?.role === 'dialog')).props.onSubmit({ preventDefault() {} })
    assert.equal(sent.activo, false)
    assert.equal(sent.titulo, nueva.titulo)
    assert.equal(sent.acceso_gratuito, false)
    const saved = view.updates.find(([i, value]) => i === 2 && value?.id)
    assert.equal(saved[1].id, 'persisted-fixture')
    assert.equal(saved[1].activo, false)
  } finally { global.fetch = before }
})
test('la API acepta borrador sin video pero sigue rechazando publicación vacía', async () => {
  let inserted
  const api = load('src/app/api/admin/clases/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '@/lib/class-management': management,
    '@/lib/admin-auth': { autorizarAdmin: async () => ({ supabase: { from: () => ({ insert: value => { inserted = value; return { select: () => ({ single: async () => ({ data: { id: 'fixture' } }) }) } } }) } }) },
  })
  const request = activo => new Request('https://app.test/api/admin/clases', { method: 'POST', body: JSON.stringify({ ...nueva, activo }) })
  assert.equal((await api.POST(request(false))).status, 200)
  assert.equal(inserted.activo, false)
  inserted = null
  assert.equal((await api.POST(request(true))).status, 400)
  assert.equal(inserted, null)
})
test('guardar cambios de una clase con video conserva publicación y modalidad gratuita', async () => {
  const before = global.fetch
  let sent
  global.fetch = async (_url, opts) => { sent = JSON.parse(opts.body); return { ok: true, json: async () => ({ id: 'existing-fixture' }) } }
  try {
    const view = editor({ ...nueva, id: 'existing-fixture', activo: true, tieneVideo: true, acceso_gratuito: true })
    await view.find(n => n.type === 'form', view.find(n => n.props?.role === 'dialog')).props.onSubmit({ preventDefault() {} })
    assert.equal(sent.id, 'existing-fixture')
    assert.equal(sent.activo, true)
    assert.equal(sent.acceso_gratuito, true)
  } finally { global.fetch = before }
})
test('carga/guardado bloquea el formulario y un error conserva la ficha para reintentar', async () => {
  assert.equal(editor(nueva, {}, true).find(n => n.type === 'fieldset').props.disabled, true)
  const before = global.fetch
  global.fetch = async () => ({ ok: false, json: async () => ({ error: 'Sin conexión. Reintentá.' }) })
  try {
    const view = editor(nueva)
    await view.find(n => n.type === 'form', view.find(n => n.props?.role === 'dialog')).props.onSubmit({ preventDefault() {} })
    assert.ok(view.updates.some(([i, value]) => i === 6 && value === 'Sin conexión. Reintentá.'))
    assert.ok(!view.updates.some(([i]) => i === 2))
    assert.deepEqual(view.updates.at(-1), [3, false])
  } finally { global.fetch = before }
})
test('cerrar y Escape conservan materiales pendientes salvo confirmación explícita', () => {
  const before = global.window
  let confirms = 0, allow = false
  global.window = { confirm: () => { confirms++; return allow } }
  try {
    const view = editor({ ...nueva, id: 'fixture' }, {}, false, [false, true])
    view.find(n => n.props?.['aria-label'] === 'Cerrar editor').props.onClick()
    assert.equal(confirms, 1)
    assert.ok(!view.updates.some(([n]) => n === 2))
    view.find(n => n.props?.role === 'dialog').props.onKeyDown({ key: 'Escape', preventDefault() {} })
    assert.equal(confirms, 2)
    assert.ok(!view.updates.some(([n]) => n === 2))
    allow = true
    view.find(n => n.props?.['aria-label'] === 'Cerrar editor').props.onClick()
    assert.deepEqual(view.updates.at(-1), [2, null])
    assert.deepEqual(view.updates.slice(-2), [[11, false], [2, null]])
    const clean = editor({ ...nueva, id: 'fixture' })
    clean.find(n => n.props?.['aria-label'] === 'Cerrar editor').props.onClick()
    assert.equal(confirms, 3)
    assert.deepEqual(clean.updates.at(-1), [2, null])
  } finally { global.window = before }
})
