/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file) {
  const full = path.resolve(__dirname, '..', file), m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), n + '.ts'))) : require(n), m, m.exports)
  return m.exports
}
const d = load('src/lib/admin-learning-progress.ts'), id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clase = { id: id(1), titulo: 'Tu primera clase', modulo: 'Desafío Socias', orden: 0, acceso_gratuito: false }
const alumna = { id: id(2), nombre: 'Ana', tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false }
const progreso = { alumna_id: id(2), clase_id: id(1), posicion_seg: 12, duracion_seg: 50, completada: false, actualizado_en: '2026-11-05T12:00:00Z' }
const lista = changes => ({ estado: 'lista', clases: [clase], alumnas: [alumna], progreso: [progreso], ...changes })
test('DTO admite estado real, vacío confirmado y marca manual sin minuto; nullable no se inventa', () => {
  assert.equal(d.esSeguimientoFormacion(lista()), true)
  assert.equal(d.esSeguimientoFormacion(lista({ clases: [], alumnas: [], progreso: [] })), true)
  assert.equal(d.esSeguimientoFormacion(lista({ alumnas: [{ ...alumna, nombre: null, tipo_usuario: null, estado: null, desafio_socias_habilitada: null }], progreso: [{ ...progreso, posicion_seg: 0, duracion_seg: 0, completada: true }] })), true)
  assert.equal(d.esSeguimientoFormacion({ estado: 'error', mensaje: 'No pudimos leer los avances.' }), true)
})
test('contrato exacto rechaza claves privadas, identidades repetidas y relaciones ajenas', () => {
  for (const changes of [{ video_key: 'privado' }, { clases: [{ ...clase, video_key: 'privado' }] }, { alumnas: [{ ...alumna, email: 'no-serializar@example.invalid' }] }, { progreso: [{ ...progreso, video_revision: 'privada' }] }, { clases: [clase, clase] }, { alumnas: [alumna, alumna] }, { progreso: [progreso, progreso] }, { progreso: [{ ...progreso, clase_id: id(3) }] }, { progreso: [{ ...progreso, alumna_id: id(3) }] }]) assert.equal(d.esSeguimientoFormacion(lista(changes)), false)
  assert.equal(d.esSeguimientoFormacion(lista({ alumnas: [{ ...alumna, id: '06bb7999-997b-49c8-ba80-b8d05bca4a84' }], progreso: [] })), false)
})
test('valida tipos sin coerción, límites, fechas y rango de minuto antes de mostrar resultados', () => {
  for (const patch of [{ tipo_usuario: ['socia'] }, { estado: ['activa'] }, { desafio_socias_habilitada: 1 }, { nombre: '\u0000Ana' }, { nombre: '' }, { id: 'invalido' }]) assert.equal(d.esAlumnaSeguimiento({ ...alumna, ...patch }), false)
  for (const patch of [{ posicion_seg: -1 }, { posicion_seg: 51 }, { posicion_seg: 1.5 }, { duracion_seg: 172801 }, { completada: 1 }, { actualizado_en: '2026-02-30T12:00:00Z' }, { actualizado_en: 'hoy' }]) assert.equal(d.esProgresoSeguimiento({ ...progreso, ...patch }), false)
  for (const patch of [{ titulo: ' ' }, { titulo: 'x'.repeat(181) }, { modulo: 'x'.repeat(101) }, { orden: 10000 }, { acceso_gratuito: 'true' }]) assert.equal(d.esClaseSeguimiento({ ...clase, ...patch }), false)
  for (const [field, row, limit] of [['clases', clase, d.LIMITE_CLASES_FORMACION], ['alumnas', alumna, d.LIMITE_ALUMNAS_FORMACION], ['progreso', progreso, d.LIMITE_PROGRESO_FORMACION]]) assert.equal(d.esSeguimientoFormacion(lista({ [field]: Array(limit + 1).fill(row) })), false)
  assert.equal(d.esSeguimientoFormacion({ estado: 'error', mensaje: '', clases: [] }), false)
})
