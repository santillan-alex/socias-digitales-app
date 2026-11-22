/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const test = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
const read = file => readFileSync(join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const groups = load('src/lib/farmasi-class-groups.ts')
const modulo = (id, nombre, orden) => ({ id, nombre, orden })
const uno = modulo('1', 'Productos', 20)
const dos = modulo('2', 'Primeros pasos', 10)
const oculto = modulo('3', 'Sin contenido visible', 0)
const asignacion = (id, farmasi_submodulos) => ({ id, farmasi_submodulos })
test('la proyección solo contiene grupos con clases autorizadas, sin duplicados y en el orden de Flor', () => {
  assert.deepEqual(groups.agruparClasesFarmasi([asignacion('a', uno), asignacion('falsa', oculto), asignacion('b', dos), asignacion('c', null), asignacion('a', uno)], new Set(['a', 'b', 'c'])), [
    { ...dos, claseIds: ['b'] }, { ...uno, claseIds: ['a'] },
  ])
})
test('la consulta de etiquetas no se hace sin clases activas, autorizadas, exclusivas y con MP4; errores no impiden servir clases', async () => {
  const operaciones = []
  const api = {
    select(x) { operaciones.push(['select', x]); return this },
    eq(...x) { operaciones.push(['eq', ...x]); return this },
    not(...x) { operaciones.push(['not', ...x]); return this },
    in(...x) { operaciones.push(['in', ...x]); return this },
    abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this },
    async returns() { return operaciones.some(o => o[0] === 'fallo') ? { error: {} } : { data: [asignacion('a', uno), asignacion('falsa', oculto)] } },
  }
  const { leerGruposFarmasi } = load('src/lib/farmasi-class-groups-server.ts', { './farmasi-class-groups': groups, '@/lib/supabase/admin': { createAdminClient: () => ({ from(x) { operaciones.push(['from', x]); return api } }) } })
  const visible = { id: 'a', activo: true, solo_farmaci: true, puede_ver: true, tiene_video_privado: true }
  const excluidas = [{...visible, id:'no-rol', puede_ver:false},{...visible,id:'no-video',tiene_video_privado:false},{...visible,id:'ordinaria',solo_farmaci:false},{...visible,id:'despublicada',activo:false}]
  assert.deepEqual(await leerGruposFarmasi(excluidas), [])
  assert.deepEqual(operaciones, [])
  assert.deepEqual(await leerGruposFarmasi([visible,...excluidas]), [{...uno, claseIds:['a']}])
  assert.deepEqual(operaciones, [
    ['from', 'clases'], ['select', 'id,farmasi_submodulos(id,nombre,orden)'], ['eq', 'activo', true],
    ['eq', 'solo_farmaci', true], ['not', 'video_key', 'is', null], ['in', 'id', ['a']],
  ])
  operaciones.push(['fallo'])
  assert.deepEqual(await leerGruposFarmasi([visible]), [])
})
test('el módulo muestra los grupos en orden, aplica el filtro y deja visibles las clases y el apoyo sin módulo', () => {
  const management = load('src/lib/class-management.ts')
  const View = load('src/app/classroom/ClassroomProgram.tsx', {
    '@/lib/class-management': management,
    '@/lib/class-progress': load('src/lib/class-progress.ts'),
    '@/lib/class-library-filters': load('src/lib/class-library-filters.ts', { './class-management': management }),
    '@/components/ClassVideoThumbnail': { default: () => null }
  }).default
  const base = { vimeo_url: null, tiene_video_privado: true, activo: true, puede_ver: true, orden: 0, plan: '27' }
  const clases = [
    { ...base, id:'a', titulo:'Demostración', modulo:'Socias Farmasi' },
    { ...base, id:'b', titulo:'Arranque', modulo:'Socias Farmasi' },
    { ...base, id:'c', titulo:'Clase anterior', modulo:'Socias Farmasi' },
    { ...base, id:'d', titulo:'Extra anterior', modulo:'Socias Farmasi › Material de apoyo' },
  ]
  const props = { programa:'Contenido de Farmasi', clases, progreso:[], buscar:'', esAdmin:false, tieneAcceso:false, cargando:false, abierto:true, onAbrir() {}, gruposFarmasi: [
    {...dos, claseIds:['b']},{...uno, claseIds:['a']},{...oculto, claseIds:['no-publicada']},
  ] }
  const html = renderToStaticMarkup(React.createElement(View, props))
  assert.ok(html.indexOf('Primeros pasos') < html.indexOf('Productos'))
  assert.doesNotMatch(html, /Sin contenido visible/)
  assert.equal((html.match(/Reproducir /g) || []).length, 4)
  assert.match(html, /Reproducir Clase anterior/)
  assert.match(html, /Material de apoyo/)
  const buscado = renderToStaticMarkup(React.createElement(View, { ...props, buscar:'Arranque' }))
  assert.match(buscado, /Primeros pasos/)
  assert.doesNotMatch(buscado, /Productos|Clase anterior|Extra anterior/)
})
