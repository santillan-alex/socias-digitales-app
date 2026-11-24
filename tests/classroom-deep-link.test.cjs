/* eslint-disable @typescript-eslint/no-require-imports */
// Catálogo, red y efectos aislados con datos ficticios; no navegador, sesiones ni escrituras reales.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in deps ? deps[name] : name === '@/lib/farmasi-registration' ? load('src/lib/farmasi-registration.ts') : require(name), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const progress = load('src/lib/class-progress.ts')
const access = load('src/lib/class-access.ts')
const filters = load('src/lib/class-library-filters.ts', { './class-management': management })
const ID = 'a1111111-1111-4111-8111-111111111111'
const NEXT = '22222222-2222-4222-8222-222222222222'
const SAMPLE = '33333333-3333-4333-8333-333333333333'
const HIDDEN = '44444444-4444-4444-8444-444444444444'
const UNKNOWN = '55555555-5555-4555-8555-555555555555'
const EMPTY = '66666666-6666-4666-8666-666666666666'
const base = { id: ID, titulo: 'Clase ficticia', descripcion: null, modulo: 'Desafío Socias', orden: 0, activo: true, puede_ver: true, acceso_gratuito: false, tiene_video_privado: true, vimeo_url: null, plan: '27' }
const catalogo = [base, { ...base, id: NEXT, titulo: 'Siguiente clase', orden: 1 }, { ...base, id: SAMPLE, titulo: 'Muestra', modulo: 'Bienvenida', acceso_gratuito: true }, { ...base, id: HIDDEN, activo: false }, { ...base, id: EMPTY, tiene_video_privado: false }]
const perfil = { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa' }
const avance = { clase_id: ID, posicion_seg: 87, duracion_seg: 200, completada: false, actualizado_en: '2026-10-23T12:00:00Z' }
function servidor({ user = { id: 'cuenta-ficticia' }, profile = perfil, falloPerfil = false, leerGrupos = async () => [] } = {}) {
  const calls = { auth: 0, tablas: [], catalogo: 0, progreso: 0 }
  const Recovery = () => null
  const Classroom = () => null
  const page = load('src/app/classroom/page.tsx', {
      '@/lib/socias-offer-store': { leerOfertaSocias: async () => ({ oferta: { precioTexto: null, accionUrl: null } }) },
      '@/lib/class-access': access,
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => { calls.auth++; return { data: { user } } } }, from: table => { calls.tablas.push(table); return { select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: falloPerfil ? {} : null }) }) }) } } }) },
    'next/navigation': { redirect: href => { throw new Error('redirect:' + href) } },
    './ClassroomCliente': { default: Classroom }, './ClassroomRecovery': { default: Recovery },
    '@/lib/class-management': management,
    '@/lib/farmasi-class-groups-server': { leerGruposFarmasi: leerGrupos },
    '@/lib/class-catalog': { leerCatalogoClases: async p => { calls.catalogo++; return catalogo.map(clase => ({ ...clase, puede_ver: access.puedeVerClase(p, clase) })) } },
    '@/lib/class-progress-server': { leerProgresoClases: async () => { calls.progreso++; return [avance] } },
  }).default
  return { page, calls, Recovery, Classroom }
}
test('page espera searchParams, selecciona del mismo catálogo autorizado y conserva progreso sin consultas por ID', async () => {
  const view = servidor()
  const result = await view.page({ searchParams: Promise.resolve({ clase: ID.toUpperCase() }) })
  assert.equal(result.type, view.Classroom)
  assert.equal(result.props.claseInicialId, ID)
  assert.equal(result.props.avisoClaseInicial, null)
  assert.deepEqual(result.props.progresoInicial, [avance])
  assert.deepEqual(view.calls, { auth: 1, tablas: ['perfiles'], catalogo: 1, progreso: 1 })
})
test('ID inválido, repetido, oculto, desconocido o sin video no selecciona ni revela el motivo, sin consultas extra', async () => {
  for (const clase of ['', 'no-es-uuid', '../admin', ID + '?admin=true', [ID, NEXT], HIDDEN, UNKNOWN, EMPTY]) {
    const view = servidor()
    const result = await view.page({ searchParams: Promise.resolve({ clase }) })
    assert.equal(result.props.claseInicialId, null)
    assert.match(result.props.avisoClaseInicial, /no está disponible para tu cuenta/)
    if (String(clase)) assert.ok(!result.props.avisoClaseInicial.includes(String(clase)))
    assert.equal(result.props.clases.length, catalogo.length)
    assert.deepEqual(view.calls.tablas, ['perfiles'])
    assert.equal(view.calls.catalogo, 1)
  }
})
test('gratuita o Socia pausada no recibe selección privada; muestra sigue permitida y admin no registra progreso', async () => {
  for (const profile of [{ rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa' }, { ...perfil, estado: 'pausada' }, { ...perfil, estado: 'cancelada' }]) {
    const view = servidor({ profile })
    const denied = await view.page({ searchParams: Promise.resolve({ clase: ID }) })
    assert.equal(denied.props.claseInicialId, null)
    const sample = await view.page({ searchParams: Promise.resolve({ clase: SAMPLE }) })
    assert.equal(sample.props.claseInicialId, SAMPLE)
  }
  const admin = servidor({ profile: { rol: 'admin' } })
  const result = await admin.page({ searchParams: Promise.resolve({ clase: ID }) })
  assert.equal(result.props.claseInicialId, ID)
  assert.equal(result.props.esAdmin, true)
  assert.equal(admin.calls.progreso, 0)
})
test('sin sesión/perfil no se consulta catálogo; sin parámetro se conserva biblioteca y no se inventan filtros URL', async () => {
  const anonimo = servidor({ user: null })
  await assert.rejects(() => anonimo.page({ searchParams: Promise.resolve({ clase: ID }) }), /redirect:\/login/)
  assert.deepEqual(anonimo.calls, { auth: 1, tablas: [], catalogo: 0, progreso: 0 })
  const error = servidor({ falloPerfil: true })
  assert.equal((await error.page({ searchParams: Promise.resolve({ clase: ID }) })).type, error.Recovery)
  assert.equal(error.calls.catalogo, 0)
  const view = servidor()
  for (const props of [undefined, { searchParams: Promise.resolve({ programa: 'No existe', buscar: 'Clase' }) }]) {
    const result = await view.page(props)
    assert.equal(result.props.claseInicialId, null)
    assert.equal(result.props.avisoClaseInicial, null)
    assert.deepEqual(result.props.clases.map(clase => clase.id), catalogo.map(clase => clase.id))
  }
})
function all(tree, predicate) { if (!tree || typeof tree !== 'object') return []; return [...(predicate(tree) ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap(child => all(child, predicate))] }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); return !tree || typeof tree !== 'object' ? '' : [tree.props?.children].flat(Infinity).map(text).join('') }
function cliente(props = {}) {
  const cells = [], effects = new Set()
  let cursor = 0
  let currentProps = props
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }] },
    useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] },
    useCallback(callback, deps) { const index = cursor++, previous = cells[index]; if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) cells[index] = { callback, deps }; return cells[index].callback },
    useEffect(effect, deps) { const index = cursor++, previous = cells[index]; if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) { cells[index] = { effect, deps, cleanup: previous?.cleanup }; effects.add(index) } },
  }
  const Player = () => null
  const Program = () => null
  const Component = load('src/app/classroom/ClassroomCliente.tsx', { react: hooks, '@/components/SociasUpgradePanel': { default: () => null }, './ClassPlayer': { default: Player }, './ClassroomProgram': { default: Program }, '@/lib/class-management': management, '@/lib/class-progress': progress, '@/lib/class-access': access, '@/lib/class-library-filters': filters }).default
  const render = () => { cursor = 0; return Component({ clases: catalogo.filter(clase => clase.activo), esAdmin: false, perfil, progresoInicial: [avance], ...currentProps }) }
  const flush = () => { for (const index of effects) { const cell = cells[index]; cell.cleanup?.(); cell.cleanup = cell.effect() } effects.clear() }
  const replay = () => { const registered = cells.filter(cell => cell?.effect); for (const cell of registered) cell.cleanup?.(); for (const cell of registered) cell.cleanup = cell.effect() }
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); flush() }
  return {
    render, flush, replay, settle,
    setProps: next => { currentProps = { ...currentProps, ...next } },
    player: () => all(render(), node => node.type === Player)[0],
    programs: () => all(render(), node => node.type === Program),
    button: label => all(render(), node => node.type === 'button').find(node => text(node).startsWith(label)),
    html: () => renderToStaticMarkup(render()),
    unmount: () => { for (const cell of cells) if (cell?.effect) cell.cleanup?.() },
  }
}
function red(impl = async () => ({ ok: true, json: async () => ({ url: '/fixture-video-privado.mp4' }) })) {
  const requests = [], original = global.fetch
  global.fetch = async (url, options) => { requests.push({ url, options }); return impl(url, options) }
  return { requests, restore: () => { global.fetch = original } }
}
test('enlace privado abre una vez tras efectos, sin autoplay, con minuto propio y Siguiente del catálogo completo', async () => {
  const network = red()
  try {
    const view = cliente({ claseInicialId: ID })
    view.render(); assert.equal(network.requests.length, 0)
    view.flush(); view.replay(); await view.settle()
    assert.equal(network.requests.length, 1)
    assert.equal(network.requests[0].url, `/api/classroom/${ID}/video`)
    assert.equal(network.requests[0].options.cache, 'no-store')
    assert.equal(view.player().props.clase.id, ID)
    assert.equal(view.player().props.progreso.posicion_seg, 87)
    assert.equal(view.player().props.siguiente, 'Siguiente clase')
    assert.equal(view.player().props.autoPlay, undefined)
    view.button('Completadas').props.onClick(); view.render(); view.flush(); await view.settle()
    view.player().props.onProgreso({ ...avance, posicion_seg: 88 }); view.render(); view.flush(); await view.settle()
    assert.equal(network.requests.length, 1)
    view.player().props.onCerrar(); view.render(); view.flush(); await view.settle()
    assert.equal(view.player(), undefined)
    assert.equal(network.requests.length, 1)
    assert.ok(!/autoPlay|autoplay=1|\.play\(/.test(read('src/app/classroom/ClassPlayer.tsx')))
  } finally { network.restore() }
})
test('el cliente vuelve a validar UUID, publicación, permiso explícito y video: no hace petición por un enlace rechazado', async () => {
  const network = red()
  try {
    for (const [id, cambios] of [['no-es-uuid', {}], [UNKNOWN, {}], [HIDDEN, { clases: catalogo }], [ID, { clases: [{ ...base, puede_ver: false }] }], [ID, { clases: [{ ...base, puede_ver: undefined }] }], [EMPTY, {}]]) {
      const view = cliente({ claseInicialId: id, ...cambios })
      view.render(); view.flush(); view.replay(); await view.settle()
      assert.equal(view.player(), undefined)
      assert.match(view.html(), /no está disponible para tu cuenta/)
      assert.ok(view.programs().length > 0)
    }
    assert.equal(network.requests.length, 0)
  } finally { network.restore() }
})
test('Vimeo abre pausado sin pedir URL privada y conserva vista administrativa sin progreso', async () => {
  const network = red()
  try {
    const view = cliente({ claseInicialId: ID, esAdmin: true, clases: [{ ...base, tiene_video_privado: false, vimeo_url: 'https://vimeo.com/123' }] })
    view.render(); view.flush(); view.replay(); await view.settle()
    assert.equal(view.player().props.clase.id, ID)
    assert.equal(view.player().props.esAdmin, true)
    assert.equal(network.requests.length, 0)
    assert.ok(!view.html().includes('Continuar viendo'))
  } finally { network.restore() }
})
test('error de video no reintenta solo por rerender; se puede abrir desde la biblioteca sin duplicar clics', async () => {
  let fallar = true
  const network = red(async () => fallar ? { ok: false, json: async () => ({ error: 'No pudimos abrir la clase.' }) } : { ok: true, json: async () => ({ url: '/fixture-video.mp4' }) })
  try {
    const view = cliente({ claseInicialId: ID })
    view.render(); view.flush(); await view.settle(); view.replay(); await view.settle()
    assert.equal(view.player(), undefined)
    assert.match(view.html(), /No pudimos abrir la clase/)
    assert.equal(network.requests.length, 1)
    fallar = false
    const abrir = view.programs()[0].props.onAbrir
    abrir(base); abrir(base); await view.settle()
    assert.equal(network.requests.length, 2)
    assert.equal(view.player().props.clase.id, ID)
  } finally { network.restore() }
})
test('navegar a otro enlace abre su clase una sola vez; respuesta tras desmontar no abre el diálogo', async () => {
  let resolver
  const network = red(() => new Promise(resolve => { resolver = resolve }))
  try {
    const view = cliente({ claseInicialId: ID })
    view.render(); view.flush()
    view.setProps({ claseInicialId: NEXT }); view.render(); view.flush()
    assert.equal(network.requests.length, 1)
    resolver({ ok: true, json: async () => ({ url: '/fixture-primera.mp4' }) }); await view.settle()
    assert.equal(network.requests.length, 2)
    resolver({ ok: true, json: async () => ({ url: '/fixture-siguiente.mp4' }) }); await view.settle()
    assert.equal(view.player().props.clase.id, NEXT)
    assert.equal(network.requests.length, 2)
    const closed = cliente({ claseInicialId: ID })
    closed.render(); closed.flush(); closed.unmount()
    resolver({ ok: true, json: async () => ({ url: '/fixture-despues-de-salir.mp4' }) }); await closed.settle()
    assert.equal(closed.player(), undefined)
  } finally { network.restore() }
})

test('aula Farmasi requiere permiso vigente y no entrega catálogo o progreso de otra audiencia', async () => {
  const q = { searchParams: Promise.resolve({ espacio: 'farmasi', clase: SAMPLE }) }
  const consultas = []
  const grupo = { id: 'productos', nombre: 'Productos', orden: 0, claseIds: [ID] }
  const leerGrupos = async clases => { consultas.push(clases.map(c => c.id)); return [grupo] }
  for (const profile of [perfil, { ...perfil, estado: 'pausada', socias_farmaci_habilitada: true }]) {
    const view = servidor({ profile, leerGrupos })
    await assert.rejects(() => view.page(q), /redirect:\/registro\/farmasi/)
    assert.equal(view.calls.catalogo, 0)
    assert.equal(view.calls.progreso, 0)
  }
  assert.deepEqual(consultas, [])
  const original = catalogo[0]
  catalogo[0] = { ...original, solo_farmaci: true }
  try {
    const view = servidor({ profile: { rol: 'alumna', estado: 'activa', tipo_usuario: 'gratuito', socias_farmaci_habilitada: true }, leerGrupos })
    const ordinaria = await view.page({ searchParams: Promise.resolve({}) })
    assert.equal(ordinaria.props.submodulosFarmasi, undefined)
    assert.deepEqual(consultas, [])
    const out = await view.page(q)
    assert.deepEqual(consultas, [[ID]])
    assert.deepEqual(out.props.submodulosFarmasi, [grupo])
    assert.equal(out.props.espacioFarmasi, true)
    assert.deepEqual(out.props.clases.map(clase => clase.id), [ID])
    assert.deepEqual(out.props.progresoInicial, [avance])
    assert.equal(out.props.claseInicialId, null)
    assert.ok(out.props.avisoClaseInicial)
  } finally {
    catalogo[0] = original
  }
})
