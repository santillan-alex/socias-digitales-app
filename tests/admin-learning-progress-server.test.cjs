/* eslint-disable @typescript-eslint/no-require-imports */
// Transporte y Auth simulados; no consulta datos reales ni certifica RLS remota.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..'), uid = '00000000-0000-4000-8000-999999999999', pruebaId = '06bb7999-997b-49c8-ba80-b8d05bca4a84', id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, stamp = '2026-11-05T12:00:00Z'
const alumno = (n, changes = {}) => ({ id: id(n), nombre: `Alumna ${n}`, tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false, rol: 'alumna', ...changes })
const clase = (n, changes = {}) => ({ id: id(n), titulo: `Clase ${n}`, modulo: 'Desafío Socias', orden: n, acceso_gratuito: false, activo: true, video_key: `privado/${n}.mp4`, vimeo_url: null, ...changes })
const md5 = value => createHash('md5').update(value).digest('hex')
const avance = (a, c, changes = {}) => ({ alumna_id: id(a), clase_id: id(c), posicion_seg: 14, duracion_seg: 120, completada: false, actualizado_en: stamp, video_revision: md5(`privado/${c}.mp4`), ...changes })
function loader(deps = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.resolve(root, file); if (cache.has(full)) return cache.get(full).exports
    const m = { exports: {} }; cache.set(full, m)
    const req = n => {
      if (Object.hasOwn(deps, n)) return deps[n]
      if (n === 'server-only') return {}
      if (n === 'next/navigation') return { unstable_rethrow: e => { if (e?.digest === 'NEXT_CONTROL') throw e } }
      if (n.startsWith('.') || n.startsWith('@/')) return load(path.relative(root, n.startsWith('@/') ? path.join(root, 'src', n.slice(2) + '.ts') : path.resolve(path.dirname(full), n + '.ts')))
      return require(n)
    }
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(req, m, m.exports)
    return m.exports
  }
  return load
}
function fixture(options = {}) {
  const calls = [], events = [], pages = {}, profiles = options.profiles ?? [alumno(1)], classes = options.classes ?? [clase(1)], progress = options.progress ?? [avance(1, 1)]
  const db = { auth: { getUser: async () => { events.push('getUser'); if (options.control) throw options.control; return { data: { user: options.user === null ? null : { id: options.userId ?? uid, user_metadata: { rol: 'admin' } } }, error: options.authError ?? null } } }, from(table) {
    const q = { table, filters: [], orders: [] }, b = {
      select(fields, config) { q.fields = fields; q.config = config; return b }, eq(k, v) { q.filters.push(['eq', k, v]); return b }, or(expr, config) { q.filters.push(['or', expr, config]); return b }, not(k, op, value) { q.filters.push(['not', k, op, value]); return b }, order(k, config) { q.orders.push([k, config]); return b }, range(from, to) { q.range = [from, to]; return b }, abortSignal(signal) { assert.ok(signal instanceof AbortSignal); q.signal = true; return b }, maybeSingle() { q.single = true; return run() }, then(resolve, reject) { return run().then(resolve, reject) },
    }
    const value = (row, key) => key.split('.').reduce((out, part) => out?.[part], row)
    const matches = row => q.filters.every(([op, k, v, extra]) => {
      if (op === 'eq') return value(row, k) === v
      if (op === 'not') return v === 'in' && !extra.slice(1, -1).split(',').includes(row[k])
      if (op !== 'or') throw new Error('Filtro no previsto')
      const target = v?.referencedTable ? row[v.referencedTable] : row
      if (!target) return false
      if (k === 'rol.neq.admin,rol.is.null') return target.rol !== 'admin'
      if (k === 'video_key.not.is.null,vimeo_url.not.is.null') return target.video_key !== null || target.vimeo_url !== null
      throw new Error('Filtro no previsto')
    })
    async function run() {
      calls.push(structuredClone(q)); events.push(q.single ? 'adminProfile' : table)
      if (q.single) return { data: options.adminProfile === null ? null : { id: uid, rol: 'admin', ...options.adminProfile }, error: options.adminProfileError ?? null }
      const page = pages[table] = (pages[table] ?? 0) + 1
      if (options.controlRead) throw options.controlRead
      if (options.errorAt?.[table] === page) return { data: null, error: { message: 'detalle privado del proveedor' }, count: null }
      let data = table === 'perfiles' ? profiles : table === 'clases' ? classes : progress.map(p => ({ ...p, clases: classes.find(c => c.id === p.clase_id), perfiles: profiles.find(a => a.id === p.alumna_id), ...options.joins?.[`${p.alumna_id}:${p.clase_id}`] }))
      data = data.filter(matches)
      for (const [key, config] of [...q.orders].reverse()) data = [...data].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (config?.ascending === false ? -1 : 1))
      const count = Object.hasOwn(options.counts ?? {}, table) ? options.counts[table] : data.length + (options.changeAt?.[table] === page ? 1 : 0)
      const from = q.range[0], to = Math.min(q.range[1] + 1, from + (options.maxRows ?? 500))
      data = options.duplicateAt?.[table] === page ? data.slice(0, to - from) : data.slice(from, to)
      if (options.emptyAt?.[table] === page) data = []
      return { data, error: null, count }
    }
    return b
  } }
  const load = loader({ './supabase/server': { createClient: async () => db } }), api = load('src/lib/admin-learning-progress-server.ts')
  return { ...api, load, calls, events, auth: { supabase: db, userId: uid, admin: true } }
}
test('getUser y rol propio preceden al seguimiento; metadata, rol anterior o perfil ajeno no autorizan', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ authError: {} }, 401], [{ userId: 'invalido' }, 503], [{ adminProfile: null }, 503], [{ adminProfileError: {} }, 503], [{ adminProfile: { id: id(1) } }, 503], [{ adminProfile: { rol: 'alumna' } }, 403], [{ adminProfile: { rol: 'afiliada' } }, 403]]) {
    const s = fixture(options), auth = await s.autorizarSeguimientoFormacion(); assert.equal(auth.error.status, status); assert.ok(!Object.hasOwn(auth, 'supabase')); assert.ok(!s.calls.some(c => !c.single))
  }
  const s = fixture(), auth = await s.autorizarSeguimientoFormacion(); assert.equal(auth.userId, uid); assert.equal(auth.admin, true); assert.deepEqual(s.events, ['getUser', 'adminProfile']); assert.deepEqual(s.calls[0].filters, [['eq', 'id', uid]])
  const control = { digest: 'NEXT_CONTROL' }; await assert.rejects(fixture({ control }).autorizarSeguimientoFormacion(), e => e === control)
})
test('lectura RLS pagina por count exacto con offsets reales, incluyendo límites maxRows menores al pedido', async () => {
  const profiles = Array.from({ length: 1001 }, (_, n) => alumno(n + 1)); profiles.push(alumno(5000, { rol: 'admin' }), alumno(5001, { id: pruebaId })); profiles[1].rol = null
  const s = fixture({ profiles, maxRows: 200 }), auth = await s.autorizarSeguimientoFormacion(), result = await s.leerSeguimientoFormacion(auth)
  assert.equal(result.estado, 'lista'); assert.equal(result.alumnas.length, 1001); assert.equal(result.progreso.length, 1); assert.ok(result.alumnas.some(a => a.id === id(2))); assert.ok(!result.alumnas.some(a => a.id === pruebaId || a.id === id(5000)))
  const pages = s.calls.filter(c => c.table === 'perfiles' && !c.single); assert.deepEqual(pages.map(c => c.range[0]), [0, 200, 400, 600, 800, 1000]); assert.ok(pages.every(c => c.config.count === 'exact' && c.orders[0][0] === 'id' && c.signal))
  const dto = JSON.stringify(result); for (const secret of ['privado/', 'video_key', 'vimeo_url', 'video_revision', 'user_metadata', 'email', 'rol']) assert.ok(!dto.includes(secret), secret)
})
test('solo publicaciones con video y su revisión actual generan avance; los datos de alumna desconocidos permanecen null', async () => {
  const profiles = [alumno(1, { nombre: '  Ana  ', tipo_usuario: 'anterior', estado: 'anterior', desafio_socias_habilitada: null }), alumno(2, { rol: 'admin' }), alumno(3, { id: pruebaId })]
  const classes = [clase(1), clase(2, { activo: false }), clase(3, { video_key: null }), clase(4, { video_key: null, vimeo_url: 'https://vimeo.com/123' })]
  const progress = [avance(1, 1), avance(1, 2), avance(1, 3), avance(1, 4, { video_revision: md5('video anterior') }), avance(2, 1), avance(3, 1, { alumna_id: pruebaId })]
  const s = fixture({ profiles, classes, progress }), result = await s.leerSeguimientoFormacion(s.auth)
  assert.equal(result.estado, 'lista'); assert.deepEqual(result.clases.map(c => c.id), [id(1), id(4)]); assert.equal(result.alumnas.length, 1); assert.deepEqual(result.alumnas[0], { id: id(1), nombre: 'Ana', tipo_usuario: null, estado: null, desafio_socias_habilitada: null }); assert.deepEqual(result.progreso, [{ alumna_id: id(1), clase_id: id(1), posicion_seg: 14, duracion_seg: 120, completada: false, actualizado_en: stamp }])
})
test('count ausente/cambiante, páginas fallidas/vacías y duplicados cierran sin ceros ni listas parciales', async () => {
  const profiles = Array.from({ length: 501 }, (_, n) => alumno(n + 1))
  for (const options of [{ counts: { perfiles: null } }, { counts: { perfiles: '501' } }, { changeAt: { perfiles: 2 } }, { errorAt: { perfiles: 2 } }, { emptyAt: { perfiles: 2 } }, { duplicateAt: { perfiles: 2 } }]) {
    const s = fixture({ profiles, ...options }), result = await s.leerSeguimientoFormacion(s.auth); assert.equal(result.estado, 'error'); assert.deepEqual(Object.keys(result), ['estado', 'mensaje']); assert.ok(!JSON.stringify(result).includes('detalle privado'))
  }
  for (const [table, count] of [['perfiles', 5001], ['clases', 1001], ['progreso_clases', 50001]]) {
    const s = fixture({ counts: { [table]: count } }), result = await s.leerSeguimientoFormacion(s.auth); assert.equal(result.estado, 'error'); assert.equal(s.calls.filter(c => c.table === table && !c.single).length, 1)
  }
})
test('progreso también pagina por clave compuesta; revisión o relaciones cambiadas no afirman resultados', async () => {
  const profiles = Array.from({ length: 601 }, (_, n) => alumno(n + 1)), progress = profiles.map((_, n) => avance(n + 1, 1))
  const s = fixture({ profiles, progress, maxRows: 200 }), result = await s.leerSeguimientoFormacion(s.auth); assert.equal(result.estado, 'lista'); assert.equal(result.progreso.length, 601)
  const calls = s.calls.filter(c => c.table === 'progreso_clases'); assert.deepEqual(calls.map(c => c.range[0]), [0, 200, 400, 600]); assert.ok(calls.every(c => c.config.count === 'exact' && c.orders.map(o => o[0]).join(',') === 'alumna_id,clase_id'))
  for (const changes of [{ clases: clase(1, { video_key: 'video reemplazado' }) }, { clases: clase(9) }, { perfiles: alumno(9) }]) {
    const f = fixture({ joins: { [`${id(1)}:${id(1)}`]: changes } }); assert.equal((await f.leerSeguimientoFormacion(f.auth)).estado, 'error')
  }
  for (const options of [{ counts: { progreso_clases: null } }, { progress: [avance(1, 1, { posicion_seg: 500 })] }, { progress: [avance(1, 1, { video_revision: 'corrupta' })] }]) { const f = fixture(options); assert.equal((await f.leerSeguimientoFormacion(f.auth)).estado, 'error') }
})
test('vacío confirmado no necesita progreso; señales Next se propagan y sesión inválida no lee datos', async () => {
  const s = fixture({ classes: [], profiles: [] }), result = await s.leerSeguimientoFormacion(s.auth); assert.deepEqual(result, { estado: 'lista', clases: [], alumnas: [], progreso: [] }); assert.ok(!s.events.includes('progreso_clases'))
  const controlRead = { digest: 'NEXT_CONTROL' }, f = fixture({ controlRead }); await assert.rejects(f.leerSeguimientoFormacion(f.auth), e => e === controlRead)
  const denied = fixture(); assert.equal((await denied.leerSeguimientoFormacion({ ...denied.auth, admin: false })).estado, 'error'); assert.equal(denied.calls.length, 0)
})
test('GET privado no admite query ni escrituras; errores conservan estado y headers sin datos privados', async () => {
  const url = 'https://app.sociasdigitales.com/api/admin/formacion', s = fixture(), route = s.load('src/app/api/admin/formacion/route.ts'), response = await route.GET(new Request(url))
  assert.equal(response.status, 200); assert.equal((await response.json()).estado, 'lista'); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(Object.hasOwn(route, method), false)
  const q = fixture(), query = await q.load('src/app/api/admin/formacion/route.ts').GET(new Request(url + '?alumna=' + id(1))); assert.equal(query.status, 400); assert.ok(!q.calls.some(c => !c.single))
  for (const [options, status] of [[{ user: null }, 401], [{ adminProfile: { rol: 'alumna' } }, 403], [{ counts: { perfiles: null } }, 503]]) {
    const f = fixture(options), result = await f.load('src/app/api/admin/formacion/route.ts').GET(new Request(url)); assert.equal(result.status, status); const body = await result.json(); assert.equal(body.estado, 'error'); assert.ok(!Object.hasOwn(body, 'alumnas')); assert.equal(result.headers.get('cache-control'), 'private, no-store')
  }
})
