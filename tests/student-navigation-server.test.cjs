/* eslint-disable @typescript-eslint/no-require-imports */
// Sesión/servicios simulados: comprueba aislamiento y degradación del reader,
// no una nueva política RLS ni autenticación real de producción.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const access = load('src/lib/access.ts')
const classes = load('src/lib/class-access.ts')
const home = load('src/lib/home-access.ts', { './access': access, './class-access': classes })
const community = load('src/lib/community.ts')
const navigation = load('src/lib/student-navigation.ts')
const achievements = load('src/lib/achievements.ts', { './class-management': load('src/lib/class-management.ts'), './my-day': load('src/lib/my-day.ts') })
const profile = { id: 'propia', nombre: '  Socia   Apellido ', rol: 'alumna', tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false }
const notices = { cantidad: 3, ultimoTitulo: 'Próximo encuentro', errorCarga: false }
const event = { id: 'proximo-encuentro', titulo: 'Clase publicada', fecha: '2026-10-28T19:30:00-03:00', enlace: null, accion: 'Entrar a la clase' }
function reader({ perfil = profile, user = { id: 'propia' }, authError = null, profileError = null, failure = '', resultados = { permitido: true }, metricas = { permitido: false }, miDia = { permitido: true }, hitos = [event], avisos = notices, dynamicFailure = null, afiliadas = { habilitada: false, error: false } } = {}) {
  const calls = [], selection = []
  const call = async (name, value) => {
    calls.push(name)
    if (failure === name) throw new Error('detalle privado: conexión')
    if (dynamicFailure?.name === name) throw dynamicFailure.error
    return typeof value === 'function' ? value() : value
  }
  const db = {
    auth: { getUser: () => call('auth', { data: { user }, error: authError }) },
    from: table => {
      assert.equal(table, 'perfiles'); calls.push('perfil')
      return { select: columns => {
        selection.push(columns)
        return { eq: (column, value) => {
          assert.equal(column, 'id'); assert.equal(value, 'propia')
          return { maybeSingle: async () => {
            if (failure === 'perfil') throw new Error('detalle privado: perfil')
            if (dynamicFailure?.name === 'perfil') throw dynamicFailure.error
            return { data: perfil, error: profileError }
          } }
        } }
      } }
    },
  }
  const permission = (name, value) => (client, id) => {
    assert.equal(client, db); assert.equal(id, 'propia')
    return call(name, value)
  }
  const api = load('src/lib/student-navigation-server.ts', {
    'next/navigation': { unstable_rethrow: error => { if (error?.digest === 'NEXT_DYNAMIC_TEST') throw error } },
    './supabase/server': { createClient: () => call('cliente', db) },
    './home-access': home, './community': community, './achievements': achievements,
    './results-server': { permisoResultados: permission('resultados', resultados) },
    './metrics-server': { permisoMetricas: permission('metricas', metricas) },
    './my-day-server': { permisoMiDia: permission('miDia', miDia) },
    './affiliate-access-server': { leerAccesoAfiliadas: async (client, id, p) => { assert.equal(client, db); assert.equal(id, 'propia'); assert.equal(p, perfil); return call('afiliadas', afiliadas) } },
    './unread-notices': { leerAvisosSinLeer: permission('avisos', avisos) },
    './agenda-store': { leerAgenda: () => call('agenda', { hito: { ...event, publicado: true, audiencias: ['socia'] } }) },
    './agenda-management': { hitoParaAlumna: (_hito, p) => { assert.equal(p, perfil); calls.push('filtrar-agenda'); return hitos } },
  })
  return { ...api, calls, selection }
}
test('reader verifica Auth y perfil propio antes de permisos; solo serializa presentación explícita', async () => {
  const view = reader({ perfil: { ...profile, email: 'privado@ejemplo.test', avatar_url: 'https://privado.test/foto', secreto: 'no serializar' }, user: { id: 'propia', user_metadata: { rol: 'admin', nombre: 'Metadata editable' }, access_token: 'token privado' } })
  const result = await view.leerNavegacionAlumna()
  assert.deepEqual(view.calls.slice(0, 3), ['cliente', 'auth', 'perfil'])
  assert.deepEqual(view.selection, ['id,nombre,rol,tipo_usuario,estado,desafio_socias_habilitada'])
  assert.equal(result.nombre, 'Socia'); assert.equal(result.formacion, true); assert.equal(result.comunidad, true)
  assert.equal(result.afiliadas, false)
  assert.deepEqual(result.herramientas, { resultados: true, metricas: false, miDia: true, logros: true })
  assert.deepEqual(result.avisos, notices); assert.deepEqual(result.hitos, [event]); assert.equal(result.errorAgenda, false)
  assert.ok(Number.isSafeInteger(result.ahoraInicial))
  assert.deepEqual(Object.keys(result).sort(), ['nombre', 'formacion', 'comunidad', 'afiliadas', 'herramientas', 'ahoraInicial', 'avisos', 'hitos', 'errorAgenda'].sort())
  for (const secret of ['propia', 'privado@', 'privado.test', 'token privado', 'Metadata editable', 'no serializar', 'user_metadata']) assert.ok(!JSON.stringify(result).includes(secret))
})
test('admin, perfil ajeno, ausente o fallido y acceso sin formación no consultan avisos, agenda ni herramientas', async () => {
  const cases = [
    { perfil: null }, { perfil: { ...profile, id: 'ajena' } }, { perfil: { ...profile, rol: 'admin' } },
    { perfil: { ...profile, tipo_usuario: 'gratuito' } },
    { perfil: { ...profile, tipo_usuario: 'desafio', desafio_socias_habilitada: false } },
    { perfil: { ...profile, estado: 'pausada', desafio_socias_habilitada: true } },
    { perfil: { ...profile, estado: 'cancelada' } }, { perfil: { ...profile, estado: undefined } },
    { perfil: { ...profile, rol: 'afiliada', tipo_usuario: null } },
    { profileError: { message: 'detalle privado' } }, { failure: 'perfil' },
  ]
  for (const options of cases) {
    const view = reader(options)
    assert.equal(await view.leerNavegacionAlumna(), null)
    const perfil = options.perfil === undefined ? profile : options.perfil
    const consultaAfiliadas = perfil && perfil.id === 'propia' && perfil.rol !== 'admin' && !options.profileError && options.failure !== 'perfil'
    assert.deepEqual(view.calls, ['cliente', 'auth', 'perfil', ...(consultaAfiliadas ? ['afiliadas'] : [])])
  }
})
test('Socia con Afiliadas conserva formación, comunidad, herramientas, avisos y ambas rutas del menú', async () => {
  const view = reader({ afiliadas: { habilitada: true, error: false }, metricas: { permitido: true } })
  const result = await view.leerNavegacionAlumna()
  assert.equal(result.formacion, true); assert.equal(result.afiliadas, true); assert.equal(result.comunidad, true)
  assert.deepEqual(result.herramientas, { resultados: true, metricas: true, miDia: true, logros: true })
  assert.deepEqual(result.hitos, [event]); assert.deepEqual(result.avisos, notices)
  const principales = navigation.seccionesPrincipalesEstudiante(result)
  for (const href of ['/clases', '/lanzamiento', '/afiliadas', '/comunidad']) assert.ok(principales.some(item => item.href === href), href)
  assert.equal(principales.filter(item => item.id === 'afiliadas').length, 1)
  assert.ok(view.calls.includes('agenda')); assert.ok(view.calls.includes('resultados')); assert.ok(view.calls.includes('afiliadas'))
})
test('Afiliada gratuita explícita recibe menú propio y avisos sin consultar agenda o herramientas de Socias', async () => {
  const view = reader({ perfil: { ...profile, tipo_usuario: 'gratuito' }, afiliadas: { habilitada: true, error: false }, resultados: { permitido: true }, metricas: { permitido: true }, miDia: { permitido: true } })
  const result = await view.leerNavegacionAlumna()
  assert.equal(result.nombre, 'Socia'); assert.equal(result.formacion, false)
  assert.equal(result.afiliadas, true); assert.equal(result.comunidad, false)
  assert.deepEqual(result.herramientas, { resultados: false, metricas: false, miDia: false, logros: false })
  assert.deepEqual(result.hitos, []); assert.equal(result.errorAgenda, false)
  assert.deepEqual(result.avisos, notices)
  assert.deepEqual(view.calls, ['cliente', 'auth', 'perfil', 'afiliadas', 'avisos'])
  assert.deepEqual(navigation.seccionesPrincipalesEstudiante(result).map(item => item.href), ['/inicio', '/afiliadas', '/perfil', '/notificaciones'])
  assert.deepEqual(navigation.herramientasEstudiante(result), [])
  const afiliadas = navigation.seccionesPrincipalesEstudiante(result).find(item => item.id === 'afiliadas')
  assert.equal(navigation.activoSeccionEstudiante('/afiliadas?campana=proxima', afiliadas), true)
  assert.equal(navigation.activoSeccionEstudiante('/afiliadas/recursos', afiliadas), true)
  assert.equal(navigation.activoSeccionEstudiante('/afiliadas-otra', afiliadas), false)
})
test('rol antiguo o metadata editable no conceden Afiliadas sin permiso explícito', async () => {
  for (const rol of ['alumna', 'afiliada', 'afiliada_lanzamiento']) {
    const view = reader({ perfil: { ...profile, tipo_usuario: 'gratuito', rol }, user: { id: 'propia', user_metadata: { rol: 'afiliada', afiliadas: true, habilitada: true, tipo_usuario: 'socia' } } })
    assert.equal(await view.leerNavegacionAlumna(), null)
    assert.deepEqual(view.calls, ['cliente', 'auth', 'perfil', 'afiliadas'])
  }
  const result = await reader({ perfil: { ...profile, rol: 'afiliada' } }).leerNavegacionAlumna()
  assert.equal(result.formacion, true); assert.equal(result.afiliadas, false)
  assert.ok(!navigation.seccionesPrincipalesEstudiante(result).some(item => item.id === 'afiliadas'))
})
test('fallo cerrado del permiso Afiliadas conserva los accesos Socia independientes', async () => {
  const result = await reader({ afiliadas: { habilitada: false, error: true }, metricas: { permitido: true } }).leerNavegacionAlumna()
  assert.equal(result.formacion, true); assert.equal(result.afiliadas, false); assert.equal(result.comunidad, true)
  assert.deepEqual(result.herramientas, { resultados: true, metricas: true, miDia: true, logros: true })
  assert.deepEqual(result.hitos, [event]); assert.equal(result.errorAgenda, false)
  assert.deepEqual(result.avisos, notices)
  assert.ok(navigation.seccionesPrincipalesEstudiante(result).some(item => item.id === 'programa'))
  assert.ok(!navigation.seccionesPrincipalesEstudiante(result).some(item => item.id === 'afiliadas'))
  const gratuita = reader({ perfil: { ...profile, tipo_usuario: 'gratuito' }, afiliadas: { habilitada: false, error: true } })
  assert.equal(await gratuita.leerNavegacionAlumna(), null)
  assert.deepEqual(gratuita.calls, ['cliente', 'auth', 'perfil', 'afiliadas'])
})
test('sesión ausente, Auth fallida o cliente fallido conserva recorrido original sin consultar perfiles', async () => {
  for (const [options, calls] of [[{ user: null }, ['cliente', 'auth']], [{ authError: {} }, ['cliente', 'auth']], [{ failure: 'auth' }, ['cliente', 'auth']], [{ failure: 'cliente' }, ['cliente']]]) {
    const view = reader(options)
    assert.equal(await view.leerNavegacionAlumna(), null)
    assert.deepEqual(view.calls, calls)
  }
})
test('Desafío habilitado conserva formación sin heredar comunidad o permisos individuales por metadata', async () => {
  const view = reader({ perfil: { ...profile, tipo_usuario: 'desafio', desafio_socias_habilitada: true }, user: { id: 'propia', user_metadata: { tipo_usuario: 'socia', rol: 'admin' } }, resultados: { permitido: false }, metricas: { permitido: false }, miDia: { permitido: false } })
  const result = await view.leerNavegacionAlumna()
  assert.equal(result.formacion, true); assert.equal(result.comunidad, false)
  assert.deepEqual(result.herramientas, { resultados: false, metricas: false, miDia: false, logros: false })
})
test('cada permiso fallido, incoherente o administrativo queda cerrado sin borrar los demás ni sus avisos', async () => {
  for (const name of ['resultados', 'metricas', 'miDia']) for (const invalid of [{ permitido: false }, { permitido: true, error: true }, { permitido: true, admin: true }, { permitido: 'true' }]) {
    const view = reader({ resultados: { permitido: true }, metricas: { permitido: true }, miDia: { permitido: true }, [name]: invalid })
    const result = await view.leerNavegacionAlumna()
    assert.equal(result.herramientas[name], false, `${name}: ${JSON.stringify(invalid)}`)
    for (const other of ['resultados', 'metricas', 'miDia'].filter(value => value !== name)) assert.equal(result.herramientas[other], true)
    assert.deepEqual(result.avisos, notices)
  }
  for (const name of ['resultados', 'metricas', 'miDia']) {
    const result = await reader({ failure: name }).leerNavegacionAlumna()
    assert.equal(result.herramientas[name], false); assert.equal(result.formacion, true)
  }
})
test('fallos de avisos o agenda se identifican como desconocidos, no como una confirmación falsa de vacío', async () => {
  const noticeFailure = await reader({ failure: 'avisos' }).leerNavegacionAlumna()
  assert.deepEqual(noticeFailure.avisos, { cantidad: 0, ultimoTitulo: null, errorCarga: true })
  assert.deepEqual(noticeFailure.hitos, [event]); assert.equal(noticeFailure.errorAgenda, false)
  const agendaFailure = await reader({ failure: 'agenda' }).leerNavegacionAlumna()
  assert.deepEqual(agendaFailure.hitos, []); assert.equal(agendaFailure.errorAgenda, true)
  assert.deepEqual(agendaFailure.avisos, notices)
  for (const nombre of ['', '   ', null, 7]) assert.equal((await reader({ perfil: { ...profile, nombre } }).leerNavegacionAlumna()).nombre, 'Socia')
})
test('señales dinámicas de Next se propagan en vez de quedar absorbidas como acceso o agenda vacíos', async () => {
  for (const name of ['perfil', 'afiliadas', 'resultados', 'metricas', 'miDia', 'avisos', 'agenda']) {
    const error = Object.assign(new Error('señal interna'), { digest: 'NEXT_DYNAMIC_TEST' })
    await assert.rejects(() => reader({ dynamicFailure: { name, error } }).leerNavegacionAlumna(), value => value === error)
  }
})
test('reader es solo lectura de sesión, sin elevación, cookies manuales, caché compartida o escrituras nuevas', () => {
  const source = read('src/lib/student-navigation-server.ts')
  assert.ok(source.startsWith("import 'server-only'"))
  assert.ok(source.includes('supabase.auth.getUser()')); assert.ok(source.includes('perfil.id !== user.id'))
  for (const forbidden of ['getSession(', 'user_metadata', 'createAdminClient', 'process.env', '.insert(', '.update(', '.upsert(', '.delete(', 'unstable_cache', "'use cache'", 'cookies(', 'fetch(']) assert.ok(!source.includes(forbidden))
  assert.equal((source.match(/\.from\(/g) || []).length, 1)
})
test('layout común solo envuelve datos protegidos y conserva el hijo original cuando no corresponde', async () => {
  const child = React.createElement('main', { id: 'original' }, 'Contenido original')
  let reads = 0, frameCalls = 0
  for (const datos of [null, { nombre: 'Socia', formacion: true }, { nombre: 'Afiliada', formacion: false, afiliadas: true }]) {
    const Layout = load('src/components/StudentSectionLayout.tsx', {
      '@/lib/student-navigation-server': { leerNavegacionAlumna: async () => { reads++; return datos } },
      './StudentShellFrame': { default: ({ datos: passed, children }) => { frameCalls++; assert.equal(passed, datos); return React.createElement('div', { 'data-frame': true }, children) } },
    }).default
    const result = await Layout({ children: child })
    if (datos === null) assert.equal(result, child)
    const html = renderToStaticMarkup(result)
    assert.equal(html.includes('data-frame="true"'), datos !== null)
    assert.equal((html.match(/<main\b/g) || []).length, 1)
    assert.ok(html.includes('Contenido original'))
  }
  assert.equal(reads, 3); assert.equal(frameCalls, 2)
})
test('todas las secciones de alumna reutilizan el layout sin duplicar el marco en rutas anidadas ni incluir administración', () => {
  for (const route of ['classroom', 'clases', 'lanzamiento', 'perfil', 'notificaciones', 'comunidad', 'checklist', 'metricas', 'resultados', 'logros', 'cuenta', 'productos', 'objetivos', 'ranking', 'afiliadas']) {
    assert.equal(read(`src/app/${route}/layout.tsx`).trim(), "export { default } from '@/components/StudentSectionLayout'", route)
  }
  assert.ok(!fs.existsSync(path.join(__dirname, '../src/app/inicio/layout.tsx')))
  assert.ok(!fs.existsSync(path.join(__dirname, '../src/app/clases/materiales/layout.tsx')))
  assert.ok(!read('src/app/layout.tsx').includes('StudentSectionLayout'))
})
