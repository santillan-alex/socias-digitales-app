/* eslint-disable @typescript-eslint/no-require-imports */
// Servicios simulados y datos ficticios. No prueba RLS, una sesión real ni una
// descarga sobre documentos de alumnas; ese recorrido se comprueba aparte.
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
const SOCIA = { id: 'propia', rol: 'alumna', tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false }
const REVISION = 'abc123'.repeat(10) + 'abcd'
const PAGINA = { estado: 'listo', recursos: [], fallos: [], offset: 0, nextOffset: null, hayMas: false, revisionCatalogo: REVISION, resumen: { clasesRevisadas: 0, clasesLeidas: 0, materiales: 0, archivos: 0, enlaces: 0 } }
function paginaEstado(estado) {
  if (estado === 'error' || estado === 'actualizado') return { estado, mensaje: 'Estado ficticio de prueba.' }
  if (estado === 'parcial') return { ...PAGINA, estado, fallos: [{ claseId: '00000000-0000-4000-8000-000000000001', claseTitulo: 'Clase ficticia', programa: 'Desafío Socias', seccion: 'Clases' }], resumen: { ...PAGINA.resumen, clasesRevisadas: 1 } }
  return PAGINA
}
const link = { default: props => React.createElement('a', props) }
class NextResponse extends Response { static json(data, options) { return Response.json(data, options) } }
function identity({ user = { id: 'propia' }, errorSesion = null, perfil = SOCIA, errorPerfil = null } = {}) {
  const calls = []
  const db = {
    auth: { getUser: async () => { calls.push('getUser'); return { data: { user }, error: errorSesion } } },
    from(table) {
      calls.push(['table', table]); assert.equal(table, 'perfiles')
      return { select(columns) {
        calls.push(['select', columns])
        return { eq(campo, id) {
          calls.push(['eq', campo, id]); assert.equal(campo, 'id'); assert.equal(id, 'propia')
          return { maybeSingle: async () => ({ data: perfil, error: errorPerfil }) }
        } }
      } }
    },
  }
  const auth = load('src/lib/resource-library-access.ts', { './supabase/server': { createClient: async () => db } })
  return { ...auth, calls, db }
}

test('autorización usa getUser y el perfil propio completo antes de consultar recursos', async () => {
  const p = identity(), result = await p.autorizarBibliotecaRecursos()
  assert.deepEqual(result, { perfil: SOCIA })
  assert.equal(p.calls[0], 'getUser')
  assert.deepEqual(p.calls[1], ['table', 'perfiles'])
  assert.deepEqual(p.calls[3], ['eq', 'id', 'propia'])
  const fields = p.calls[2][1].split(',')
  assert.deepEqual(fields, ['id', 'rol', 'tipo_usuario', 'estado', 'desafio_socias_habilitada', 'socias_farmaci_habilitada'])
  assert.ok(!Object.hasOwn(result, 'db')); assert.ok(!Object.hasOwn(result, 'user'))
})

test('sesión ausente/fallida no consulta perfil y perfil ausente/ajeno/fallido no se vuelve gratuito', async () => {
  for (const options of [{ user: null }, { errorSesion: { code: 'ficticio' } }]) {
    const p = identity(options), result = await p.autorizarBibliotecaRecursos()
    assert.equal(result.error.status, 401); assert.deepEqual(p.calls, ['getUser'])
  }
  for (const options of [{ perfil: null }, { perfil: { ...SOCIA, id: 'ajena' } }, { errorPerfil: { code: 'no_permitido', message: 'detalle privado' } }]) {
    const result = await identity(options).autorizarBibliotecaRecursos()
    assert.equal(result.error.status, 503); assert.ok(!Object.hasOwn(result, 'perfil'))
    assert.ok(!JSON.stringify(result).includes('detalle privado'))
  }
})

test('admin usa su gestión; alumnas gratuitas, pendientes o suspendidas conservan la consulta de muestras', async () => {
  const admin = await identity({ perfil: { ...SOCIA, rol: 'admin' } }).autorizarBibliotecaRecursos()
  assert.equal(admin.error.status, 403)
  for (const perfil of [
    SOCIA, { ...SOCIA, tipo_usuario: 'desafio', desafio_socias_habilitada: true },
    { ...SOCIA, tipo_usuario: 'gratuito' }, { ...SOCIA, tipo_usuario: 'desafio' },
    { ...SOCIA, estado: 'pausada' }, { ...SOCIA, estado: 'cancelada' }, { ...SOCIA, estado: null },
  ]) {
    const result = await identity({ perfil, user: { id: 'propia', user_metadata: { rol: 'admin', tipo_usuario: 'socia' } } }).autorizarBibliotecaRecursos()
    assert.deepEqual(result, { perfil })
  }
})

