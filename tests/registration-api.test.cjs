/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const realEnv = { ...process.env }
process.env.NEXT_PUBLIC_SITE_URL = 'https://app.sociasdigitales.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-only'
process.env.RESEND_API_KEY = 'unit-test-only'
function endpoint(reservation = { allowed: true, exists: false, confirmed: false }, consentError = null, mailOK = true) {
  let generated, sent, consent
  const exports = {}
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/app/api/registro/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => {
    if (name === 'node:crypto') return require(name)
    if (name === '@/lib/farmasi-registration') return { FLUJO_FARMASI: 'farmasi' }
    if (name === '@/lib/perfil-preguntas') {
      const mockModule = {exports:{}}
      new Function('module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/lib/perfil-preguntas.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mockModule,mockModule.exports)
      return mockModule.exports
    }
    if (name === '@/lib/email-brand') return { EMAIL_HEADER: '<img alt="Socias" />' }
    if (name === 'next/server') return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    if (name === '@/lib/registration-mail') return { enviarConfirmacion: async mail => { sent = mail; return mailOK ? { ok: true, messageId: 'unit-test', attempts: 1 } : { ok: false, status: 503 } } }
    if (name === '@/lib/supabase/admin') return { isAdminSupabaseConfigured: () => true, createAdminClient: () => ({ rpc: async () => ({ data: reservation, error: null }), auth: { admin: { generateLink: async input => { generated = input; return { data: { properties: { hashed_token: 'test-token' }, user: { id: 'test-only', user_metadata: input.options.data || {} } }, error: null } } } }, from: () => ({ insert: async input => { consent = input; return { error: consentError } } }) }) }
    throw new Error(name)
  }, exports)
  return { ...exports, generated: () => generated, sent: () => sent, consent: () => consent }
}
const input = { email: 'Prueba@Example.com ', nombre: 'Prueba', password: 'alex1234', tipo_usuario: 'desafio' }
const req = (body, origin = 'https://app.sociasdigitales.com') => new Request('https://app.sociasdigitales.com/api/registro', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
test('alta Desafío envía confirmación sin conceder rol ni acceso pago', async () => {
  const api = endpoint()
  assert.equal((await api.POST(req({ ...input, rol: 'admin', desafio_habilitado: true }))).status, 200)
  assert.deepEqual(api.generated().options.data, { nombre: 'Prueba', tipo_usuario: 'desafio' })
  assert.deepEqual(api.sent().to, ['prueba@example.com'])
  assert.equal(api.consent().acepta_email, false)
  assert.match(api.sent().html, /confirmar#token_hash=/)
})
test('un error de consentimiento opcional no bloquea el email de acceso', async () => {
  const api = endpoint(undefined, { code: 'unit-test-error' })
  assert.equal((await api.POST(req(input))).status, 200)
  assert.ok(api.sent())
})
test('registro y email guardan el nombre normalizado',async()=>{
  const api=endpoint()
  assert.equal((await api.POST(req({...input,nombre:'  MARÍA   péREZ '}))).status,200)
  assert.equal(api.generated().options.data.nombre,'María Pérez')
  assert.match(api.sent().html,/Hola, María\./)
})
test('reenvío usa enlace de cuenta existente, nunca cambia contraseña o membresía', async () => {
  const api = endpoint({ allowed: true, exists: true, confirmed: false })
  assert.equal((await api.POST(req({ email: input.email, resend: true }))).status, 200)
  assert.equal(api.generated().type, 'magiclink')
  assert.equal(api.generated().password, undefined)
  assert.equal(api.generated().options.data, undefined)
})
test('no revela cuentas confirmadas, rechaza origen ajeno y no anuncia éxito si falla envío', async () => {
  const existing = endpoint({ allowed: true, exists: true, confirmed: true })
  assert.equal((await existing.POST(req(input))).status, 200)
  assert.equal(existing.generated(), undefined)
  assert.equal((await endpoint().POST(req(input, 'https://otro.com'))).status, 403)
  assert.equal((await endpoint(undefined, null, false).POST(req(input))).status, 502)
})
test('Farmasi confirma y vuelve al formulario sin crear permisos ni alterar otra cuenta', async () => {
  const nueva = endpoint()
  assert.equal((await nueva.POST(req({ ...input, flujo: 'farmasi', tipo_usuario: 'gratuito', habilitada: true, rol: 'admin' }))).status, 200)
  assert.deepEqual(nueva.generated().options.data, { nombre: 'Prueba', tipo_usuario: 'gratuito' })
  assert.match(nueva.sent().text, /confirmar#token_hash=test-token&flow=farmasi/)
  const reenvio = endpoint({ allowed: true, exists: true, confirmed: false })
  assert.equal((await reenvio.POST(req({ email: input.email, resend: true, flujo: 'farmasi' }))).status, 200)
  assert.equal(reenvio.generated().type, 'magiclink')
  assert.match(reenvio.sent().text, /&flow=farmasi/)
  const confirmada = endpoint({ allowed: true, exists: true, confirmed: true })
  assert.equal((await confirmada.POST(req({ ...input, flujo: 'farmasi', tipo_usuario: 'gratuito' }))).status, 200)
  assert.equal(confirmada.generated(), undefined)
  assert.equal(confirmada.sent(), undefined)
})
test.after(() => { process.env = realEnv })
