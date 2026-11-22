const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n === 'server-only' ? {} : n in deps ? deps[n] : require(n), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const progress = load('src/lib/class-progress.ts')
test('Bienvenida es programa independiente; el apoyo pertenece a Desafío, con clasificación persistente y compatible', () => {
  assert.deepEqual(management.ubicacionClase('Introducción'), { programa: 'Bienvenida', seccion: 'Clases' })
  assert.deepEqual(management.ubicacionClase('Desafío Socias en vivo'), { programa: 'Desafío Socias', seccion: 'Clases' })
  const destino = management.clasificacionClase('Desafío Socias', 'Material de apoyo')
  assert.deepEqual(management.ubicacionClase(destino), { programa: 'Desafío Socias', seccion: 'Material de apoyo' })
  const ficha = management.datosClase({ titulo: 'Hotmart', modulo: destino, orden: 0, activo: true, acceso_gratuito: false })
  assert.equal(ficha.modulo, destino)
  assert.equal(ficha.activo, true)
  assert.equal(ficha.acceso_gratuito, false)
  for (const bad of ['', 'x'.repeat(76), 'DS › Otro']) assert.equal(management.clasificacionClase(bad), null)
  for (const bad of ['DS › Otro', 'DS › Material de apoyo › Clases', 'DS›Material de apoyo']) assert.equal(management.datosClase({ titulo: 't', modulo: bad, orden: 0 }), null)
})
test('secciones conservan IDs/progreso y tienen orden estable independiente', () => {
  const classes = [{ id: 'b', orden: 1 }, { id: 'a', orden: 0 }]
  assert.deepEqual(management.ordenarClases(classes).map(c => c.id), ['a', 'b'])
  assert.deepEqual(classes.map(c => c.id), ['b', 'a'])
  assert.equal(progress.resumenPrograma(classes.map(c => c.id), [{ clase_id: 'a', completada: true }]).porcentaje, 50)
  const ui = read('src/app/classroom/ClassroomCliente.tsx')
  assert.match(ui, /ubicacionClase\(c.modulo\).seccion\s*===\s*ubicacionClase\(claseAbierta.modulo\).seccion/)
})
test('programa plegable sin portada, con clases y apoyo dentro; búsqueda mantiene las secciones', () => {
  const Component = load('src/app/classroom/ClassroomProgram.tsx', {
    '@/lib/class-management': management, '@/lib/class-progress': progress,
    '@/lib/class-library-filters': load('src/lib/class-library-filters.ts', { './class-management': management }),
    '@/components/ClassVideoThumbnail': { default: props => React.createElement('span', { 'data-poster-id': props.id }) },
  }).default
  const base = { descripcion: null, vimeo_url: null, tiene_video_privado: true, activo: true, puede_ver: true, plan: '27', acceso_gratuito: false }
  const props = { programa: 'Desafío Socias', clases: [{ ...base, id: 'a', titulo: 'Clase 1', orden: 0, modulo: 'Desafío Socias' }, { ...base, id: 'b', titulo: 'Hotmart', orden: 0, modulo: 'Desafío Socias › Material de apoyo' }], progreso: [], buscar: '', esAdmin: false, tieneAcceso: true, cargando: false, abierto: false, onAbrir() {} }
  const html = renderToStaticMarkup(React.createElement(Component, props))
  assert.ok(html.startsWith('<details '))
  assert.ok(!html.startsWith('<details open='))
  assert.ok(html.includes('Material de apoyo'))
  assert.equal((html.match(/data-poster-id/g) || []).length, 2)
  assert.ok(html.indexOf('data-poster-id') > html.indexOf('</summary>'))
  assert.ok(html.includes('Reproducir Clase 1'))
  const summaries = [...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)]
  assert.equal(summaries.length, 3)
  for (const [summary, content] of summaries) {
    assert.ok(summary.includes('focus-visible:outline-2'))
    assert.ok(content.includes('aria-hidden="true"'))
    assert.ok(content.includes('h-11 w-11'))
    assert.ok(content.includes('rounded-full border'))
    assert.ok(content.includes('<svg'))
    assert.ok(!content.includes('<button'))
  }
  assert.ok(html.includes('group/programa'))
  assert.ok(html.includes('group-open/programa:rotate-180'))
  assert.equal((html.match(/group\/seccion/g) || []).length, 2)
  assert.equal((html.match(/group-open\/seccion:rotate-180/g) || []).length, 2)
  const found = renderToStaticMarkup(React.createElement(Component, { ...props, buscar: 'Hotmart' }))
  assert.ok(found.includes('open=""'))
  assert.ok(!found.includes('Reproducir Clase 1'))
  const bienvenida = renderToStaticMarkup(React.createElement(Component, { ...props, programa: 'Bienvenida', clases: [props.clases[0]] }))
  assert.ok(!bienvenida.includes('Material de apoyo'))
})
test('renombrar un programa incluye sus secciones y no modifica videos, estado o acceso', async () => {
  const writes = []
  const db = { from: () => ({ select: async () => ({ data: [{ modulo: 'Desafío Socias' }, { modulo: 'Desafío Socias › Material de apoyo' }, { modulo: 'Bienvenida' }] }), update: values => ({ eq: async (key, value) => { writes.push({ values, key, value }); return {} } }) }) }
  const api = load('src/app/api/admin/clases/route.ts', { 'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200 }) } }, '@/lib/admin-auth': { autorizarAdmin: async () => ({ supabase: db }) }, '@/lib/class-management': management })
  const res = await api.POST(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ action: 'renombrar', anterior: 'Desafío Socias', nuevo: 'Otro programa' }) }))
  assert.equal(res.status, 200)
  assert.deepEqual(writes.map(w => w.values), [{ modulo: 'Otro programa' }, { modulo: 'Otro programa › Material de apoyo' }])
})
