/* eslint-disable @typescript-eslint/no-require-imports */
// Datos locales ficticios, sin base, sesiones ni archivos reales.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, deps = {}) {
  const mod = { exports: {} }
  const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  new Function('require', 'module', 'exports', ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => Object.hasOwn(deps, name) ? deps[name] : require(name), mod, mod.exports)
  return mod.exports
}
const access = load('src/lib/class-access.ts')
const management = load('src/lib/class-management.ts')
const miembro = { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa' }
const farmaci = { ...miembro, socias_farmaci_habilitada: true }
const socia = { ...miembro, tipo_usuario: 'socia' }
const normal = { id: 'normal', titulo: 'General', descripcion: null, activo: true, vimeo_url: null, video_key: 'fake.mp4', acceso_gratuito: false, orden: 0, modulo: 'General', plan: '27', solo_farmaci: false }
const exclusiva = { ...normal, id: 'farmaci', titulo: 'Contenido de prueba exclusivo', modulo: 'Socias Farmaci', solo_farmaci: true }
const muestra = { ...normal, id: 'muestra', acceso_gratuito: true }
const cuenta = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const actor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const next = { NextResponse: class extends Response {} }

test('permiso adicional, sin desbloquear el plan pago ni ceder a gratuidad o suspensión', () => {
  for (const persona of [miembro, socia, null, { ...farmaci, estado: 'pausada' }, { ...farmaci, estado: 'cancelada' }]) {
    assert.equal(access.puedeVerClase(persona, exclusiva), false)
    assert.equal(access.incluirClaseEnCatalogo(persona, exclusiva), false)
  }
  assert.equal(access.puedeVerClase(farmaci, exclusiva), true)
  assert.equal(access.puedeVerClase(farmaci, normal), false)
  assert.equal(access.puedeVerClase(farmaci, muestra), true)
  assert.equal(access.puedeVerClase(socia, normal), true)
  assert.equal(access.puedeVerClase(farmaci, { ...exclusiva, activo: false }), false)
  assert.equal(access.puedeVerClase(miembro, { ...exclusiva, acceso_gratuito: true }), false)
  assert.equal(access.puedeVerClase({ rol: 'admin' }, { ...exclusiva, activo: false }), true)
})

test('catálogo común no lee Farmaci con credenciales privilegiadas ni serializa metadatos al revocar', async () => {
  function tabla(nombre, filas, calls) {
    return { from: () => {
      let list = filas
      const query = { select: () => query, eq: (k, v) => { list = list.filter(x => x[k] === v); calls.push([nombre, k, v]); return query },
        order: async () => ({ data: list, error: null }) }
      return query
    } }
  }
  const calls = []
  let sesiones = [exclusiva]
  const catalogo = load('src/lib/class-catalog.ts', {
    'server-only': {}, '@/lib/supabase/admin': { createAdminClient: () => tabla('admin', [normal, muestra, exclusiva], calls) },
    '@/lib/supabase/server': { createClient: async () => tabla('sesion', sesiones, calls) }, '@/lib/class-access': access,
    '@/lib/class-poster': { revisionMiniatura: () => 'revision-no-secreta' },
  })
  const sin = await catalogo.leerCatalogoClases(socia)
  assert.deepEqual(sin.map(x => x.id), ['normal', 'muestra'])
  assert.equal(calls.some(([nombre]) => nombre === 'sesion'), false)
  assert.ok(calls.some(args => args[0] === 'admin' && args[1] === 'solo_farmaci' && args[2] === false))
  const con = await catalogo.leerCatalogoClases(farmaci)
  assert.deepEqual(con.map(x => [x.id, x.puede_ver]), [['normal', false], ['muestra', true], ['farmaci', true]])
  assert.ok(calls.some(args => args[0] === 'sesion' && args[1] === 'solo_farmaci' && args[2] === true))
  assert.ok(!JSON.stringify(con).includes('fake.mp4'))
  sesiones = []
  assert.deepEqual((await catalogo.leerCatalogoClases(farmaci)).map(x => x.id), ['normal', 'muestra'])
})

test('class editor permits an exclusive draft but never a public sample or external Vimeo', () => {
  const ficha = { titulo: 'QA', modulo: 'QA', orden: 0, solo_farmaci: true }
  assert.equal(management.datosClase(ficha).solo_farmaci, true)
  for (const inválida of [{ acceso_gratuito: true }, { vimeo_url: 'https://vimeo.com/123' }, { solo_farmaci: 'true' }])
    assert.equal(management.datosClase({ ...ficha, ...inválida }), null)
  assert.equal(management.puedePublicarClase({ ...ficha, tieneVideo: false, vimeo_url: 'https://vimeo.com/123' }), false)
  assert.equal(management.puedePublicarClase({ ...ficha, tieneVideo: true, vimeo_url: null }), true)
})

test('admin route grants and revokes only this permission and is idempotent', async () => {
  const changes = []
  let profile = { id: cuenta, rol: 'alumna', estado: 'activa', socias_farmaci_habilitada: false }
  let allow = true
  const db = { from: name => {
    assert.equal(name, 'perfiles')
    let patch
    const query = { select: () => query, eq: () => query, or: () => query, update: changeset => { patch = changeset; return query },
      maybeSingle: async () => {
        if (patch) { changes.push(patch); profile = { ...profile, ...patch } }
        return { data: profile, error: null }
      },
    }
    return query
  } }
  const route = load('src/app/api/admin/farmaci/acceso/route.ts', {
    'next/server': next, '@/lib/admin-auth': { autorizarAdmin: async () => allow ? { user: { id: actor } } : { error: new Response(null, { status: 403 }) } },
    '@/lib/class-management': management, '@/lib/supabase/admin': { createAdminClient: () => db },
  })
  const post = habilitada => route.POST(new Request('https://example.invalid/api/admin/farmaci/acceso', {
    method: 'POST', headers: { origin: 'https://example.invalid' }, body: JSON.stringify({ perfilId: cuenta.toUpperCase(), habilitada }),
  }))
  allow = false
  assert.equal((await post(true)).status, 403)
  allow = true
  profile = { ...profile, estado: 'pausada' }
  assert.equal((await post(true)).status, 409)
  profile = { ...profile, estado: 'activa' }
  assert.deepEqual(await (await post(true)).json(), { habilitada: true, elegible: true })
  assert.equal((await post(true)).status, 200)
  profile = { ...profile, estado: 'pausada' }
  assert.deepEqual(await (await post(false)).json(), { habilitada: false, elegible: false })
  assert.equal(changes.length, 2)
  for (const change of changes) {
    assert.deepEqual(Object.keys(change).sort(), ['socias_farmaci_habilitada', 'socias_farmaci_habilitada_at', 'socias_farmaci_habilitada_por'])
    assert.equal(change.socias_farmaci_habilitada_por, actor)
  }
})

test('direct video, thumbnail, material and progress readers all consult the entitlement before private access', async () => {
  const query = new Map()
  let perfil = socia
  const context = { params: Promise.resolve({ id: cuenta }) }
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
    from: table => ({
      select: campos => {
        query.set(table, campos)
        return { eq: () => ({ maybeSingle: async () => ({ data: table === 'perfiles' ? perfil : exclusiva }) }) }
      },
    }),
  }
  const supabase = { createClient: async () => db }
  const common = { 'next/server': next, '@/lib/supabase/server': supabase, '@/lib/class-access': access, '@/lib/class-management': management }
  const video = load('src/app/api/classroom/[id]/video/route.ts', common)
  const poster = load('src/lib/class-poster.ts', { 'server-only': {} })
  const thumbnail = load('src/app/api/classroom/[id]/miniatura/route.ts', {
    ...common, '@/lib/class-poster': poster, '@/lib/r2-upload': { pedirR2: () => { throw new Error('No solicitar objetos privados') } },
  })
  const materials = load('src/lib/class-materials-access.ts', {
    'server-only': {}, 'next/server': next, './supabase/server': supabase, './class-access': access, './class-management': management,
  })
  let progressReads = 0
  const progress = load('src/app/api/classroom/[id]/progreso/route.ts', {
    ...common, '@/lib/supabase/admin': {}, '@/lib/class-progress': {},
    '@/lib/class-progress-server': { leerProgresoClases: async () => { progressReads++; return [] } },
  })
  const request = new Request('https://example.invalid/')
  for (const persona of [socia, miembro, { ...farmaci, estado: 'pausada' }]) {
    perfil = persona
    assert.equal((await video.GET(request, context)).status, 403)
    assert.equal((await thumbnail.GET(request, context)).status, 403)
    assert.equal((await materials.autorizarMateriales(cuenta)).error.status, 403)
    assert.equal((await progress.GET(request, context)).status, 403)
  }
  assert.equal(progressReads, 0)
  assert.match(query.get('perfiles'), /socias_farmaci_habilitada/)
  assert.match(query.get('clases'), /solo_farmaci/)
  perfil = farmaci
  assert.deepEqual(await materials.autorizarMateriales(cuenta), { admin: false })
  assert.equal((await progress.GET(request, context)).status, 200)
  assert.equal(progressReads, 1)
})
