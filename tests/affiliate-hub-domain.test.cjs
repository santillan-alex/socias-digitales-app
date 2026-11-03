/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, m, m.exports); return m.exports }
const d = load('src/lib/affiliate-hub.ts'), id = '00000000-0000-4000-8000-000000000001'
const datos = { titulo: 'Un mensaje para salir a vender', cuerpo: 'Hoy podés empezar con un paso.', tipo: 'copy', campana: 'Mujer Digital', url: null, estado: 'borrador', destacado: false }
const fila = { id, ...datos, version: 1, creado_en: '2026-11-02T12:00:00.000Z', actualizado_en: '2026-11-02T12:00:00.000Z' }
test('recurso valida campos exactos, normalización y versión externa al DTO', () => {
  const result = d.validarEntradaAfiliada({ id, recurso: { ...datos, titulo: '  Un título  ', cuerpo: 'Texto\r\nPlano', campana: '', url: '' } })
  assert.equal(result.id, id); assert.deepEqual(result.datos, { ...datos, titulo: 'Un título', cuerpo: 'Texto\nPlano', campana: null })
  assert.equal(d.validarEntradaAfiliada({ id, version: 5, recurso: datos }, true).version, 5)
  for (const extra of [{ rol: 'admin' }, { autora_id: id }, { version: 1 }, { creado_en: fila.creado_en }]) assert.throws(() => d.validarEntradaAfiliada({ id, recurso: { ...datos, ...extra } }))
  assert.throws(() => d.validarEntradaAfiliada({ id, version: 1, recurso: datos }))
  assert.equal(d.validarEntradaAfiliada({ id, version: 999_999_999, recurso: datos }, true).version, 999_999_999)
  for (const version of [0, -1, 1.2, '1', null, 1_000_000_000, 2147483647]) assert.throws(() => d.validarEntradaAfiliada({ id, version, recurso: datos }, true))
})
test('avisos y copies requieren cuerpo, videos/archivos/enlaces requieren destino HTTPS', () => {
  for (const tipo of ['aviso', 'copy']) assert.throws(() => d.validarDatosRecursoAfiliada({ ...datos, tipo, cuerpo: '  ' }))
  for (const tipo of ['video', 'archivo', 'enlace']) {
    assert.throws(() => d.validarDatosRecursoAfiliada({ ...datos, tipo }))
    const result = d.validarDatosRecursoAfiliada({ ...datos, tipo, cuerpo: '', url: 'https://example.invalid/recurso' })
    assert.equal(result.tipo, tipo); assert.equal(result.cuerpo, '')
  }
  for (const url of ['http://example.invalid', 'javascript:alert(1)', 'data:text/html,no', 'https://usuario:clave@example.invalid', 'https://localhost', 'https://example.invalid/con espacio', 'https://example.invalid/a\nb']) assert.throws(() => d.enlaceAfiliadas(url))
  assert.equal(d.enlaceAfiliadas('https://example.invalid/?a=1&b=2'), 'https://example.invalid/?a=1&b=2')
  assert.equal(d.enlaceAfiliadas('HTTPS://Example.Invalid/Material%2FPDF?Token=AaB#CLASE'), 'https://Example.Invalid/Material%2FPDF?Token=AaB#CLASE')
  assert.equal(d.validarDatosRecursoAfiliada({ ...datos, url: 'HtTpS://Example.Invalid/AaB' }).url, 'https://Example.Invalid/AaB')
})
test('límites, tipos, estados, control y UUID se validan sin confiar en coerciones', () => {
  for (const bad of [{ titulo: '' }, { titulo: 'a'.repeat(141) }, { cuerpo: 'a'.repeat(12001) }, { campana: 'a'.repeat(121) }, { url: 'https://example.invalid/' + 'a'.repeat(2000) }, { cuerpo: 'no\u0000' }, { titulo: 'a\nb' }, { tipo: 'otro' }, { estado: 'eliminado' }, { destacado: 'true' }]) assert.throws(() => d.validarDatosRecursoAfiliada({ ...datos, ...bad }))
  for (const bad of [null, [], 'x', {}, { id: 'malo', recurso: datos }, { id, recurso: datos, usuaria_id: id }]) assert.throws(() => d.validarEntradaAfiliada(bad))
  assert.equal(d.esIdAfiliadas(id), true); assert.equal(d.esIdAfiliadas('x'.repeat(36)), false)
})
test('DTO y respuesta no convierten datos incoherentes, borradores o duplicados en lista pública', () => {
  assert.equal(d.esRecursoAfiliada(fila), true)
  assert.equal(d.esRecursoAfiliada({ ...fila, version: 1_000_000_000 }), true)
  for (const bad of [{ version: 0 }, { version: 1_000_000_001 }, { version: '1' }, { actualizado_en: 'ayer' }, { id: 'otro' }, { estado: 'faltante' }, { titulo: ' Título no canónico ' }]) assert.equal(d.esRecursoAfiliada({ ...fila, ...bad }), false)
  assert.equal(d.esCatalogoAfiliadas({ estado: 'lista', recursos: [fila], limitado: false }), false)
  assert.equal(d.esCatalogoAfiliadas({ estado: 'lista', recursos: [fila], limitado: false }, true), true)
  const published = { ...fila, estado: 'publicado' }
  assert.equal(d.esCatalogoAfiliadas({ estado: 'lista', recursos: [published], limitado: false }), true)
  assert.equal(d.esCatalogoAfiliadas({ estado: 'lista', recursos: [published, published], limitado: false }), false)
  assert.equal(d.esCatalogoAfiliadas({ estado: 'lista', recursos: [], limitado: 'false' }), false)
})
test('búsqueda sin acentos combina tipo, campaña y estado; destacados primero sin alterar entrada', () => {
  const recursos = [{ ...fila, estado: 'publicado' }, { ...fila, id: '00000000-0000-4000-8000-000000000002', titulo: 'Vídeo del desafío', tipo: 'video', url: 'https://example.invalid/video', campana: 'Desafío', estado: 'publicado', destacado: true }, { ...fila, id: '00000000-0000-4000-8000-000000000003', campana: null, estado: 'archivado' }]
  const snapshot = structuredClone(recursos)
  assert.equal(d.filtrarRecursosAfiliadas(recursos, { busqueda: '', tipo: 'todos', campana: 'todas' })[0].tipo, 'video')
  assert.equal(d.filtrarRecursosAfiliadas(recursos, { busqueda: 'video desafio', tipo: 'video', campana: 'Desafío', estado: 'publicado' }).length, 1)
  assert.equal(d.filtrarRecursosAfiliadas(recursos, { busqueda: 'video', tipo: 'copy', campana: 'todas' }).length, 0)
  assert.deepEqual(d.campanasAfiliadas(recursos), ['Desafío', 'Mujer Digital']); assert.deepEqual(recursos, snapshot)
  assert.equal(d.recursoCoincideAfiliada(fila, datos), true); assert.equal(d.recursoCoincideAfiliada(fila, { ...datos, destacado: true }), false)
})
