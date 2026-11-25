/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
function load(file, deps = {}) { const mod = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in deps ? deps[name] : require(name), mod, mod.exports); return mod.exports }
const Recovery = load('src/app/admin/AdminRecovery.tsx').default
function Dashboard() { return null }
function fixture({ user = { id: 'actor' }, role = 'admin', roleError = null, roleThrows = false, failure = null, throws = false, nullData = false, empty = false, farmasiPendiente = false, farmasiError = false } = {}) {
  const calls = []
  const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from: table => {
    let monthly = false
    const q = { select: () => q, eq: () => q, not: () => q, order: () => q, or: () => q, gte: () => { monthly = true; return q },
      single: async () => { if (roleThrows) throw new TypeError('network'); return { data: { rol: role }, error: roleError } },
      then: (resolve, reject) => {
        const key = table === 'pagos' ? monthly ? 'pagosMes' : 'pagosHistoricos' : table
        calls.push(key)
        if (throws && failure === key) return Promise.reject(new TypeError('network')).then(resolve, reject)
        const data = empty ? [] : table === 'perfiles' ? [{ id: 'alumna', rol: 'alumna', nombre: 'Alumna ficticia local', estado: 'activa', tipo_usuario: 'gratuito', socias_farmaci_habilitada: false, created_at: '2026-10-01' }] : table === 'pagos' ? [{ monto: 20 }] : [{ comision: 5 }]
        return Promise.resolve({ data: failure === key && nullData ? null : data, error: failure === key && !nullData ? { code: 'fixture_error' } : null }).then(resolve, reject)
      },
    }; return q
  } }
  const Page = load('src/app/admin/page.tsx', { '@/lib/supabase/server': { createClient: async () => supabase }, '@/lib/supabase/admin': { createAdminClient: () => ({}), isAdminSupabaseConfigured: () => true }, '@/lib/admin-team': { identidadesDeCuentas: async () => new Map() }, '@/lib/admin-student-directory-server': { leerSolicitudesFarmasi: async (_auth, ids) => farmasiError ? null : new Set(farmasiPendiente ? ids : []) }, 'next/navigation': { redirect: location => { throw new Error('redirect:' + location) } }, './AdminDashboard': { default: Dashboard }, './AdminRecovery': { default: Recovery }, '@/lib/test-accounts': { FILTRO_CUENTAS_PRUEBA: '(test)', esCuentaPrueba: () => false } }).default
  return { Page, calls }
}
test('un error de alumnas o cifras nunca aparece como vacío o cero; usa recuperación explícita', async () => {
  for (const failure of ['perfiles', 'pagosMes', 'pagosHistoricos', 'ventas_afiliadas']) {
    for (const options of [{ failure }, { failure, nullData: true }, { failure, throws: true }]) {
      const f = fixture(options), node = await f.Page()
      assert.equal(node.type, Recovery); assert.equal(f.calls.length, 4)
      assert.equal(node.props.alumnas, undefined); assert.equal(node.props.stats, undefined)
    }
  }
})
test('fallo de verificación admin no manda al perfil ni expone datos; sin sesión o rol se redirige', async () => {
  for (const options of [{ roleError: {} }, { roleThrows: true }]) { const f = fixture(options); assert.equal((await f.Page()).type, Recovery); assert.equal(f.calls.length, 0) }
  await assert.rejects(() => fixture({ user: null }).Page(), /redirect:\/login/)
  await assert.rejects(() => fixture({ role: 'alumna' }).Page(), /redirect:\/perfil/)
})
test('lecturas correctas preservan indicadores y un vacío real puede mostrar ceros', async () => {
  const lleno = await fixture().Page(); assert.equal(lleno.type, Dashboard); assert.equal(lleno.props.alumnas.length, 1); assert.equal(lleno.props.stats.mrr, 20); assert.equal(lleno.props.stats.ventasMes, 1)
  const vacio = await fixture({ empty: true }).Page(); assert.equal(vacio.type, Dashboard); assert.deepEqual(vacio.props.alumnas, []); assert.equal(vacio.props.stats.totalAlumnas, 0); assert.equal(vacio.props.stats.ventasMes, 0)
})
test('recuperación móvil mantiene identidad y recarga real sin simular métricas', () => {
  const html = require('react-dom/server').renderToStaticMarkup(Recovery())
  assert.match(html, /role="alert"/); assert.match(html, /href="\/admin"/); assert.match(html, /Reintentar/); assert.match(html, /min-h-11/)
  assert.match(html, /no mostramos un listado vacío/); assert.ok(!html.includes('No hay alumnas'))
})

test('panel raíz vincula solicitudes Farmasi al listado autorizado y no confunde fallo con ausencia', async () => {
  const pendiente = await fixture({ farmasiPendiente: true }).Page()
  assert.equal(pendiente.props.alumnas[0].socias_farmaci_habilitada, false)
  assert.equal(pendiente.props.alumnas[0].socias_farmasi_pendiente, true)
  assert.equal(pendiente.props.stats.solicitudesFarmasiPendientes, 1)
  const desconocido = await fixture({ farmasiError: true }).Page()
  assert.equal(desconocido.props.alumnas[0].socias_farmasi_pendiente, null)
  assert.equal(desconocido.props.stats.solicitudesFarmasiPendientes, null)
})