test('excepción del proveedor conserva error cerrado y no filtra detalles privados', async () => {
  const { autorizarBibliotecaRecursos } = load('src/lib/resource-library-access.ts', { './supabase/server': { createClient: async () => { throw new Error('detalle privado ficticio') } } })
  const result = await autorizarBibliotecaRecursos()
  assert.equal(result.error.status, 503)
  assert.ok(!Object.hasOwn(result, 'perfil'))
  assert.ok(!JSON.stringify(result).includes('detalle privado'))
})

test('señales de cookies y prerender de Next no se convierten en errores de acceso', async () => {
  const control = new Error('señal interna ficticia')
  const { autorizarBibliotecaRecursos } = load('src/lib/resource-library-access.ts', {
    'next/navigation': { unstable_rethrow: error => { if (error === control) throw error } },
    './supabase/server': { createClient: async () => { throw control } },
  })
  await assert.rejects(autorizarBibliotecaRecursos(), error => error === control)
})

function apiFixture({ options = {}, pagina, fail = false } = {}) {
  const auth = identity(options), lecturas = []
  const api = load('src/app/api/classroom/recursos/route.ts', {
    'next/server': { NextResponse }, '@/lib/resource-library-access': auth,
    '@/lib/resource-library-server': { leerBibliotecaRecursos: async (...args) => {
      lecturas.push(args)
      if (fail) throw new Error('clave privada ficticia de proveedor')
      return pagina ?? { ...PAGINA, offset: args[1] }
    } },
  })
  const request = (query = '') => api.GET(new Request('https://app.example.test/api/classroom/recursos' + query))
  return { api, auth, lecturas, request }
}
function privateHeaders(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
}

test('GET pagina recursos solo para el perfil comprobado y no requiere progreso ni otra cuenta', async () => {
  const s = apiFixture(), response = await s.request('?offset=20&revision=' + REVISION)
  assert.equal(response.status, 200); privateHeaders(response)
  assert.deepEqual(await response.json(), { ...PAGINA, offset: 20 })
  assert.deepEqual(s.lecturas, [[SOCIA, 20, REVISION]])
  assert.equal(s.api.maxDuration, 120)
  const first = apiFixture(); assert.equal((await first.request()).status, 200)
  assert.deepEqual(first.lecturas, [[SOCIA, 0, undefined]])
})

test('GET rechaza sesión/admin/perfil no comprobado sin abrir el catálogo o los índices', async () => {
  for (const [options, expected] of [[{ user: null }, 401], [{ errorSesion: {} }, 401], [{ perfil: { ...SOCIA, rol: 'admin' } }, 403], [{ perfil: null }, 503], [{ errorPerfil: {} }, 503], [{ perfil: { ...SOCIA, id: 'ajena' } }, 503]]) {
    const s = apiFixture({ options }), response = await s.request()
    assert.equal(response.status, expected); privateHeaders(response)
    assert.equal((await response.json()).estado, 'error'); assert.equal(s.lecturas.length, 0)
  }
})

test('GET no acepta parámetros para elegir usuaria/permisos y valida offset/revisión sin lecturas', async () => {
  const invalidas = [
    '?usuaria_id=ajena', '?tipo_usuario=socia', '?clase=ajena', '?desconocido=1',
    '?offset=-1', '?offset=01', '?offset=1.5', '?offset=1e2', '?offset=Infinity', '?offset=1000000', '?offset=', '?offset=%201',
    '?offset=0&offset=20', '?revision=x', '?revision=', '?revision=' + 'a'.repeat(63), '?revision=' + 'a'.repeat(65),
    '?revision=' + 'A'.repeat(64), '?revision=' + 'g'.repeat(64), '?revision=' + REVISION + '&revision=' + REVISION,
  ]
  for (const query of invalidas) {
    const s = apiFixture(), response = await s.request(query)
    assert.equal(response.status, 400, query); privateHeaders(response)
    assert.equal((await response.json()).estado, 'error'); assert.equal(s.lecturas.length, 0)
  }
  for (const offset of [0, 1, 20, 999999]) {
    const s = apiFixture(); assert.equal((await s.request('?offset=' + offset)).status, 200)
    assert.equal(s.lecturas[0][1], offset)
  }
})

