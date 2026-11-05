/* eslint-disable @typescript-eslint/no-require-imports */
// Comprueba la orquestación de página; Auth/RLS reales se verifican en backend y navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const lista = { estado: 'lista', cuentas: [], limitado: false, errorIdentidades: false, errorAfiliadas: false }, sesion = { userId: 'administradora-verificada', supabase: {} }
function pagina(options = {}) {
  const calls = [], UI = () => React.createElement('main', null, 'Directorio'), control = options.control
  const deps = {
    'next/navigation': { redirect: href => { throw { redirect: href } } }, './AlumnasDirectorio': { default: UI },
    '@/lib/admin-student-directory-server': { autorizarDirectorioAlumnas: async () => { calls.push('auth'); if (control) throw control; return options.auth ?? sesion }, leerDirectorioAlumnas: async auth => { calls.push('lectura'); assert.equal(auth, sesion); return options.lista ?? lista } },
  }
  const m = { exports: {} }, source = fs.readFileSync(path.join(__dirname, '..', 'src/app/admin/alumnas/page.tsx'), 'utf8')
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in deps ? deps[n] : require(n), m, m.exports)
  return { Page: m.exports.default, UI, calls }
}
test('directorio exige sesión; alumna o rol no administrativo no consulta ni recibe alumnas', async () => {
  for (const [status, destino] of [[401, '/login?next=%2Fadmin%2Falumnas'], [403, '/inicio']]) {
    const h = pagina({ auth: { error: { status, mensaje: 'Acceso denegado' }, datoPrivado: 'no-serializar' } })
    await assert.rejects(h.Page(), e => e.redirect === destino); assert.deepEqual(h.calls, ['auth'])
  }
})
test('autorización desconocida retorna recuperación y no entrega sesión o listado privado', async () => {
  const h = pagina({ auth: { error: { status: 503, mensaje: 'No pudimos comprobar la administración.' }, supabase: { token: 'no-serializar' } } }), result = await h.Page()
  assert.equal(result.type, h.UI); assert.deepEqual(result.props, { inicial: { estado: 'error', mensaje: 'No pudimos comprobar la administración.' } }); assert.ok(!JSON.stringify(result.props).includes('no-serializar')); assert.deepEqual(h.calls, ['auth'])
})
test('solo tras admin verificada lee directorio y entrega exclusivamente DTO inicial', async () => {
  const h = pagina(), result = await h.Page()
  assert.equal(result.type, h.UI); assert.deepEqual(Object.keys(result.props), ['inicial']); assert.equal(result.props.inicial, lista); assert.deepEqual(h.calls, ['auth', 'lectura'])
})
test('error de lectura no se convierte en lista vacía y señales de Next no se absorben', async () => {
  const fallo = { estado: 'error', mensaje: 'Lectura temporalmente no disponible' }, h = pagina({ lista: fallo }), result = await h.Page()
  assert.equal(result.props.inicial, fallo); assert.equal(result.props.inicial.estado, 'error'); assert.ok(!Object.hasOwn(result.props.inicial, 'cuentas'))
  const control = { digest: 'NEXT_DYNAMIC_CONTROL' }, next = pagina({ control }); await assert.rejects(next.Page(), e => e === control); assert.deepEqual(next.calls, ['auth'])
})
