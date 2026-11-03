/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports); return m.exports }
const d = load('src/lib/affiliate-hub.ts'), c = load('src/lib/affiliate-campaigns.ts', { './affiliate-hub': d })
const base = { titulo: 'Recurso de prueba aislado', cuerpo: 'Texto completo.', tipo: 'copy', campana: null, url: null, estado: 'publicado', destacado: false, version: 1, creado_en: '2026-11-03T00:00:00Z', actualizado_en: '2026-11-03T00:00:00Z' }
const row = (n, extra = {}) => ({ ...base, id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...extra })
test('campañas equivalentes por espacios, casing o NFC usan una clave sin alterar datos legacy', () => {
  const nombres = [' Desafío  Noviembre ', 'desafío\tNOVIEMBRE', 'DESAFI\u0301O noviembre', 'desafío\u00a0noviembre']
  assert.equal(new Set(nombres.map(c.claveCampanaAfiliada)).size, 1)
  assert.equal(c.nombreCampanaAfiliada(nombres[0]), 'Desafío Noviembre')
  assert.equal(c.claveCampanaAfiliada(null), 'sin-campana'); assert.equal(c.claveCampanaAfiliada('  '), 'sin-campana')
  assert.notEqual(c.claveCampanaAfiliada('Todas'), 'todas'); assert.notEqual(c.claveCampanaAfiliada('sin-campana'), c.claveCampanaAfiliada(null))
  const recursos = nombres.map((campana, i) => row(i, { campana })), before = structuredClone(recursos), opciones = c.opcionesCampanasAfiliadas(recursos)
  assert.equal(opciones.length, 1); assert.equal(opciones[0].cantidad, 4); assert.equal(opciones[0].nombre, 'Desafío Noviembre'); assert.deepEqual(recursos, before)
})
test('agrupación conserva tipos y cantidades reales, sin campaña explícita y destacados al principio', () => {
  const recursos = [row(1, { campana: 'Campaña B', tipo: 'video' }), row(2, { campana: 'campaña b', tipo: 'copy', destacado: true }), row(3), row(4, { campana: 'Campaña A', tipo: 'archivo' })], before = structuredClone(recursos)
  const grupos = c.agruparCampanasAfiliadas(recursos)
  assert.deepEqual(grupos.map(g => g.nombre), ['Campaña B', 'Campaña A', 'Sin campaña']); assert.deepEqual(grupos[0].recursos.map(r => r.id), [recursos[1].id, recursos[0].id])
  assert.deepEqual(grupos[0].tipos.map(t => [t.tipo, t.cantidad]), [['copy', 1], ['video', 1]])
  assert.equal(grupos.reduce((n, g) => n + g.cantidad, 0), recursos.length); assert.deepEqual(recursos, before)
  for (const g of grupos) assert.equal(g.tipos.reduce((n, t) => n + t.cantidad, 0), g.cantidad)
})
test('avisos destacados se separan sin duplicarse; copies destacados permanecen en su campaña', () => {
  const recursos = [row(1, { tipo: 'aviso', destacado: true }), row(2, { destacado: true }), row(3, { tipo: 'aviso' }), row(4, { tipo: 'video' })]
  const separados = c.separarAvisosDestacadosAfiliadas(recursos)
  assert.deepEqual(separados.avisos.map(r => r.id), [recursos[0].id]); assert.equal(separados.recursos.length, 3); assert.equal(separados.recursos[0].id, recursos[1].id)
  const ids = [...separados.avisos, ...separados.recursos].map(r => r.id); assert.equal(new Set(ids).size, recursos.length); assert.ok(separados.recursos.every(r => !separados.avisos.includes(r)))
  assert.deepEqual(c.agruparCampanasAfiliadas([]), []); assert.deepEqual(c.opcionesCampanasAfiliadas([]), []); assert.deepEqual(c.separarAvisosDestacadosAfiliadas([]), { avisos: [], recursos: [] })
})
