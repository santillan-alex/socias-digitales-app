/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const directory = load('src/lib/admin-team.ts')
function auth(pages) {
  const calls = []
  return { calls, client: { auth: { admin: { listUsers: async options => { calls.push(options); const result = pages[options.page - 1]; if (result instanceof Error) throw result; return result || { data: { users: [] }, error: null } } } } } }
}
test('directorio devuelve email canónico, confirmación y último ingreso para los IDs pedidos, no Auth completo ni metadata', async () => {
  const f = auth([{ data: { users: [
    { id: 'uno', email: 'Socia@ejemplo.test', email_confirmed_at: '2026-10-01', last_sign_in_at: '2026-11-04T18:30:00Z', user_metadata: { email: 'falso@ejemplo.test', rol: 'admin', last_sign_in_at: '2099-01-01T00:00:00Z' }, app_metadata: { private: 'not-for-client' }, identities: [{ private: true }] },
    { id: 'dos', email: 'otra@ejemplo.test', email_confirmed_at: null, confirmed_at: '2026-10-01', user_metadata: { email_confirmed: true } },
    { id: 'tres', email: null, phone_confirmed_at: '2026-10-01' },
    { id: 'ajena', email: 'no-exportar@ejemplo.test', email_confirmed_at: '2026-10-01' },
  ] }, error: null }])
  const map = await directory.identidadesDeCuentas(f.client, ['uno', 'dos', 'tres'])
  assert.deepEqual([...map], [
    ['uno', { email: 'Socia@ejemplo.test', email_confirmado: true, cuenta_encontrada: true, ultimo_acceso: '2026-11-04T18:30:00Z' }],
    ['dos', { email: 'otra@ejemplo.test', email_confirmado: false, cuenta_encontrada: true, ultimo_acceso: null }],
    ['tres', { email: null, email_confirmado: null, cuenta_encontrada: true, ultimo_acceso: null }],
  ])
  assert.deepEqual(f.calls, [{ page: 1, perPage: 1000 }])
  assert.ok(!JSON.stringify([...map]).includes('private')); assert.ok(!map.has('ajena'))
})
test('paginación alcanza la cuenta exacta sin confundir homónimas ni serializar otras cuentas', async () => {
  const filler = Array.from({ length: 1000 }, (_, i) => ({ id: 'otra-' + i, email: i + '@ejemplo.test' }))
  const f = auth([{ data: { users: filler }, error: null }, { data: { users: [{ id: 'buscada', email: 'exacta@ejemplo.test', email_confirmed_at: null }] }, error: null }])
  const map = await directory.identidadesDeCuentas(f.client, ['buscada', 'buscada'])
  assert.equal(map.size, 1); assert.equal(map.get('buscada').email, 'exacta@ejemplo.test')
  assert.deepEqual(f.calls.map(x => x.page), [1, 2])
})
test('cuenta ausente no se presenta como email pendiente; falla de directorio o límite no producen datos parciales', async () => {
  const missing = await directory.identidadesDeCuentas(auth([]).client, ['ausente'])
  assert.deepEqual(missing.get('ausente'), { email: null, email_confirmado: null, cuenta_encontrada: false, ultimo_acceso: null })
  for (const response of [{ data: { users: [] }, error: new Error('denied') }, new TypeError('network')]) await assert.rejects(() => directory.identidadesDeCuentas(auth([response]).client, ['uno']))
  const full = { data: { users: Array.from({ length: 1000 }, (_, i) => ({ id: 'otra-' + i })) }, error: null }
  const f = auth(Array(20).fill(full))
  await assert.rejects(() => directory.identidadesDeCuentas(f.client, ['sin-encontrar']), /completar el directorio/)
  assert.equal(f.calls.length, 20)
})
test('no consulta directorio vacío y conserva contrato de Equipo', async () => {
  const f = auth([]); assert.equal((await directory.identidadesDeCuentas(f.client, [])).size, 0); assert.equal(f.calls.length, 0)
  const found = auth([{ data: { users: [{ id: 'uno', email: 'equipo@ejemplo.test' }] }, error: null }])
  assert.deepEqual([...await directory.emailsDelEquipo(found.client, ['uno'])], [['uno', 'equipo@ejemplo.test']])
  await assert.rejects(() => directory.emailsDelEquipo(f.client, ['ausente']), /cuentas del equipo/)
})
test('directorio lento termina dentro de su presupuesto y no inicia más páginas tras el timeout', async () => {
  let calls = 0
  const client = { auth: { admin: { listUsers: async () => { calls++; return new Promise(() => {}) } } } }
  await assert.rejects(() => directory.identidadesDeCuentas(client, ['uno'], 15), /tardó demasiado/)
  assert.equal(calls, 1)
  await assert.rejects(() => directory.identidadesDeCuentas(client, ['uno'], 0), /tardó demasiado/)
  assert.equal(calls, 1)
})