test('GET conserva parcial/actualizado y errores: no convierte un fallo en biblioteca vacía', async () => {
  for (const estado of ['listo', 'parcial', 'actualizado', 'error']) {
    const pagina = paginaEstado(estado), s = apiFixture({ pagina }), response = await s.request()
    assert.equal(response.status, estado === 'error' ? 503 : 200); privateHeaders(response)
    assert.deepEqual(await response.json(), pagina)
  }
  const failed = await apiFixture({ fail: true }).request(), data = await failed.json()
  assert.equal(failed.status, 503); privateHeaders(failed)
  assert.equal(data.estado, 'error'); assert.ok(!Object.hasOwn(data, 'recursos'))
  assert.ok(!JSON.stringify(data).includes('clave privada'))
})

const Frame = load('src/app/clases/materiales/ResourceLibraryFrame.tsx', { 'next/link': link, '@/components/ArrowIcon': { default: () => React.createElement('svg', { 'aria-hidden': true }) } })
function find(node, predicate) {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node
  for (const child of React.Children.toArray(node.props.children)) { const result = find(child, predicate); if (result) return result }
  return null
}
function pageFixture({ options = {}, pagina = PAGINA } = {}) {
  const auth = identity(options), lecturas = []
  const cliente = props => React.createElement('section', { 'data-recursos': true, 'data-estado': props.inicial.estado })
  const Page = load('src/app/clases/materiales/page.tsx', {
    'next/link': link, 'next/navigation': { redirect: destino => { throw new Error('redirect:' + destino) } },
    '@/lib/resource-library-access': auth,
    '@/lib/resource-library-server': { leerBibliotecaRecursos: async (...args) => { lecturas.push(args); return pagina } },
    '@/components/ResourceLibraryClient': { default: cliente }, './ResourceLibraryFrame': Frame,
  }).default
  return { Page, lecturas, auth, cliente }
}

test('página exige la misma identidad antes de renderizar y administra regreso de login/admin', async () => {
  for (const [options, destino] of [[{ user: null }, '/login?next=%2Fclases%2Fmateriales'], [{ perfil: { ...SOCIA, rol: 'admin' } }, '/admin/classroom']]) {
    const p = pageFixture({ options })
    await assert.rejects(p.Page, cause => cause.message === 'redirect:' + destino)
    assert.equal(p.lecturas.length, 0)
  }
})

test('página con perfil ausente/fallido muestra recuperación, no un vacío confirmado', async () => {
  for (const options of [{ perfil: null }, { errorPerfil: {} }, { perfil: { ...SOCIA, id: 'ajena' } }]) {
    const p = pageFixture({ options }), tree = await p.Page(), html = renderToStaticMarkup(tree)
    assert.match(html, /role="alert"/); assert.match(html, /No pudimos comprobar tu acceso/)
    assert.match(html, /href="\/clases\/materiales"[^>]*>Reintentar/)
    assert.ok(!html.includes('data-recursos')); assert.equal(p.lecturas.length, 0)
    assert.ok(!html.includes('0 materiales')); assert.ok(!html.includes('No hay materiales'))
  }
})

test('página difiere el lector en Suspense y pasa solo el DTO inicial al cliente', async () => {
  for (const perfil of [SOCIA, { ...SOCIA, tipo_usuario: 'desafio', desafio_socias_habilitada: true }, { ...SOCIA, tipo_usuario: 'gratuito' }, { ...SOCIA, tipo_usuario: 'desafio' }, { ...SOCIA, estado: 'pausada' }, { ...SOCIA, estado: 'cancelada' }]) {
    const p = pageFixture({ options: { perfil } }), tree = await p.Page()
    assert.equal(p.lecturas.length, 0)
    const suspense = find(tree, node => node.type === React.Suspense)
    assert.ok(suspense); assert.equal(suspense.props.fallback.type, Frame.ResourceLibraryLoading)
    const child = suspense.props.children
    assert.deepEqual(Object.keys(child.props), ['perfil']); assert.equal(child.props.perfil, perfil)
    const result = await child.type(child.props)
    assert.deepEqual(p.lecturas, [[perfil]])
    assert.equal(result.type, p.cliente); assert.deepEqual(Object.keys(result.props), ['inicial']); assert.equal(result.props.inicial, PAGINA)
  }
})

