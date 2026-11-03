/* eslint-disable @typescript-eslint/no-require-imports */
// Integración SSR con servicios simulados: no sustituye una prueba en navegador,
// registro real, RLS, entrega de correo, pago ni reproducción de video.
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
  new Function('require', 'module', 'exports', code)(n => n in deps ? deps[n] : require(n), m, m.exports)
  return m.exports
}
const access = load('src/lib/access.ts')
const classes = load('src/lib/class-access.ts')
const community = load('src/lib/community.ts')
const home = load('src/lib/home-access.ts', { './access': access, './class-access': classes })
const link = { default: ({ prefetch, ...props }) => { void prefetch; return React.createElement('a', props) } }
const icon = { default: () => React.createElement('span', { 'aria-hidden': true }) }
const LockedModules = load('src/components/LockedModules.tsx', { 'next/link': link, './NavigationIcon': icon, './ArrowIcon': icon, '@/lib/modules': load('src/lib/modules.ts') }).default
const socia = { id: 'propia', nombre: 'Socia', rol: 'alumna', tipo_usuario: 'socia', estado: 'activa', desafio_socias_habilitada: false, desafio_socias_estado: 'pendiente' }
test('acceso de Inicio coincide con el permiso privado y distingue Socias de Desafío', () => {
  const casos = [
    [socia, true, true, false, false, 'Socias Digitales'],
    [{ ...socia, rol: 'afiliada', tipo_usuario: null }, false, false, false, false, 'Socias Digitales'],
    [{ ...socia, rol: 'afiliada_lanzamiento', tipo_usuario: null }, false, false, false, false, 'Socias Digitales'],
    [{ ...socia, rol: 'afiliada', tipo_usuario: 'gratuito' }, false, false, false, true, 'Acceso gratuito'],
    [{ ...socia, rol: 'afiliada_lanzamiento', tipo_usuario: 'desafio' }, false, false, false, false, 'Desafío Socias'],
    [{ ...socia, estado: 'pausada' }, false, false, true, false, 'Socias Digitales'],
    [{ ...socia, estado: 'cancelada', desafio_socias_habilitada: true }, false, false, true, false, 'Socias Digitales'],
    [{ ...socia, estado: undefined }, false, false, false, false, 'Socias Digitales'],
    [{ ...socia, tipo_usuario: 'gratuito' }, false, false, false, true, 'Acceso gratuito'],
    [{ ...socia, tipo_usuario: 'desafio' }, false, false, false, false, 'Desafío Socias'],
    [{ ...socia, tipo_usuario: 'desafio', desafio_socias_habilitada: true }, true, false, false, false, 'Desafío Socias'],
    [{ ...socia, tipo_usuario: 'desafio', desafio_socias_habilitada: true, estado: 'pausada' }, false, false, true, false, 'Desafío Socias'],
  ]
  for (const [perfil, formacion, sociaActiva, suspendido, gratuito, etiqueta] of casos) {
    const result = home.accesoInicio(perfil)
    assert.deepEqual({ formacion: result.formacion, sociaActiva: result.sociaActiva, suspendido: result.suspendido, gratuito: result.gratuito, etiqueta: result.etiqueta }, { formacion, sociaActiva, suspendido, gratuito, etiqueta })
    assert.equal(result.formacion, classes.puedeVerClasesPrivadas(perfil))
  }
  assert.equal(home.accesoInicio({ rol: 'admin', estado: 'activa' }).formacion, false)
  assert.equal(home.accesoInicio(null).formacion, false)
})
function pagina({ perfil = socia, errorPerfil = null, user = { id: 'propia' }, estrategia = false, afiliadas = { habilitada: false, error: false } } = {}) {
  const calls = [], seleccion = []
  const db = { auth: { getUser: async () => ({ data: { user } }) }, from: table => {
    calls.push('tabla:' + table)
    return { select: columns => {
      seleccion.push({ table, columns })
      return { eq: (campo, id) => ({ maybeSingle: async () => {
        assert.equal(campo, table === 'perfiles' ? 'id' : 'usuaria_id'); assert.equal(id, 'propia')
        return table === 'perfiles' ? { data: perfil, error: errorPerfil } : { data: { habilitada: estrategia }, error: null }
      } }) }
    } }
  } }
  const wrapper = ({ children }) => React.createElement(React.Fragment, null, children)
  const notices = { UnreadNoticesProvider: wrapper, UnreadNoticeLink: ({ variante, activo }) => React.createElement('a', { href: '/notificaciones', 'data-variante': variante, 'aria-current': activo ? 'page' : undefined }, variante === 'menu' ? 'Notificaciones' : 'Avisos') }
  const navigation = load('src/lib/student-navigation.ts')
  const Sidebar = load('src/components/StudentSidebar.tsx', {
    'next/link': link, 'next/navigation': { usePathname: () => '/inicio' },
    './NavigationIcon': icon, './UnreadNotices': notices,
    '@/app/inicio/ProximaClase': { default: ({ variante }) => React.createElement('div', { 'data-proximo-hito': variante }) },
    '@/lib/student-navigation': navigation,
  }).default
  const Frame = load('src/components/StudentShellFrame.tsx', {
    'next/link': link, 'next/navigation': { usePathname: () => '/inicio' },
    '@/app/inicio/AgendaProvider': { AgendaProvider: wrapper },
    './UnreadNotices': notices, './StudentSidebar': { default: Sidebar },
  }).default
  const permiso = nombre => async (_db, id) => { assert.equal(id, 'propia'); calls.push(nombre); return { permitido: false } }
  const page = load('src/app/inicio/page.tsx', {
    'next/link': link,
    'next/navigation': { redirect: destino => { throw new Error('redirect:' + destino) } },
    '@/lib/supabase/server': { createClient: async () => db },
    './ProximaClase': { default: ({ variante }) => React.createElement('div', { 'data-proximo-hito': variante }) },
    '@/components/ArrowIcon': icon, '@/components/NavigationIcon': icon,
    '@/components/StudentShellFrame': { default: Frame },
    '@/components/LockedModules': { default: LockedModules },
    '@/components/FreeStart': { default: ({ clases }) => React.createElement('section', { 'data-inicio-gratuito': true, 'data-clases': clases.length }, 'Clases gratuitas') },
    '@/lib/class-catalog': { leerCatalogoClases: async p => { calls.push('catalogo'); assert.equal(p, perfil); return [{ id: 'muestra', acceso_gratuito: true, puede_ver: true }] } },
    '@/lib/unread-notices': { leerAvisosSinLeer: async () => { calls.push('avisos'); return { cantidad: 0 } } },
    '@/components/UnreadNotices': notices,
    '@/lib/results-server': { permisoResultados: permiso('permiso-resultados') },
    '@/lib/metrics-server': { permisoMetricas: permiso('permiso-metricas') },
    '@/lib/my-day-server': { permisoMiDia: permiso('permiso-dia') },
    '@/lib/affiliate-access-server': { leerAccesoAfiliadas: async (client, id, p) => { assert.equal(client, db); assert.equal(id, 'propia'); assert.equal(p, perfil); calls.push('permiso-afiliadas'); return afiliadas } },
    '@/lib/achievements': { puedeVerLogros: p => p?.estado === 'activa' && (p.tipo_usuario === 'socia' || ['afiliada', 'afiliada_lanzamiento'].includes(p.rol)) },
    './AgendaProvider': { AgendaProvider: wrapper },
    '@/lib/agenda-store': { leerAgenda: async () => { calls.push('agenda'); return { hito: null } } },
    '@/lib/agenda-management': { hitoParaAlumna: () => [] },
    '@/lib/home-access': home,
    '@/lib/community': community,
    './PersonalCalendar': { default: ({ supabase, usuariaId, perfil: protegido }) => {
      assert.equal(supabase, db); assert.equal(usuariaId, 'propia'); assert.equal(protegido, perfil)
      return React.createElement('section', { 'data-calendario-personal': true }, 'Tu agenda')
    } },
    '@/components/HomeCalendar': { HomeCalendarLoading: () => React.createElement('p', { role: 'status' }, 'Reuniendo tu agenda…') },
    '@/lib/metrics': { fechaArgentina: () => '2026-10-23' },
    // La frontera async y los lectores reales se prueban por separado. Este
    // sustituto síncrono verifica solo que Inicio habilita el bloque correcto
    // y le entrega la sesión/perfil protegidos, sin ejecutar el hijo async.
    './CampusFormation': { default: ({ supabase, usuariaId, perfil: protegido }) => {
      assert.equal(supabase, db); assert.equal(usuariaId, 'propia'); assert.equal(protegido, perfil)
      calls.push('campus')
      return React.createElement('section', { 'data-campus': true, 'data-acceso': protegido.tipo_usuario }, React.createElement('h2', null, 'Mi formación'), React.createElement('a', { href: '/classroom' }, 'Abrir mi biblioteca'))
    } },
    '@/components/HomeCampus': { HomeCampusLoading: () => React.createElement('p', { 'data-campus-cargando': true, role: 'status' }, 'Reuniendo tu formación…') },
  }).default
  return { page, calls, seleccion }
}
test('SSR Inicio: Socia activa sin flag Desafío recibe campus sin habilitar otros módulos pendientes', async () => {
  const p = pagina(), html = renderToStaticMarkup(await p.page())
  assert.match(html, /data-campus="true" data-acceso="socia"/)
  assert.match(html, /Mi formación/); assert.match(html, /href="\/classroom"/)
  assert.ok(!html.includes('Acceso gratuito')); assert.ok(!html.includes('Tu cuenta está lista.'))
  for (const nombre of ['Productos', 'Mis objetivos', 'Ranking']) assert.ok(html.includes(`aria-label="${nombre}: bloqueado"`))
  assert.ok(html.includes('aria-label="Comunidad: habilitado"'))
  assert.ok(html.includes('Entrar a la comunidad'))
  assert.ok(html.includes('aria-label="Mis resultados: bloqueado"'))
  assert.ok(html.includes('aria-label="Mis métricas: bloqueado"'))
  assert.ok(html.includes('aria-label="Mi día: bloqueado"'))
  assert.ok(html.includes('Pendiente de habilitación'))
  assert.ok(p.calls.includes('agenda')); assert.ok(!p.calls.includes('catalogo'))
  assert.equal(p.calls.filter(call => call === 'campus').length, 1)
  assert.match(p.seleccion.find(s => s.table === 'perfiles').columns, /\bestado\b/)
})
test('SSR Inicio: Afiliadas se agrega al acceso Socia y conserva campus, calendario y navegación formativa', async () => {
  const p = pagina({ afiliadas: { habilitada: true, error: false } })
  const html = renderToStaticMarkup(await p.page())
  const menu = html.match(/<nav[^>]*aria-label="Navegación principal"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
  assert.match(html, /data-campus="true" data-acceso="socia"/)
  assert.match(html, /data-calendario-personal="true"/)
  assert.match(html, /aria-label="Tu espacio de Afiliadas"/)
  assert.match(html, /Entrar a Afiliadas/)
  assert.match(menu, /href="\/afiliadas"/)
  assert.match(menu, /href="\/clases"/)
  assert.match(menu, /href="\/lanzamiento"/)
  assert.match(menu, /href="\/comunidad"/)
  assert.ok(p.calls.includes('agenda')); assert.ok(p.calls.includes('permiso-afiliadas'))
  assert.equal(p.calls.filter(call => call === 'campus').length, 1)
  assert.ok(!html.includes('data-inicio-gratuito')); assert.ok(!html.includes('Quiero ser Socia'))
})
test('SSR Inicio: Afiliada gratuita explícita tiene menú y hub sin ofrecer formación privada ni una compra falsa', async () => {
  const p = pagina({ perfil: { ...socia, tipo_usuario: 'gratuito' }, afiliadas: { habilitada: true, error: false } })
  const html = renderToStaticMarkup(await p.page())
  const menu = html.match(/<nav[^>]*aria-label="Navegación principal"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
  assert.match(html, /aria-label="Tu espacio de Afiliadas"/)
  assert.match(html, /Entrar a Afiliadas/)
  assert.match(html, /aria-haspopup="dialog"/)
  for (const route of ['/inicio', '/afiliadas', '/perfil', '/notificaciones']) assert.ok(menu?.includes(`href="${route}"`), route)
  for (const route of ['/clases', '/classroom', '/lanzamiento', '/comunidad', '/checklist', '/metricas', '/resultados', '/logros']) assert.ok(!menu?.includes(`href="${route}"`), route)
  for (const bloque of ['data-campus', 'data-calendario-personal', 'data-proximo-hito="banner"', 'data-inicio-gratuito', 'Quiero ser Socia', 'Herramientas de Socias', 'Otros espacios', 'Tu acceso está en revisión']) assert.ok(!html.includes(bloque), bloque)
  assert.ok(!p.calls.includes('campus')); assert.ok(!p.calls.includes('agenda'))
  assert.ok(p.calls.includes('avisos')); assert.ok(p.calls.includes('permiso-afiliadas'))
})
test('SSR Inicio: un fallo al comprobar Afiliadas no borra el acceso Socia ni muestra el hub como habilitado', async () => {
  const p = pagina({ afiliadas: { habilitada: false, error: true } })
  const html = renderToStaticMarkup(await p.page())
  const menu = html.match(/<nav[^>]*aria-label="Navegación principal"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
  assert.match(html, /No pudimos comprobar el acceso a Afiliadas/)
  assert.match(html, /role="alert"/)
  assert.match(html, /data-campus="true" data-acceso="socia"/)
  assert.match(html, /data-calendario-personal="true"/)
  assert.match(menu, /href="\/clases"/)
  assert.match(menu, /href="\/notificaciones"/)
  assert.ok(!menu.includes('href="/afiliadas"'))
  assert.ok(!html.includes('aria-label="Tu espacio de Afiliadas"'))
  assert.ok(!html.includes('data-inicio-gratuito')); assert.ok(!html.includes('Quiero ser Socia'))
  assert.ok(p.calls.includes('campus')); assert.ok(p.calls.includes('agenda')); assert.ok(p.calls.includes('avisos'))
})
test('SSR Inicio: Desafío habilitado recibe el mismo campus con su propio acceso, sin pasar por el alta gratuita', async () => {
  const perfil = { ...socia, tipo_usuario: 'desafio', desafio_socias_habilitada: true, desafio_socias_estado: 'habilitada' }
  const p = pagina({ perfil }), html = renderToStaticMarkup(await p.page())
  assert.match(html, /Desafío Socias/); assert.match(html, /data-campus="true" data-acceso="desafio"/)
  assert.match(html, /href="\/classroom"/)
  assert.ok(!html.includes('data-inicio-gratuito')); assert.ok(!html.includes('Tu acceso está en revisión'))
  assert.ok(html.includes('aria-label="Comunidad: bloqueado"'))
  assert.equal(p.calls.filter(call => call === 'campus').length, 1)
  assert.ok(p.calls.includes('agenda')); assert.ok(!p.calls.includes('catalogo'))
})
test('SSR Inicio: lateral de formación fijo en escritorio, desplazable y accesible sin fijar el contenido principal', async () => {
  for (const perfil of [socia, { ...socia, tipo_usuario: 'desafio', desafio_socias_habilitada: true }]) {
    const html = renderToStaticMarkup(await pagina({ perfil }).page())
    const header = html.match(/<header[^>]*>/)?.[0]
    const aside = html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/)?.[1]
    assert.ok(header?.includes('lg:sticky lg:top-0 lg:z-40'))
    assert.ok(header?.includes('lg:bg-[#FAF7F3]'))
    const headerClasses = header?.match(/class="([^"]*)"/)?.[1].split(/\s+/) ?? []
    for (const value of ['sticky', 'top-0', 'z-40']) assert.ok(headerClasses.includes(value))
    assert.match(aside, /role="region" aria-label="Menú y próximo encuentro" tabindex="0"/)
    for (const value of ['lg:sticky', 'lg:top-[104px]', 'lg:max-h-[calc(100dvh-132px)]', 'lg:overflow-y-auto', 'focus-visible:outline-2']) assert.ok(aside.includes(value))
    assert.ok(aside.includes('Navegación principal'))
    assert.ok(aside.includes('data-proximo-hito="contador"'))
    assert.ok(!html.match(/<main[^>]*>/)?.[0].includes('sticky'))
    assert.equal((html.match(/data-proximo-hito="banner"/g) || []).length, 1)
  }
})
test('SSR Inicio: lateral fijo no aparece en accesos sin formación ni cambia su encabezado', async () => {
  for (const perfil of [{ ...socia, tipo_usuario: 'gratuito' }, { ...socia, estado: 'pausada' }, { ...socia, tipo_usuario: 'desafio', desafio_socias_habilitada: false }]) {
    const html = renderToStaticMarkup(await pagina({ perfil }).page())
    assert.ok(!html.includes('Menú y próximo encuentro'))
    assert.ok(!html.match(/<header[^>]*>/)?.[0].includes('sticky'))
    assert.ok(!html.includes('<aside'))
  }
})
test('SSR Inicio: pausar/cancelar conserva perfil y avisos, sin CTA formativo ni consulta de agenda privada', async () => {
  for (const tipo_usuario of ['socia', 'desafio']) for (const estado of ['pausada', 'cancelada']) {
    const p = pagina({ perfil: { ...socia, tipo_usuario, estado, desafio_socias_habilitada: true }, estrategia: true })
    const html = renderToStaticMarkup(await p.page())
    assert.match(html, /Tu acceso al contenido pago está pausado/)
    assert.match(html, /href="\/perfil"/); assert.match(html, /href="\/notificaciones"/)
    assert.ok(!html.includes('data-campus')); assert.ok(!html.includes('Abrir mi biblioteca'))
    assert.ok(!html.includes('Ver mi estrategia')); assert.ok(!html.includes('data-proximo-hito'))
    assert.ok(!p.calls.includes('agenda')); assert.ok(!p.calls.includes('catalogo')); assert.ok(!p.calls.includes('campus'))
  }
})
test('SSR Inicio: gratuita sigue con muestras y no se vuelve Socia por metadata editable', async () => {
  for (const rol of ['alumna', 'afiliada', 'afiliada_lanzamiento']) {
    const p = pagina({ perfil: { ...socia, rol, tipo_usuario: 'gratuito' }, user: { id: 'propia', user_metadata: { rol: 'admin', tipo_usuario: 'socia', estado: 'activa' } } })
    const html = renderToStaticMarkup(await p.page())
    assert.match(html, /Acceso gratuito/); assert.match(html, /data-inicio-gratuito="true"/)
    assert.ok(p.calls.includes('catalogo')); assert.ok(!p.calls.includes('agenda'))
    assert.ok(!html.includes('data-campus')); assert.ok(!p.calls.includes('campus'))
    assert.ok(html.includes('Quiero ser Socia')); assert.ok(html.includes('disabled=""'))
    assert.ok(!html.includes('href="/afiliadas"')); assert.ok(!html.includes('Entrar a Afiliadas'))
  }
})
test('SSR Inicio: Desafío pendiente no hereda formación por un rol antiguo de afiliada', async () => {
  for (const rol of ['alumna', 'afiliada', 'afiliada_lanzamiento']) {
    const p = pagina({ perfil: { ...socia, rol, tipo_usuario: 'desafio', desafio_socias_habilitada: false } })
    const html = renderToStaticMarkup(await p.page())
    assert.match(html, /Tu acceso está en revisión/)
    assert.ok(!html.includes('data-campus')); assert.ok(!html.includes('data-inicio-gratuito'))
    assert.ok(!p.calls.includes('agenda')); assert.ok(!p.calls.includes('catalogo')); assert.ok(!p.calls.includes('campus'))
  }
})
test('SSR Inicio: Desafío rechazado o bloqueado y Socia sin estado comprobado no reciben campus', async () => {
  for (const estado of ['rechazada', 'bloqueada']) {
    const p = pagina({ perfil: { ...socia, tipo_usuario: 'desafio', desafio_socias_habilitada: false, desafio_socias_estado: estado } })
    const html = renderToStaticMarkup(await p.page())
    assert.match(html, /Tu acceso no está habilitado/); assert.ok(!html.includes('data-campus'))
    assert.ok(!p.calls.includes('campus')); assert.ok(!p.calls.includes('agenda')); assert.ok(!p.calls.includes('catalogo'))
  }
  const p = pagina({ perfil: { ...socia, estado: undefined } }), html = renderToStaticMarkup(await p.page())
  assert.ok(!html.includes('data-campus')); assert.ok(!p.calls.includes('campus')); assert.ok(!p.calls.includes('agenda'))
})
test('SSR Inicio: rol antiguo sin tipo de acceso no habilita el campus privado por su etiqueta histórica', async () => {
  for (const rol of ['afiliada', 'afiliada_lanzamiento']) {
    const p = pagina({ perfil: { ...socia, rol, tipo_usuario: null } }), html = renderToStaticMarkup(await p.page())
    assert.ok(!html.includes('data-campus')); assert.ok(!p.calls.includes('campus')); assert.ok(!p.calls.includes('agenda')); assert.ok(!p.calls.includes('catalogo'))
    assert.ok(!html.includes('href="/afiliadas"')); assert.ok(!html.includes('aria-label="Tu espacio de Afiliadas"'))
  }
})
test('SSR Inicio: perfil ausente o fallido muestra recuperación, no un alta gratuita ni módulos falsamente disponibles', async () => {
  for (const options of [{ perfil: null }, { errorPerfil: { code: 'simulado' } }]) {
    const p = pagina(options), html = renderToStaticMarkup(await p.page())
    assert.match(html, /No pudimos comprobar tu acceso/); assert.match(html, /role="alert"/)
    assert.match(html, /Reintentar/); assert.match(html, /href="\/inicio"/)
    assert.deepEqual(p.calls, ['tabla:perfiles'])
    assert.ok(!html.includes('data-inicio-gratuito')); assert.ok(!html.includes('data-campus'))
  }
})
test('SSR Inicio: sesión ausente pide login y admin regresa a su panel sin leer contenido de alumna', async () => {
  for (const [options, destino, calls] of [[{ user: null }, '/login', []], [{ perfil: { ...socia, rol: 'admin' } }, '/admin', ['tabla:perfiles']]]) {
    const p = pagina(options)
    await assert.rejects(() => p.page(), new RegExp('redirect:' + destino))
    assert.deepEqual(p.calls, calls)
  }
})
