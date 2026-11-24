/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === 'server-only') return {}
    const resolved = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    return resolved ? load(resolved + '.ts', mocks) : require(name)
  }, mod, mod.exports)
  return mod.exports
}
const pure = load(path.join(root, 'src/lib/socias-offer.ts'))
test('oferta vacía no inventa precio ni destino; normaliza datos escritos por Flor', () => {
  assert.deepEqual(pure.validarOfertaSocias({ precioTexto: '', accionUrl: '' }), { precioTexto: null, accionUrl: null })
  assert.deepEqual(pure.validarOfertaSocias({ precioTexto: '  Valor de ejemplo para QA  ', accionUrl: ' https://example.com/inscripcion?plan=socias ' }), { precioTexto: 'Valor de ejemplo para QA', accionUrl: 'https://example.com/inscripcion?plan=socias' })
})
test('rechaza protocolos ejecutables, credenciales, campos extra y textos fuera de límite', () => {
  for (const accionUrl of ['javascript:alert(1)', 'data:text/html,pago', '/admin', 'http://example.com', 'https://persona:clave@example.com', 'https://example.com/\n']) assert.throws(() => pure.validarOfertaSocias({ precioTexto: null, accionUrl }))
  for (const input of [null, [], {}, { precioTexto: 'x'.repeat(121), accionUrl: null }, { precioTexto: null, accionUrl: null, habilitar: true }]) assert.throws(() => pure.validarOfertaSocias(input))
})
function almacenamiento() {
  let objeto = null, revision = 0, falla = false, conflicto = false, debil = false
  const requests = []
  async function pedirR2(method, key, query, body, mime, condicion) {
    requests.push({ method, key, body, condicion })
    if (falla) return new Response('', { status: 503 })
    if (method === 'GET' || method === 'HEAD') return objeto === null ? new Response('', { status: 404 }) : new Response(method === 'HEAD' ? null : objeto, { headers: { ETag: (debil && method === 'GET' ? 'W/' : '') + `"v${revision}"` } })
    if (method === 'PUT') {
      if (conflicto || (objeto !== null ? condicion?.['If-Match'] !== `"v${revision}"` : condicion?.['If-None-Match'] !== '*')) return new Response('', { status: 412 })
      objeto = body; revision++
      return new Response(null, { status: 200 })
    }
    throw new Error('Unexpected storage operation')
  }
  const store = load(path.join(root, 'src/lib/socias-offer-store.ts'), { './r2-upload': { pedirR2, r2Configurado: () => true } })
  return { store, requests, fail: () => { falla = true }, conflict: () => { conflicto = true }, weak: () => { debil = true } }
}
test('primer guardado condicional, lectura real y DTO sin identidad administrativa', async () => {
  const a = almacenamiento(), oferta = { precioTexto: 'Importe de prueba', accionUrl: 'https://example.com' }
  assert.deepEqual(await a.store.leerOfertaSocias(), { oferta: { precioTexto: null, accionUrl: null }, revision: null, actualizado: null })
  const saved = await a.store.guardarOfertaSocias(oferta, null, 'administradora-fixture')
  assert.deepEqual(saved.oferta, oferta)
  assert.equal(saved.revision, '"v1"')
  assert.ok(!Object.hasOwn(saved, 'administradora'))
  assert.deepEqual(a.requests.find(r => r.method === 'PUT').condicion, { 'If-None-Match': '*' })
  const siguiente = await a.store.guardarOfertaSocias({ ...oferta, precioTexto: null }, saved.revision, 'administradora-fixture')
  assert.equal(siguiente.revision, '"v2"')
  a.weak()
  assert.equal((await a.store.leerOfertaSocias()).revision, '"v2"')
})
test('rechaza escrituras concurrentes y no sustituye un fallo de lectura por oferta vacía', async () => {
  const a = almacenamiento(), oferta = { precioTexto: null, accionUrl: null }
  await a.store.guardarOfertaSocias(oferta, null, 'fixture')
  await assert.rejects(a.store.guardarOfertaSocias(oferta, null, 'fixture'), a.store.ConflictoOfertaSocias)
  a.conflict()
  await assert.rejects(a.store.guardarOfertaSocias(oferta, '"v1"', 'fixture'), a.store.ConflictoOfertaSocias)
  a.fail()
  await assert.rejects(a.store.leerOfertaSocias())
  for (const revision of ['*', 'W/"v1"', '"v1", "v2"', '\r\nheader', undefined]) assert.throws(() => a.store.revisionOfertaSocias(revision))
})
test('API deniega antes de tocar almacenamiento y valida antes de persistir', async () => {
  let permitido = false, lecturas = 0, escrituras = 0
  const ruta = load(path.join(root, 'src/app/api/admin/configuracion/socias/route.ts'), {
    'next/server': { NextResponse: { json: (body, init = {}) => Response.json(body, init) } },
    '@/lib/admin-auth': { autorizarAdmin: async () => permitido ? { user: { id: 'fixture' } } : { error: Response.json({ error: 'Solo administradores.' }, { status: 403 }) } },
    '@/lib/socias-offer-store': { ConflictoOfertaSocias: class extends Error {}, leerOfertaSocias: async () => { lecturas++; return {} }, revisionOfertaSocias: x => x === null ? null : (() => { throw new Error('revision') })(), guardarOfertaSocias: async () => { escrituras++; return {} } },
  })
  const request = body => new Request('https://example.com/api/admin/configuracion/socias', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
  assert.equal((await ruta.GET()).status, 403)
  assert.equal((await ruta.PUT(request({ oferta: { precioTexto: null, accionUrl: null }, revision: null }))).status, 403)
  assert.equal(lecturas + escrituras, 0)
  permitido = true
  assert.equal((await ruta.PUT(request({ oferta: { precioTexto: null, accionUrl: 'javascript:alert(1)' }, revision: null }))).status, 400)
  assert.equal(escrituras, 0)
  const response = await ruta.GET()
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})
