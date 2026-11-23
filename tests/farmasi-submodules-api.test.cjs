/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const load = (file, deps = {}) => {
  const out = {}
  new Function('require', 'exports', ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)(name => Object.hasOwn(deps, name) ? deps[name] : require(name), out)
  return out
}
const management = load('src/lib/class-management.ts')
const modules = load('src/lib/farmasi-submodules.ts', { './class-management': management })
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORIGEN = 'https://example.invalid'
const post = (ruta, body, origen = ORIGEN) => new Request(ORIGEN + ruta, {
  method: 'POST', headers: { Origin: origen, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const response = { NextResponse: Response }

test('gestión: rechaza sesión/origen no autorizados y entradas ajenas al contrato antes de invocar el RPC', async () => {
  let autorizado = false, estado
  const llamadas = []
  const ruta = load('src/app/api/admin/farmasi/submodulos/route.ts', {
    'next/server': response,
    '@/lib/admin-auth': { autorizarAdmin: async req => autorizado && req.headers.get('origin') === new URL(req.url).origin
      ? { user: { id: 'admin-ficticia' } } : { error: new Response(null, { status: 403 }) } },
    '@/lib/farmasi-submodules': modules,
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (...args) => { llamadas.push(args); return estado } }) },
  })
  const pedir = (body, origin) => ruta.POST(post('/api/admin/farmasi/submodulos', body, origin))
  assert.equal((await pedir({ accion: 'crear', nombre: 'Inicio' })).status, 403)
  assert.equal((await pedir({ accion: 'eliminar', id: ID })).status, 403)
  autorizado = true
  assert.equal((await pedir({ accion: 'crear', nombre: 'Inicio' }, 'https://otra.invalid')).status, 403)
  for (const input of [
    { accion: 'crear', nombre: 'x'.repeat(76) },
    { accion: 'crear', nombre: 'Hola\u0000 Mundo' },
    { accion: 'crear', nombre: '  ' },
    { accion: 'crear', nombre: 'Hola', rol: 'admin' },
    { accion: 'mover', id: ID, direccion: 'abajo', orden: 7 },
    { accion: 'mover', id: 'falso', direccion: 'arriba' },
    { accion: 'borrar', id: ID },
    { accion: 'eliminar', id: 'no-es-uuid' },
    { accion: 'eliminar', id: ID, forzar: true },
  ]) assert.equal((await pedir(input)).status, 400)
  assert.equal(llamadas.length, 0)
  estado = { data: [{ id: ID, nombre: 'Módulo uno', orden: 0 }] }
  const creado = await pedir({ accion: 'crear', nombre: '  Módulo    uno  ' })
  assert.equal(creado.status, 200)
  assert.match(creado.headers.get('cache-control'), /no-store/)
  assert.deepEqual(await creado.json(), { submodulos: estado.data })
  assert.deepEqual(llamadas[0], ['gestionar_farmasi_submodulos', {
    p_accion: 'crear', p_id: null, p_direccion: null, p_nombre: 'Módulo uno',
  }])
  assert.equal((await pedir({ accion: 'mover', id: ID.toUpperCase(), direccion: 'abajo' })).status, 200)
  assert.deepEqual(llamadas[1][1], { p_accion: 'mover', p_id: ID, p_direccion: 'abajo', p_nombre: null })
  estado = { data: [] }
  const eliminado = await pedir({ accion: 'eliminar', id: ID.toUpperCase() })
  assert.equal(eliminado.status, 200)
  assert.deepEqual(await eliminado.json(), { submodulos: [] })
  assert.deepEqual(llamadas.at(-1)[1], { p_accion: 'eliminar', p_id: ID, p_direccion: null, p_nombre: null })
  for (const code of ['23503', '23001']) {
    estado = { error: { code } }
    const ocupado = await pedir({ accion: 'eliminar', id: ID })
    assert.equal(ocupado.status, 409)
    assert.match((await ocupado.json()).error, /tiene clases.*Sin submódulo/)
  }
  estado = { error: { code: '23505' } }
  assert.equal((await pedir({ accion: 'crear', nombre: 'Módulo uno' })).status, 409)
  estado = { error: { code: 'P0002' } }
  assert.equal((await pedir({ accion: 'mover', id: ID, direccion: 'arriba' })).status, 404)
  estado = { data: [{ id: 'incorrecto' }] }
  assert.equal((await pedir({ accion: 'mover', id: ID, direccion: 'arriba' })).status, 503)
})

test('guardar clase: el submódulo es opcional, exclusivamente Farmasi, y no cambia audiencia ni publicación', async () => {
  const escrituras = []
  let perfilClase = { video_key: null, solo_farmaci: true }, errorDB = null
  const result = () => ({ select: () => ({ single: async () => ({ data: { id: CLASE }, error: errorDB }) }) })
  const supabase = { from: tabla => {
    assert.equal(tabla, 'clases')
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: perfilClase }) }) }),
      insert: datos => { escrituras.push(datos); return result() },
      update: datos => { escrituras.push(datos); return { eq: () => result() } },
    }
  } }
  const ruta = load('src/app/api/admin/clases/route.ts', {
    'next/server': response, '@/lib/class-management': management,
    '@/lib/admin-auth': { autorizarAdmin: async () => ({ supabase }) },
  })
  const input = { titulo: 'Demo', modulo: 'Demo', orden: 0 }
  const pedir = body => ruta.POST(post('/api/admin/clases', { ...input, ...body }))
  assert.equal((await pedir({ farmasi_submodulo_id: ID })).status, 400)
  assert.equal((await pedir({ farmasi_submodulo_id: 'malo' })).status, 400)
  assert.equal((await pedir({ farmasi_submodulo_id: ID, solo_farmaci: true, activo: true })).status, 400)
  assert.equal((await pedir({ farmasi_submodulo_id: ID, solo_farmaci: true, acceso_gratuito: true })).status, 400)
  assert.equal(escrituras.length, 0)
  assert.equal((await pedir({ farmasi_submodulo_id: ID.toUpperCase(), solo_farmaci: true })).status, 200)
  assert.equal(escrituras.at(-1).farmasi_submodulo_id, ID)
  assert.equal(escrituras.at(-1).activo, false)
  assert.equal((await pedir({ id: CLASE, farmasi_submodulo_id: ID })).status, 200)
  assert.equal(Object.hasOwn(escrituras.at(-1), 'solo_farmaci'), false)
  assert.equal((await pedir({ id: CLASE })).status, 200)
  assert.equal(Object.hasOwn(escrituras.at(-1), 'farmasi_submodulo_id'), false)
  assert.equal((await pedir({ id: CLASE, farmasi_submodulo_id: null })).status, 200)
  assert.equal(escrituras.at(-1).farmasi_submodulo_id, null)
  assert.equal((await pedir({ id: CLASE, solo_farmaci: false })).status, 200)
  assert.equal(escrituras.at(-1).farmasi_submodulo_id, null)
  perfilClase = { ...perfilClase, solo_farmaci: false }
  assert.equal((await pedir({ id: CLASE, farmasi_submodulo_id: ID })).status, 400)
  errorDB = { code: '23503' }
  assert.equal((await pedir({ id: CLASE, farmasi_submodulo_id: ID, solo_farmaci: true })).status, 400)
})
