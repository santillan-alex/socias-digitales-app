/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
function loader(deps = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.join(root, file); if (cache.has(full)) return cache.get(full).exports
    const m = { exports: {} }; cache.set(full, m)
    const req = name => {
      if (Object.hasOwn(deps, name)) return deps[name]
      if (name === 'server-only') return {}
      if (name.startsWith('.') || name.startsWith('@/')) { const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(full), name); return load(path.relative(root, target + '.ts')) }
      return require(name)
    }
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(req, m, m.exports); return m.exports
  }
  return load
}
const d = loader()('src/lib/admin-student-directory.ts'), id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, stamp = '2026-11-05T12:00:00Z'
const cuenta = changes => ({ id: id(1), nombre: 'María Alumna', email: 'maria@example.invalid', email_confirmado: true, cuenta_encontrada: true, whatsapp: '+5493511234567', pais: 'Argentina', estado: 'activa', tipo_usuario: 'socia', desafio_socias_habilitada: false, desafio_socias_estado: 'no_aplica', created_at: stamp, ultimo_acceso: stamp, afiliadas_habilitada: false, ...changes })
const lista = changes => ({ estado: 'lista', cuentas: [], limitado: false, errorIdentidades: false, errorAfiliadas: false, ...changes })
test('DTO del directorio valida campos mínimos y tipos, rechaza registros duplicados y datosAuth crudos', () => {
  const row = cuenta(); assert.equal(d.esCuentaDirectorioAlumna(row), true); assert.equal(d.esDirectorioAlumnas(lista({ cuentas: [row] })), true)
  for (const changes of [{ id: 'no-uuid' }, { email_confirmado: 'true' }, { cuenta_encontrada: 1 }, { afiliadas_habilitada: 'true' }, { estado: 'inventado' }, { tipo_usuario: 'afiliada' }, { ultimo_acceso: 'ayer' }, { created_at: 'ayer' }, { rol: 'admin' }, { user_metadata: { rol: 'admin' } }, { access_token: 'dato-no-publicar' }]) assert.equal(d.esCuentaDirectorioAlumna(cuenta(changes)), false, JSON.stringify(changes))
  assert.equal(d.esDirectorioAlumnas(lista({ cuentas: [row, row] })), false)
  assert.equal(d.esDirectorioAlumnas(lista({ limitado: 'false' })), false)
  assert.equal(d.esCuentaDirectorioAlumna(cuenta({ email: null, email_confirmado: null, cuenta_encontrada: null, afiliadas_habilitada: null, estado: null, tipo_usuario: null, desafio_socias_estado: null, desafio_socias_habilitada: null, ultimo_acceso: null })), true)
})
test('búsqueda y filtros combinan contacto, plan, estado y habilitación independiente sin modificar filas', () => {
  const rows = [cuenta(), cuenta({ id: id(2), nombre: 'Ana', email: 'ana@example.invalid', pais: 'Chile', whatsapp: null, estado: 'pausada', tipo_usuario: 'gratuito', afiliadas_habilitada: true }), cuenta({ id: id(3), nombre: 'Luz', email: null, whatsapp: '3517654321', estado: null, tipo_usuario: null, afiliadas_habilitada: null })]
  const filtro = extra => ({ busqueda: '', tipo: 'todas', estado: 'todas', afiliadas: 'todas', ...extra }), before = JSON.stringify(rows)
  assert.deepEqual(d.filtrarDirectorioAlumnas(rows, filtro({ busqueda: 'MARIA' })).map(r => r.id), [id(1)])
  assert.deepEqual(d.filtrarDirectorioAlumnas(rows, filtro({ busqueda: 'ana@', tipo: 'gratuito', estado: 'pausada', afiliadas: 'habilitadas' })).map(r => r.id), [id(2)])
  assert.deepEqual(d.filtrarDirectorioAlumnas(rows, filtro({ busqueda: 'Chile' })).map(r => r.id), [id(2)])
  assert.deepEqual(d.filtrarDirectorioAlumnas(rows, filtro({ busqueda: '7654321', tipo: 'sin_tipo', estado: 'sin_estado', afiliadas: 'sin_comprobar' })).map(r => r.id), [id(3)])
  assert.deepEqual(d.filtrarDirectorioAlumnas(rows, filtro({ afiliadas: 'sin_acceso' })).map(r => r.id), [id(1)])
  assert.equal(JSON.stringify(rows), before)
})
test('resumen separa estados desconocidos y grants; fallo o límite impide presentar totales completos', () => {
  const rows = [cuenta({ afiliadas_habilitada: true }), cuenta({ id: id(2), tipo_usuario: 'gratuito', estado: 'pausada', afiliadas_habilitada: true }), cuenta({ id: id(3), tipo_usuario: 'desafio', estado: 'cancelada' }), cuenta({ id: id(4), tipo_usuario: null, estado: null })]
  assert.deepEqual(d.resumirDirectorioAlumnas(lista({ cuentas: rows })), { total: 4, socias: 1, desafio: 1, gratuitas: 1, sin_tipo: 1, activas: 1, pausadas: 1, canceladas: 1, sin_estado: 1, afiliadas: 2, afiliadas_activas: 1, afiliadas_sin_confirmar: 0 })
  assert.equal(d.resumirDirectorioAlumnas({ estado: 'error', mensaje: 'No disponible' }), null)
  assert.equal(d.resumirDirectorioAlumnas(lista({ cuentas: rows, limitado: true })), null)
  const uncertain = d.resumirDirectorioAlumnas(lista({ cuentas: rows.map(r => ({ ...r, afiliadas_habilitada: null })), errorAfiliadas: true }))
  assert.equal(uncertain.total, 4); assert.equal(uncertain.afiliadas, null); assert.equal(uncertain.afiliadas_activas, null); assert.equal(uncertain.afiliadas_sin_confirmar, 4)
})
