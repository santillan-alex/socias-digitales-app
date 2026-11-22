/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')
const src = path => readFileSync(join(__dirname, '..', path), 'utf8')
function load(path, mocks = {}) {
  const mod = { exports: {} }
  const { outputText } = ts.transpileModule(src(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  new Function('require', 'exports', outputText)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports)
  return mod.exports
}
const farmasi = load('src/lib/farmasi-registration.ts')

test('confirmación Farmasi vuelve a una ruta fija y conserva recuperación e invitaciones existentes', () => {
  assert.equal(farmasi.destinoConfirmacion('farmasi'), '/registro/farmasi')
  assert.equal(farmasi.destinoConfirmacion('recovery'), '/crear-contrasena')
  assert.equal(farmasi.destinoConfirmacion('invite'), '/crear-contrasena')
  for (const otro of [null, '//example.invalid', 'javascript:alert(1)', '/admin', 'farmasi/'])
    assert.equal(farmasi.destinoConfirmacion(otro), '/')
  assert.equal(new URL(farmasi.DESTINO_INGRESO_FARMASI, 'https://example.invalid').searchParams.get('next'), '/registro/farmasi')
})

test('POST solicita con identidad propia confirmada y no permite parámetros que elijan otra cuenta', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const confirmada = { id, email_confirmed_at: '2026-11-22T22:00:00Z' }
  let usuario = confirmada, resultado = { data: 'pendiente' }
  const capturas = []
  const ruta = load('src/app/api/farmasi/solicitud/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: usuario } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (...arg) => { capturas.push(arg); return resultado } }) },
  })
  const url = 'https://example.invalid/api/farmasi/solicitud'
  const pedir = ({ origin = 'https://example.invalid', body, query = '' } = {}) =>
    ruta.POST(new Request(url + query, { method: 'POST', headers: { origin }, body }))
  assert.equal((await pedir({ origin: 'https://otro.example.invalid' })).status, 403)
  assert.equal((await pedir({ query: '?id=otra' })).status, 400)
  usuario = null
  assert.equal((await pedir()).status, 401)
  usuario = { ...confirmada, is_anonymous: true }
  assert.equal((await pedir()).status, 401)
  usuario = { id }
  assert.equal((await pedir()).status, 403)
  assert.equal(capturas.length, 0)
  usuario = confirmada
  const pendiente = await pedir({ body: '{"p_usuaria_id":"otra","habilitada":true}' })
  assert.match(pendiente.headers.get('cache-control'), /no-store/)
  assert.deepEqual(await pendiente.json(), { estado: 'pendiente' })
  assert.deepEqual(capturas, [['solicitar_socias_farmasi', { p_usuaria_id: id }]])
  resultado = { data: 'habilitada' }
  assert.deepEqual(await (await pedir()).json(), { estado: 'habilitada' })
  resultado = { data: 'no_elegible' }
  assert.equal((await pedir()).status, 409)
  resultado = { error: { message: 'privado' } }
  const error = await pedir()
  assert.equal(error.status, 503)
  assert.doesNotMatch(await error.text(), /privado/)
})

test('conserva la bienvenida obligatoria y permite volver solamente a un aula fija', () => {
  assert.equal(farmasi.destinoTrasBienvenida('farmasi'), '/classroom?espacio=farmasi')
  for (const otro of [undefined, ['farmasi'], '/admin', 'https://otro.example.invalid'])
    assert.equal(farmasi.destinoTrasBienvenida(otro), '/inicio')
  const proxy = src('src/proxy.ts')
  assert.match(proxy, /necesitaBienvenida\(bienvenida,perfil\?\.rol\)/)
  assert.match(proxy, /aulaFarmasi \? RUTA_BIENVENIDA_FARMASI : '\/bienvenida'/)
})

test('continuación Farmasi usa el POST existente, abre aula solo para aprobadas y reintenta en la pantalla especializada', async t => {
  const helper = load('src/lib/farmasi-request-client.ts', { './farmasi-registration': farmasi })
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ estado: 'pendiente' }))
  assert.equal(await helper.continuarAutenticacionFarmasi(), '/registro/farmasi')
  const [path, options] = fetch.mock.calls[0].arguments
  assert.equal(path, '/api/farmasi/solicitud')
  assert.equal(options.method, 'POST')
  assert.equal(options.credentials, 'same-origin')
  assert.equal(options.body, undefined)
  assert.ok(options.signal instanceof AbortSignal)
  fetch.mock.mockImplementation(async () => Response.json({ estado: 'habilitada' }))
  assert.equal(await helper.continuarAutenticacionFarmasi(), '/classroom?espacio=farmasi')
  fetch.mock.mockImplementation(async () => Response.json({ error: 'Iniciá sesión' }, { status: 401 }))
  assert.equal(await helper.continuarAutenticacionFarmasi(), '/registro/farmasi')
  fetch.mock.mockImplementation(async () => { throw new Error('red interrumpida') })
  assert.equal(await helper.continuarAutenticacionFarmasi(), '/registro/farmasi')
  assert.match(src('src/lib/farmasi-request-client.ts'), /setTimeout\(\(\) => controller\.abort\(\), 6000\)/)
})

test('confirmación y login genérico no registran solicitudes; GET de inscripción solo lee', () => {
  const confirm = src('src/app/confirmar/page.tsx')
  const login = src('src/app/login/page.tsx')
  const page = src('src/app/registro/farmasi/page.tsx')
  assert.match(confirm, /flujo === FLUJO_FARMASI \? await continuarAutenticacionFarmasi\(\) : destinoConfirmacion\(flujo\)/)
  assert.ok(confirm.indexOf('if (error)') < confirm.indexOf('await continuarAutenticacionFarmasi()'))
  assert.match(login, /if \(esFarmasi\) \{\s*window\.location\.replace\(await continuarAutenticacionFarmasi\(\)\)/)
  assert.ok(login.indexOf('signInWithPassword') < login.indexOf('if (esFarmasi)'))
  assert.doesNotMatch(page, /registrarSolicitudFarmasi|INSERT|\'POST\'/)
  assert.match(page, /if \(perfil\.socias_farmaci_habilitada\) redirect\(RUTA_AULA_FARMASI\)/)
})
