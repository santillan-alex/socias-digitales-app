/* eslint-disable @typescript-eslint/no-require-imports */
// Perfil/lectores simulados; no Auth adicional, credenciales ni consultas reales.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports); return m.exports }
const access = load('src/lib/class-access.ts'), management = load('src/lib/class-management.ts'), progress = load('src/lib/class-progress.ts'), day = load('src/lib/my-day.ts')
const campus = load('src/lib/learning-campus.ts', { './class-management': management, './class-progress': progress })
const planner = load('src/lib/study-planner.ts', { './my-day': day })
const perfil = { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false }
const clase = { id: 'a1111111-1111-4111-8111-111111111111', titulo: 'Clase ficticia', modulo: 'Bienvenida', orden: 0, activo: true, puede_ver: true, tiene_video_privado: true, vimeo_url: null, plan: '27', descripcion: null }
function server({ profile = perfil, profileError = null, profileThrow = false, catalogo = async () => [clase], progreso = async () => [] } = {}) {
  const calls = []
  const supabase = {
    auth: { getUser: () => { throw new Error('El llamador ya verificó getUser') } },
    from: table => {
      calls.push(['tabla', table]); assert.equal(table, 'perfiles')
      return { select: campos => { calls.push(['select', campos]); return { eq: (campo, valor) => { calls.push(['eq', campo, valor]); return { maybeSingle: async () => { if (profileThrow) throw new Error('detalle privado'); return { data: profile, error: profileError } } } } } } }
    },
  }
  const campusServer = load('src/lib/learning-campus-server.ts', {
    './class-access': access, './learning-campus': campus,
    './class-catalog': { leerCatalogoClases: p => { calls.push(['catalogo', p]); return catalogo() } },
    './class-progress-server': { leerProgresoClases: (s, id) => { assert.equal(s, supabase); calls.push(['progreso', id]); return progreso() } },
  })
  const api = load('src/lib/study-planner-server.ts', { './class-access': access, './learning-campus-server': campusServer, './study-planner': planner })
  return { ...api, supabase, calls }
}
test('reader usa solo perfil protegido propio y lectores del campus con la misma cuenta, sin Auth ni accesos nuevos', async () => {
  const view = server(), result = await view.leerPlanEstudio(view.supabase, 'cuenta-propia')
  assert.equal(result.estado, 'listo'); assert.equal(result.opciones[0].id, clase.id)
  assert.deepEqual(view.calls, [['tabla', 'perfiles'], ['select', 'rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada'], ['eq', 'id', 'cuenta-propia'], ['catalogo', perfil], ['progreso', 'cuenta-propia']])
})
test('admin, sin formación, pausada, cancelada o perfil inválido no inicia lecturas del campus', async () => {
  for (const profile of [null, { ...perfil, rol: 'admin' }, { ...perfil, tipo_usuario: 'gratuito' }, { ...perfil, tipo_usuario: 'desafio' }, { ...perfil, estado: 'pausada' }, { ...perfil, estado: 'cancelada' }, { ...perfil, estado: undefined }, { rol: 'afiliada', estado: 'activa' }]) {
    const view = server({ profile }), result = await view.leerPlanEstudio(view.supabase, 'cuenta-propia')
    assert.deepEqual(result, { estado: 'error', opciones: [] })
    assert.equal(view.calls.filter(call => ['catalogo', 'progreso'].includes(call[0])).length, 0)
  }
  const vacio = server(); assert.deepEqual(await vacio.leerPlanEstudio(vacio.supabase, ''), { estado: 'error', opciones: [] }); assert.deepEqual(vacio.calls, [])
})
test('el permiso de formación actual conserva su contrato; este reader no sustituye permisoMiDia del llamador', async () => {
  const view = server({ profile: { ...perfil, tipo_usuario: 'desafio', desafio_socias_habilitada: true } })
  assert.equal((await view.leerPlanEstudio(view.supabase, 'cuenta-propia')).estado, 'listo')
  assert.equal(view.calls.filter(call => call[0] === 'tabla').length, 1)
  assert.ok(read('src/lib/study-planner-server.ts').includes('el llamador verificó getUser y permisoMiDia'))
})
test('catálogo y progreso siguen paralelos después del perfil protegido; no se agregan consultas directas de contenido', async () => {
  let finishCatalogo, finishProgreso
  const view = server({ catalogo: () => new Promise(resolve => { finishCatalogo = resolve }), progreso: () => new Promise(resolve => { finishProgreso = resolve }) })
  const reading = view.leerPlanEstudio(view.supabase, 'cuenta-propia')
  await Promise.resolve(); await Promise.resolve()
  assert.equal(typeof finishCatalogo, 'function'); assert.equal(typeof finishProgreso, 'function')
  finishProgreso([]); finishCatalogo([clase])
  assert.equal((await reading).estado, 'listo')
})
test('error de perfil/catálogo/progreso impide sugerencias; un vacío real y programa completado quedan listos sin opciones', async () => {
  const failure = async () => { throw new Error('detalle privado de la conexión') }
  for (const opciones of [{ profileError: {} }, { profileThrow: true }, { catalogo: failure }, { progreso: failure }]) {
    const view = server(opciones), result = await view.leerPlanEstudio(view.supabase, 'cuenta-propia')
    assert.deepEqual(result, { estado: 'error', opciones: [] })
    assert.ok(!JSON.stringify(result).includes('detalle privado'))
  }
  const vacio = server({ catalogo: async () => [] })
  assert.deepEqual(await vacio.leerPlanEstudio(vacio.supabase, 'cuenta-propia'), { estado: 'listo', opciones: [] })
  const terminado = server({ progreso: async () => [{ clase_id: clase.id, posicion_seg: 0, duracion_seg: 100, completada: true, actualizado_en: '2026-10-23T12:00:00Z' }] })
  assert.deepEqual(await terminado.leerPlanEstudio(terminado.supabase, 'cuenta-propia'), { estado: 'listo', opciones: [] })
})
test('salida y código no incluyen PII, URLs privadas, nuevas escrituras o caché compartida', async () => {
  const view = server({ catalogo: async () => [{ ...clase, video_key: 'objeto-privado', vimeo_url: 'https://vimeo.com/123?token=secreto', perfil: { email: 'privado@ejemplo.test' } }] })
  const result = await view.leerPlanEstudio(view.supabase, 'cuenta-propia')
  for (const privado of ['objeto-privado', 'vimeo.com', 'token', 'secreto', 'email', 'cuenta-propia']) assert.ok(!JSON.stringify(result).includes(privado))
  const source = read('src/lib/study-planner-server.ts')
  assert.ok(source.startsWith("import 'server-only'"))
  for (const mutation of ['.insert(', '.update(', '.upsert(', '.delete(', 'createAdminClient', 'user_metadata', 'process.env', 'unstable_cache', "'use cache'"]) assert.ok(!source.includes(mutation))
})
