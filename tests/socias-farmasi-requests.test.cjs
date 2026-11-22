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
