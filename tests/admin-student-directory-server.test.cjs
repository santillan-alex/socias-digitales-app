/* eslint-disable @typescript-eslint/no-require-imports */
// Contratos de lectura con Supabase/Auth aislados. No consulta datos reales ni prueba RLS remota.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..'), uid = '00000000-0000-4000-8000-999999999999', pruebaId = '06bb7999-997b-49c8-ba80-b8d05bca4a84', id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, stamp = '2026-11-05T12:00:00Z'
function loader(deps = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.join(root, file); if (cache.has(full)) return cache.get(full).exports
    const m = { exports: {} }; cache.set(full, m)
    const req = name => {
      if (Object.hasOwn(deps, name)) return deps[name]
      if (name === 'server-only') return {}
      if (name === 'next/navigation') return { unstable_rethrow: error => { if (error?.digest === 'NEXT_CONTROL') throw error } }
      if (name.startsWith('.') || name.startsWith('@/')) { const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(full), name); return load(path.relative(root, target + '.ts')) }
      return require(name)
    }
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(req, m, m.exports); return m.exports
  }
  return load
}
const perfil = (n, changes = {}) => ({ id: id(n), nombre: `Alumna ${n}`, rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', whatsapp: null, pais: 'Argentina', desafio_socias_habilitada: false, desafio_socias_estado: 'no_aplica', created_at: stamp, ...changes })
function fixture(options = {}) {
  const calls = [], events = [], identities = [], privileged = { marker: 'cliente-administrativo-ficticio' }, profiles = options.profiles ?? [perfil(1)], grants = options.grants ?? []
  let profilePages = 0, inFlight = 0, maxInFlight = 0
  const db = { auth: { getUser: async () => { events.push('getUser'); if (options.control) throw options.control; return { data: { user: options.user === null ? null : { id: uid, user_metadata: { rol: 'admin' } } }, error: options.authError ?? null } } }, from(table) {
    const q = { table, filters: [], orders: [] }, b = {
      select(fields, config) { q.fields = fields; q.config = config; return b }, eq(k, v) { q.filters.push(['eq', k, v]); return b }, neq(k, v) { q.filters.push(['neq', k, v]); return b }, or(value) { q.filters.push(['or', value]); return b }, not(k, op, value) { q.filters.push(['not', k, op, value]); return b }, in(k, v) { q.filters.push(['in', k, v]); return b }, order(k, v) { q.orders.push([k, v]); return b }, range(from, to) { q.range = [from, to]; return b }, limit(n) { q.limit = n; return b }, abortSignal() { return b }, maybeSingle() { q.single = true; return run() }, then(resolve, reject) { return run().then(resolve, reject) },
    }
    const matches = row => q.filters.every(([op, k, v, extra]) => op === 'eq' ? row[k] === v : op === 'neq' ? row[k] !== null && row[k] !== v : op === 'or' ? k === 'rol.neq.admin,rol.is.null' && (row.rol === null || row.rol !== 'admin') : op === 'not' ? v === 'in' && !extra.slice(1, -1).split(',').includes(row[k]) : op === 'in' ? v.includes(row[k]) : false)
    async function run() {
      calls.push(structuredClone(q))
      if (table === 'perfiles' && q.single) {
        events.push('perfilAdmin')
        return { data: options.adminProfile === null ? null : { id: uid, rol: 'admin', ...options.adminProfile }, error: options.adminProfileError ?? null }
      }
      assert.ok(['perfiles', 'accesos_afiliadas'].includes(table), table)
      if (table === 'perfiles') {
        events.push('profilesPage'); profilePages++
        if (options.profileErrorAt === profilePages) return { data: null, error: { message: 'detalle-privado-perfiles' }, count: null }
        let data = profiles.filter(matches)
        for (const [key, config] of [...q.orders].reverse()) data = data.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (config?.ascending === false ? -1 : 1))
        const count = Object.hasOwn(options, 'profileCount') ? options.profileCount : data.length + (options.countChangeAt === profilePages ? 1 : 0)
        if (q.range) data = data.slice(q.range[0], Math.min(q.range[1] + 1, q.range[0] + (options.maxRows ?? 500)))
        if (q.limit) data = data.slice(0, q.limit)
        return { data, error: null, count }
      }
      events.push('grantsBatch'); inFlight++; maxInFlight = Math.max(inFlight, maxInFlight)
      await new Promise(resolve => setImmediate(resolve))
      try {
        if (options.grantsError) return { data: null, error: { message: 'detalle-privado-grants' }, count: null }
        let data = grants.filter(matches), count = Object.hasOwn(options, 'grantCount') ? options.grantCount : data.length
        if (options.grantMaxRows) data = data.slice(0, options.grantMaxRows)
        return { data, error: null, count }
      } finally { inFlight-- }
    }
    return b
  } }
  const canonical = {
    identidadesDeCuentas: async (admin, ids) => {
      assert.equal(admin, privileged); identities.push([...ids]); events.push('identityBatch')
      if (options.identitiesError) throw new Error('detalle-privado-identidades')
      return new Map(ids.map(userId => [userId, { email: `${userId}@example.invalid`, email_confirmado: true, cuenta_encontrada: true, ultimo_acceso: stamp, ...(options.identityOverrides?.[userId] ?? {}), raw_user_metadata: { clave: 'no-serializar-auth' } }]))
    },
  }
  const clients = { isAdminSupabaseConfigured: () => options.configured !== false, createAdminClient: () => { events.push('createAdminClient'); assert.ok(events.includes('getUser')); assert.ok(events.includes('perfilAdmin')); return privileged } }
  const deps = { './supabase/server': { createClient: async () => db }, '@/lib/supabase/server': { createClient: async () => db }, './supabase/admin': clients, '@/lib/supabase/admin': clients, './admin-team': canonical, '@/lib/admin-team': canonical }
  const load = loader(deps), api = load('src/lib/admin-student-directory-server.ts')
  return { ...api, api, load, calls, events, identities, auth: { supabase: db, userId: uid, admin: true }, maxConcurrent: () => maxInFlight }
}
test('autorización verifica getUser y perfil propio antes de clientes privilegiados o lecturas del directorio', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ authError: {} }, 401], [{ adminProfile: null }, 503], [{ adminProfileError: {} }, 503], [{ adminProfile: { id: id(1), rol: 'admin' } }, 503], [{ adminProfile: { rol: 'alumna' } }, 403], [{ adminProfile: { rol: 'afiliada' } }, 403]]) {
    const s = fixture(options), result = await s.autorizarDirectorioAlumnas(); assert.equal(result.error.status, status); assert.ok(!Object.hasOwn(result, 'supabase')); assert.ok(!s.events.includes('createAdminClient')); assert.ok(!s.events.includes('profilesPage')); assert.ok(!s.events.includes('identityBatch'))
  }
  const s = fixture(), auth = await s.autorizarDirectorioAlumnas(); assert.equal(auth.userId, uid); assert.equal(auth.admin, true); assert.deepEqual(s.events, ['getUser', 'perfilAdmin']); assert.deepEqual(s.calls[0].filters, [['eq', 'id', uid]])
  const control = { digest: 'NEXT_CONTROL' }; await assert.rejects(fixture({ control }).autorizarDirectorioAlumnas(), e => e === control)
})
test('más de1000 perfiles se leen por rangos hasta count exacto, con rolesNULL y exclusión por identidad de prueba', async () => {
  const rows = Array.from({ length: 1201 }, (_, n) => perfil(n + 1)); rows[0].rol = null; rows[1].nombre = 'Alex real'; rows.push(perfil(5000, { id: pruebaId, nombre: 'Alex Prueba' }), perfil(5001, { rol: 'admin' }))
  const s = fixture({ profiles: rows }), auth = await s.autorizarDirectorioAlumnas(), result = await s.leerDirectorioAlumnas(auth)
  assert.equal(result.estado, 'lista'); assert.equal(result.limitado, false); assert.equal(result.cuentas.length, 1201); assert.equal(new Set(result.cuentas.map(r => r.id)).size, 1201); assert.ok(result.cuentas.some(r => r.id === id(1))); assert.ok(result.cuentas.some(r => r.nombre === 'Alex real')); assert.ok(!result.cuentas.some(r => r.id === pruebaId || r.id === id(5001)))
  const pages = s.calls.filter(q => q.table === 'perfiles' && !q.single); assert.deepEqual(pages.map(q => q.range), [[0, 499], [500, 999], [1000, 1499]]); assert.ok(pages.every(q => q.config?.count === 'exact' && q.orders.some(([k]) => k === 'id')))
  const batches = s.calls.filter(q => q.table === 'accesos_afiliadas'); assert.equal(batches.length, 13); assert.ok(batches.every(q => q.config?.count === 'exact' && q.filters.some(([op, k, v]) => op === 'in' && k === 'usuaria_id' && v.length <= 100))); assert.ok(s.maxConcurrent() <= 4)
  assert.equal(s.identities.length, 1); assert.equal(s.identities[0].length, 1201); assert.ok(!s.identities[0].includes(pruebaId)); assert.ok(!s.identities[0].includes(id(5001)))
  assert.ok(s.events.indexOf('createAdminClient') > s.events.indexOf('perfilAdmin')); assert.ok(!JSON.stringify(result).includes('no-serializar-auth')); assert.ok(!Object.hasOwn(result.cuentas[0], 'rol'))
})
test('un servidor con maxRows200 no trunca el directorio silenciosamente ni repite offsets', async () => {
  const s = fixture({ profiles: Array.from({ length: 1001 }, (_, n) => perfil(n + 1)), maxRows: 200 }); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
  assert.equal(result.estado, 'lista'); assert.equal(result.limitado, false); assert.equal(result.cuentas.length, 1001)
  assert.deepEqual(s.calls.filter(q => q.table === 'perfiles' && !q.single).map(q => q.range[0]), [0, 200, 400, 600, 800, 1000])
})
test('cuentas y emails se derivan de Auth canónico en un lote, sin usar datos de perfil ni metadata editable', async () => {
  const s = fixture({ profiles: [perfil(1, { email: 'perfil-inventado@example.invalid', user_metadata: { rol: 'admin' }, tipo_usuario: null }), perfil(2)], identityOverrides: { [id(1)]: { email: 'canonica@example.invalid', email_confirmado: false, ultimo_acceso: null }, [id(2)]: { email: null, email_confirmado: null, cuenta_encontrada: false, ultimo_acceso: null } } }); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
  assert.equal(result.estado, 'lista'); assert.equal(result.errorIdentidades, false); assert.equal(result.cuentas[0].email, 'canonica@example.invalid'); assert.equal(result.cuentas[0].email_confirmado, false); assert.equal(result.cuentas[0].tipo_usuario, null); assert.equal(result.cuentas[1].cuenta_encontrada, false); assert.equal(result.cuentas[1].email, null); assert.ok(!JSON.stringify(result).includes('perfil-inventado')); assert.ok(!JSON.stringify(result).includes('user_metadata')); assert.equal(s.identities.length, 1)
})
test('fallos de identidades y permisos conservan perfiles con unknown y advertencia, sin falsos rechazos ni ceros', async () => {
  for (const options of [{ identitiesError: true }, { configured: false }]) {
    const s = fixture(options); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
    assert.equal(result.estado, 'lista'); assert.equal(result.cuentas.length, 1); assert.equal(result.errorIdentidades, true); assert.equal(result.cuentas[0].email, null); assert.equal(result.cuentas[0].email_confirmado, null); assert.equal(result.cuentas[0].cuenta_encontrada, null); assert.equal(result.cuentas[0].ultimo_acceso, null); assert.equal(result.cuentas[0].afiliadas_habilitada, false)
    assert.ok(!JSON.stringify(result).includes('detalle-privado')); if (options.configured === false) assert.ok(!s.events.includes('createAdminClient'))
  }
  for (const options of [{ grantsError: true }, { grantCount: null }, { grants: [{ usuaria_id: id(1), habilitada: 'true', version: 1, actualizada_en: stamp }] }]) {
    const s = fixture(options); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
    assert.equal(result.estado, 'lista'); assert.equal(result.errorAfiliadas, true); assert.equal(result.cuentas[0].afiliadas_habilitada, null); assert.equal(result.cuentas[0].cuenta_encontrada, true); assert.ok(!JSON.stringify(result).includes('detalle-privado'))
  }
})
test('grants truncados no convierten permisos omitidos en sin-acceso; las filas válidas se asocian porID', async () => {
  const grants = [1, 2].map(n => ({ usuaria_id: id(n), habilitada: n === 1, version: 1, actualizada_en: stamp })), profiles = [perfil(1), perfil(2), perfil(3)]
  const s = fixture({ profiles, grants }); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
  assert.equal(result.estado, 'lista'); assert.equal(result.errorAfiliadas, false); assert.deepEqual(result.cuentas.map(r => r.afiliadas_habilitada), [true, false, false])
  const cut = fixture({ profiles, grants, grantMaxRows: 1 }); await cut.autorizarDirectorioAlumnas(); const partial = await cut.leerDirectorioAlumnas(cut.auth)
  assert.equal(partial.estado, 'lista'); assert.equal(partial.errorAfiliadas, true); assert.ok(partial.cuentas.every(r => r.afiliadas_habilitada === null))
})
test('fallo de página, count ausente o recuento cambiante impiden afirmar un directorio completo', async () => {
  const profiles = Array.from({ length: 600 }, (_, n) => perfil(n + 1))
  for (const options of [{ profileCount: null }, { profileCount: '600' }, { profileErrorAt: 2 }, { countChangeAt: 2 }]) {
    const s = fixture({ profiles, ...options }); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
    assert.equal(result.estado, 'error'); assert.ok(!Object.hasOwn(result, 'cuentas')); assert.ok(!JSON.stringify(result).includes('detalle-privado'))
  }
})
test('el tope5000 informa lectura limitada y una fuente vacía confirmada no necesita directorio privilegiado', async () => {
  const s = fixture({ profiles: Array.from({ length: 5001 }, (_, n) => perfil(n + 1)) }); await s.autorizarDirectorioAlumnas(); const result = await s.leerDirectorioAlumnas(s.auth)
  assert.equal(result.estado, 'lista'); assert.equal(result.cuentas.length, 5000); assert.equal(result.limitado, true); assert.equal(s.calls.filter(q => q.table === 'perfiles' && !q.single).length, 10)
  const empty = fixture({ profiles: [] }); await empty.autorizarDirectorioAlumnas(); const blank = await empty.leerDirectorioAlumnas(empty.auth)
  assert.deepEqual(blank, { estado: 'lista', cuentas: [], limitado: false, errorIdentidades: false, errorAfiliadas: false }); assert.equal(empty.identities.length, 0); assert.ok(!empty.events.includes('createAdminClient'))
})
test('API privada soloGET conserva admin, query cerrada y respuestas no cacheables sin mutaciones', async () => {
  const s = fixture(), route = s.load('src/app/api/admin/alumnas/route.ts'), url = 'https://app.sociasdigitales.com/api/admin/alumnas'
  const response = await route.GET(new Request(url)); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal((await response.json()).cuentas.length, 1)
  assert.ok(!Object.hasOwn(route, 'POST')); assert.ok(!Object.hasOwn(route, 'PATCH')); assert.ok(!Object.hasOwn(route, 'DELETE'))
  assert.equal((await route.GET(new Request(url + '?usuaria_id=' + id(1)))).status, 400)
  for (const [options, status] of [[{ user: null }, 401], [{ adminProfile: { rol: 'alumna' } }, 403], [{ adminProfileError: {} }, 503]]) { const denied = fixture(options), api = denied.load('src/app/api/admin/alumnas/route.ts'); assert.equal((await api.GET(new Request(url))).status, status); assert.ok(!denied.events.includes('profilesPage')); assert.ok(!denied.events.includes('createAdminClient')) }
})