test('página conserva el estado parcial/error del lector y no cuenta completadas al reunir materiales', async () => {
  for (const estado of ['listo', 'parcial', 'error']) {
    const pagina = paginaEstado(estado), p = pageFixture({ pagina }), tree = await p.Page()
    const child = find(tree, node => node.type === React.Suspense).props.children
    const result = await child.type(child.props)
    assert.equal(result.props.inicial, pagina); assert.equal(result.props.inicial.estado, estado)
    assert.ok(!Object.hasOwn(result.props, 'supabase')); assert.ok(!Object.hasOwn(result.props, 'progreso'))
  }
})

test('marco y carga reutilizan navegación de clases, controles táctiles y superficies sólidas sin cifras ficticias', () => {
  const Loading = load('src/app/clases/materiales/loading.tsx', { './ResourceLibraryFrame': Frame }).default
  const html = renderToStaticMarkup(React.createElement(Loading))
  assert.match(html, /Materiales de tus clases/); assert.match(html, /aria-label="Contenido del programa"/)
  assert.match(html, /href="\/classroom"/); assert.match(html, /href="\/clases\/materiales" aria-current="page"/)
  assert.match(html, /role="status"/); assert.match(html, /aria-live="polite"/)
  for (const clase of ['min-h-11', 'border-[#E7DDD5]', 'bg-[#FFFDFA]', 'pb-28']) assert.ok(html.includes(clase))
  for (const falso of ['0 materiales', '0 clases', 'completadas', 'iframe', 'video_key', 'r2.cloudflarestorage.com', 'backdrop-blur']) assert.ok(!html.includes(falso))
  const appearance = read('src/components/PlatformAppearance.tsx'), nav = read('src/components/MobileNavigation.tsx')
  assert.ok(appearance.includes("'/clases'")); assert.ok(nav.includes("rutas: ['/clases', '/classroom']"))
})

test('ruta elegida mantiene muestras bajo proxy sin abrir subrutas privadas de classroom', async () => {
  const classAccess = load('src/lib/class-access.ts')
  for (const perfil of [{ ...SOCIA, tipo_usuario: 'gratuito' }, { ...SOCIA, tipo_usuario: 'desafio' }, { ...SOCIA, estado: 'pausada' }, { ...SOCIA, estado: 'cancelada' }]) {
    const db = { auth: { getClaims: async () => ({ data: { claims: { sub: 'propia' } } }) }, from: table => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'perfiles' ? perfil : { completado_at: '2026-10-23T12:00:00Z' }, error: null }) }) }) }) }
    const response = status => ({ status, headers: new Headers(), cookies: { getAll: () => [], set() {} } })
    const proxy = load('src/proxy.ts', {
      '@supabase/ssr': { createServerClient: () => db },
      'next/server': { NextResponse: { next: () => response(200), redirect: url => ({ ...response(307), destino: url.pathname }) } },
      '@/lib/access': { obtenerRutaInicio: () => '/inicio' }, '@/lib/perfil-preguntas': { necesitaBienvenida: () => false }, '@/lib/class-access': classAccess,
    }).proxy
    const request = pathname => ({ url: 'https://app.example.test' + pathname, nextUrl: new URL('https://app.example.test' + pathname), cookies: { getAll: () => [], set() {} } })
    assert.equal((await proxy(request('/clases/materiales'))).status, 200)
    assert.equal((await proxy(request('/classroom/privada'))).destino, '/inicio')
  }
})

test('rutas nuevas son solo lectura y autorización no usa metadata, privilegios o caché compartida', () => {
  for (const file of ['src/lib/resource-library-access.ts', 'src/app/api/classroom/recursos/route.ts', 'src/app/clases/materiales/page.tsx']) {
    const source = read(file)
    for (const mutation of ['.insert(', '.update(', '.upsert(', '.delete(', 'createAdminClient', 'SERVICE_ROLE', 'user_metadata', 'getSession(', 'unstable_cache', "'use cache'"]) assert.ok(!source.includes(mutation), file + ': ' + mutation)
  }
  assert.ok(read('src/lib/resource-library-access.ts').startsWith("import 'server-only'"))
  assert.ok(!read('src/app/api/classroom/recursos/route.ts').includes('pedirR2'))
  assert.ok(!read('src/app/clases/materiales/page.tsx').includes('leerProgresoClases'))
})
