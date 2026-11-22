/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const src = path => readFileSync(join(__dirname, '..', path), 'utf8')
function load(path, mocks = {}) {
  const mod = { exports: {} }
  const { outputText } = ts.transpileModule(src(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  new Function('require', 'exports', outputText)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports)
  return mod.exports
}
const ruta = 'src/app/admin/classroom/'
const grupos = [
  { id: '5e1a0b35-80ba-4c95-81dd-f3cfb994f1bc', nombre: 'Primeros pasos', orden: 0 },
  { id: '5e1a0b35-80ba-4c95-81dd-f3cfb994f1bd', nombre: 'Catálogo de temporada', orden: 1 },
]
const manejoClases = load('src/lib/class-management.ts')
const modulosFarmasi = load('src/lib/farmasi-submodules.ts', { './class-management': manejoClases })
const Panel = load(ruta + 'FarmasiSubmodulosAdmin.tsx', { '@/lib/farmasi-submodules': modulosFarmasi }).default
const empty = { submodulos: [], errorCarga: false, alActualizar() {}, alReintentar() {}, alNuevaClase() {} }
const renderPanel = props => renderToStaticMarkup(React.createElement(Panel, { ...empty, ...props }))

test('panel muestra un alta específica de Farmasi y un estado vacío comprensible', () => {
  const html = renderPanel({})
  assert.match(html, /Submódulos de Socias Farmasi/)
  assert.match(html, /Nombre del submódulo/)
  assert.match(html, /required="" maxLength="75"/)
  assert.match(html, /min-h-11[^"]*text-base/)
  assert.match(html, /Crear submódulo/)
  assert.match(html, /Nueva clase Farmasi/)
  assert.match(html, /Todavía no creaste submódulos/)
})

test('orden visible con controles por teclado y extremos deshabilitados; los nombres largos pueden quebrar', () => {
  const html = renderPanel({ submodulos: grupos })
  assert.match(html, /aria-label="Orden de los submódulos Farmasi"/)
  assert.match(html, /1\. Primeros pasos/)
  assert.match(html, /2\. Catálogo de temporada/)
  assert.match(html, /aria-disabled="true" aria-label="Mover Primeros pasos arriba"/)
  assert.match(html, /aria-disabled="false" aria-label="Mover Primeros pasos abajo"/)
  assert.match(html, /aria-disabled="false" aria-label="Mover Catálogo de temporada arriba"/)
  assert.match(html, /aria-disabled="true" aria-label="Mover Catálogo de temporada abajo"/)
  assert.match(html, /overflow-wrap:anywhere/)
})

test('si falla el listado muestra reintento y nunca anuncia lista vacía ni permite mover', () => {
  const html = renderPanel({ errorCarga: true })
  assert.match(html, /role="alert".*No pudimos cargar los submódulos/)
  assert.match(html, /Reintentar/)
  assert.doesNotMatch(html, /Todavía no creaste|Crear submódulo|>↑ Subir/)
})

test('el editor ordinario no muestra selector, conserva Vimeo; Farmasi puede seleccionar o quitar sin tocar acceso', () => {
  function renderEditor(esFarmasi, errorSubmodulos = false) {
    let llamado = 0
    const ficha = { titulo: 'Clase de prueba', descripcion: '', vimeo_url: '', modulo: 'Desafío Socias', orden: 0,
      activo: false, acceso_gratuito: false, solo_farmaci: esFarmasi, farmasi_submodulo_id: esFarmasi ? grupos[1].id : undefined, tieneVideo: false }
    const Admin = load(ruta + 'ClassroomAdmin.tsx', {
      react: { ...React, useState(initial) { llamado++; return React.useState(llamado === 3 ? ficha : initial) } },
      'next/link': { default: ({ children }) => React.createElement('a', null, children) },
      'next/navigation': { useRouter: () => ({ refresh() {} }) },
      '@/components/AdminSectionMenu': { default: () => null },
      '@/lib/supabase/client': { createClient: () => null },
      '@/lib/class-management': manejoClases,
      './VideoUpload': { default: () => null },
      './ClassProgressAdmin': { default: () => null },
      '@/components/ClassVideoThumbnail': { default: () => null },
      './ClassMaterialsEditor': { default: () => null },
      './FarmasiSubmodulosAdmin': { default: Panel },
    }).default
    return renderToStaticMarkup(React.createElement(Admin, { clases: [], alumnas: [], submodulos: grupos, errorSubmodulos }))
  }
  const normal = renderEditor(false)
  assert.match(normal, /Usar enlace de Vimeo/)
  assert.doesNotMatch(normal, /Submódulo Farmasi<select/)
  const farmasi = renderEditor(true)
  assert.doesNotMatch(farmasi, /Usar enlace de Vimeo/)
  assert.match(farmasi, /Submódulo Farmasi<select/)
  assert.match(farmasi, /<option value="">Sin submódulo<\/option>/)
  assert.match(farmasi, /selected="">Catálogo de temporada<\/option>/)
  const fallo = renderEditor(true, true)
  assert.match(fallo, /Submódulo Farmasi<select[^>]+disabled=""/)
  assert.match(fallo, /La asociación actual se conserva al guardar/)
  const fuente = src(ruta + 'ClassroomAdmin.tsx')
  assert.match(fuente, /datos\.solo_farmaci && submoduloEditado/)
  assert.match(fuente, /delete clase\.farmasi_submodulo_id/)
})

test('alta y reorden usan el endpoint Farmasi con bloqueo inmediato y conservan los datos si falla', async () => {
  const original = globalThis.fetch
  const peticiones = [], vistas = []
  let resolver
  globalThis.fetch = (url, init) => {
    peticiones.push([url, JSON.parse(init.body)])
    return new Promise(resolve => { resolver = resolve })
  }
  const estado = ['  Plan   de práctica  ', false, '', '']
  let n = 0
  const panel = load(ruta + 'FarmasiSubmodulosAdmin.tsx', {
    react: { useState() { const i = n++; return [estado[i], valor => { estado[i] = valor }] }, useRef: () => ({ current: false }) },
    '@/lib/farmasi-submodules': modulosFarmasi,
  }).default
  function buscar(nodo, filtro) {
    if (Array.isArray(nodo)) return nodo.map(hijo => buscar(hijo, filtro)).find(Boolean)
    if (!nodo?.props) return undefined
    if (filtro(nodo)) return nodo
    return buscar(nodo.props.children, filtro)
  }
  const alActualizar = lista => vistas.push(lista)
  try {
    const vista = panel({ ...empty, submodulos: grupos, alActualizar })
    const formulario = buscar(vista, nodo => nodo.type === 'form')
    formulario.props.onSubmit({ preventDefault() {} })
    formulario.props.onSubmit({ preventDefault() {} })
    assert.equal(peticiones.length, 1)
    assert.deepEqual(peticiones[0], ['/api/admin/farmasi/submodulos', { accion: 'crear', nombre: 'Plan de práctica' }])
    resolver(Response.json({ error: 'Ya hay un submódulo con ese nombre.' }, { status: 409 }))
    await new Promise(setImmediate)
    assert.equal(estado[0], '  Plan   de práctica  ')
    assert.match(estado[3], /Ya hay un submódulo/)
    assert.deepEqual(vistas, [])

    const subir = buscar(vista, nodo => nodo.props['aria-label'] === 'Mover Catálogo de temporada arriba')
    subir.props.onClick()
    assert.deepEqual(peticiones[1], ['/api/admin/farmasi/submodulos', { accion: 'mover', id: grupos[1].id, direccion: 'arriba' }])
    const reordenados = [{ ...grupos[1], orden: 0 }, { ...grupos[0], orden: 1 }]
    resolver(Response.json({ submodulos: reordenados }))
    await new Promise(setImmediate)
    assert.equal(estado[2], 'Orden actualizado.')
    assert.deepEqual(vistas, [reordenados])
  } finally {
    globalThis.fetch = original
  }
})