function pageFixture({ user = { id: 'actor' }, role = 'admin', configured = true, directoryError = false, profileFailure = false } = {}) {
  const calls = [], writes = []
  const profiles = [
    { id: 'socia', nombre: 'Socia ficticia', tipo_usuario: 'socia', rol: 'alumna', estado: 'activa', created_at: '2026-10-01' },
    { id: 'prueba', rol: 'alumna', estado: 'activa' }, { id: 'admin', rol: 'admin' },
  ]
  const db = { auth: { getUser: async () => ({ data: { user } }) }, from: table => {
    const q = { select: () => q, eq: () => q, not: () => q, order: () => q, or: () => q, gte: () => q,
      single: async () => ({ data: { rol: role }, error: null }),
      then: (resolve, reject) => Promise.resolve({ data: table === 'perfiles' ? profiles : [], error: profileFailure && table === 'perfiles' ? { code: 'failure' } : null }).then(resolve, reject),
    }; return q
  } }
  const Page = load('src/app/admin/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/supabase/admin': { isAdminSupabaseConfigured: () => configured, createAdminClient: () => { calls.push('client'); return {} } },
    '@/lib/admin-team': { identidadesDeCuentas: async (_admin, ids) => { calls.push(ids); if (directoryError) throw new Error('fixture'); return new Map([['socia', { email: 'socia@ejemplo.test', email_confirmado: true, cuenta_encontrada: true }]]) } },
    '@/lib/test-accounts': { FILTRO_CUENTAS_PRUEBA: '(prueba)', esCuentaPrueba: id => id === 'prueba' },
    'next/navigation': { redirect: destination => { throw new Error('redirect:' + destination) } },
    './AdminDashboard': { default: () => null }, './AdminRecovery': { default: () => null },
  }).default
  return { Page, calls, writes }
}
test('solo administra quien tiene rol real: no consulta emails sin sesión, con rol alumna o ante fallo previo', async () => {
  for (const options of [{ user: null }, { role: 'alumna' }]) {
    const f = pageFixture(options); await assert.rejects(() => f.Page(), /redirect:/); assert.equal(f.calls.length, 0)
  }
  const f = pageFixture({ profileFailure: true }); await f.Page(); assert.equal(f.calls.length, 0)
  const source = read('src/app/admin/page.tsx')
  assert.ok(source.indexOf("perfil?.rol !== 'admin'") < source.indexOf('identidadesDeCuentas(createAdminClient()'))
  assert.ok(!source.includes('user_metadata'))
})
test('serializa solo alumnas autorizadas, excluye admin/prueba y no cambia métricas al adjuntar identidad', async () => {
  const f = pageFixture(), element = await f.Page()
  assert.deepEqual(f.calls, ['client', ['socia']])
  assert.equal(element.props.alumnas.length, 1); assert.equal(element.props.alumnas[0].email, 'socia@ejemplo.test')
  assert.equal(element.props.alumnas[0].email_confirmado, true); assert.equal(element.props.errorDirectorio, false)
  assert.equal(element.props.stats.totalAlumnas, 1); assert.equal(element.props.stats.activas, 1)
})
test('si directorio falla conserva listado y cifras, declara desconocido y permite reintentar sin escribir', async () => {
  for (const options of [{ directoryError: true }, { configured: false }]) {
    const f = pageFixture(options), element = await f.Page(), row = element.props.alumnas[0]
    assert.equal(element.props.errorDirectorio, true); assert.equal(element.props.stats.totalAlumnas, 1)
    assert.equal(row.email, null); assert.equal(row.email_confirmado, null); assert.equal(row.cuenta_encontrada, null)
    assert.equal(f.writes.length, 0)
  }
})
