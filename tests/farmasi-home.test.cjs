/* eslint-disable @typescript-eslint/no-require-imports */
// Catálogo y progreso ficticios; sin red, Auth ni escrituras reales.
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => readFileSync(join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', js)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const management = load('src/lib/class-management.ts')
const progress = load('src/lib/class-progress.ts')
const registration = load('src/lib/farmasi-registration.ts')
const access = load('src/lib/class-access.ts')
const model = load('src/lib/farmasi-home.ts', { './class-management': management, './class-progress': progress, './farmasi-registration': registration })
const ID1 = '00000000-0000-4000-8000-000000000001'
const ID2 = '00000000-0000-4000-8000-000000000002'
const OTHER = '00000000-0000-4000-8000-000000000003'
const base = { titulo: 'Clase ficticia', descripcion: null, activo: true, puede_ver: true, solo_farmaci: true, modulo: 'Socias Farmasi', orden: 0, tiene_video_privado: true, vimeo_url: null, acceso_gratuito: false, plan: '27' }
const classes = [
  { ...base, id: ID2, titulo: 'Siguiente clase', orden: 1 }, { ...base, id: ID1, titulo: 'Clase en curso' },
  { ...base, id: OTHER, solo_farmaci: false, titulo: 'No es de Farmasi' },
  { ...base, id: 'cerrada', puede_ver: false }, { ...base, id: 'oculta', activo: false },
  { ...base, id: 'sin-video', tiene_video_privado: false },
]
const avance = (id, extra = {}) => ({ clase_id: id, posicion_seg: 0, duracion_seg: 100, completada: false, actualizado_en: '2026-11-24T12:00:00Z', ...extra })
const perfil = { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', socias_farmaci_habilitada: true }
const link = { default: ({ prefetch, ...props }) => { void prefetch; return React.createElement('a', props) } }
const icon = { default: () => React.createElement('span', { 'aria-hidden': true }) }
const view = load('src/components/FarmasiHomeSummary.tsx', {
  'next/link': link, './ArrowIcon': icon, './NavigationIcon': icon,
  './SociasUpgradePanel': { default: props => React.createElement('section', { 'data-upgrade': props.contexto, 'data-precio': props.ofertaSocias?.precioTexto }, 'Conocer Socias Digitales') },
  '@/lib/farmasi-registration': registration, '@/lib/class-progress': progress,
})

test('resumen Farmasi cuenta clases únicas autorizadas y usa el progreso más reciente sin mezclar otros programas', () => {
  const catalogo = [...classes, classes[1]]
  const registros = [avance(ID1, { completada: true, actualizado_en: '2026-11-23T12:00:00Z' }), avance(ID1, { posicion_seg: 35 }), avance(OTHER, { completada: true })]
  const before = structuredClone({ catalogo, registros })
  assert.deepEqual(model.resumirInicioFarmasi(catalogo, registros), {
    clases: 2, completadas: 0, enCurso: 1, porcentaje: 0,
    proxima: { id: ID1, titulo: 'Clase en curso', desde: 35 },
  })
  assert.deepEqual({ catalogo, registros }, before)
})
test('siguiente clase sigue el orden de Flor, y un recorrido completado no inventa otra clase', () => {
  assert.deepEqual(model.resumirInicioFarmasi(classes, []).proxima, { id: ID1, titulo: 'Clase en curso', desde: null })
  assert.deepEqual(model.resumirInicioFarmasi(classes, [avance(ID1, { completada: true })]).proxima, { id: ID2, titulo: 'Siguiente clase', desde: null })
  assert.deepEqual(model.resumirInicioFarmasi(classes, [avance(ID1, { completada: true }), avance(ID2, { completada: true })]), { clases: 2, completadas: 2, enCurso: 0, porcentaje: 100, proxima: null })
})
test('avance fallido conserva clases conocidas y expresa desconocido; el vacío confirmado sí tiene cero clases', () => {
  const desconocido = model.resumirInicioFarmasi(classes, null)
  assert.deepEqual(desconocido, { clases: 2, completadas: null, enCurso: null, porcentaje: null, proxima: null })
  const html = renderToStaticMarkup(React.createElement(view.default, { resumen: desconocido }))
  assert.match(html, /Clases disponibles: 2/); assert.match(html, /Completadas: sin comprobar/)
  assert.match(html, /No pudimos cargar tu avance/)
  assert.doesNotMatch(html, /role="progressbar"|de 2 completadas|Ver mi siguiente clase/)
  assert.equal(model.resumirInicioFarmasi([], []).clases, 0)
  assert.equal(model.resumirInicioFarmasi([], []).porcentaje, null)
})
test('la vista retoma en el aula Farmasi y conserva una sola propuesta comercial sin video privado ni alumnas', () => {
  const html = renderToStaticMarkup(React.createElement(view.default, { resumen: model.resumirInicioFarmasi(classes, [avance(ID1, { posicion_seg: 35 })]), ofertaSocias: { precioTexto: 'Condición ficticia', accionUrl: null } }))
  assert.match(html, new RegExp(`href="/classroom\\?espacio=farmasi&amp;clase=${ID1}"`))
  assert.match(html, /Retomá desde 0:35/)
  assert.equal((html.match(/data-upgrade="farmasi"/g) || []).length, 1)
  assert.match(html, /data-precio="Condición ficticia"/)
  assert.doesNotMatch(html, /No es de Farmasi|video_key|vimeo_url|alumna_id|Empezar gratis/)
  const fallo = renderToStaticMarkup(React.createElement(view.default, { resumen: null }))
  assert.match(fallo, /role="alert"/); assert.doesNotMatch(fallo, /Clases disponibles: 0|role="progressbar"/)
  const loading = renderToStaticMarkup(React.createElement(view.FarmasiHomeLoading))
  assert.match(loading, /role="status"/); assert.match(loading, /aria-busy="true"/)
  assert.doesNotMatch(loading, /0 clases|completadas|https:/)
})

function server({ profile = perfil, fallo = '', dynamic = null } = {}) {
  const calls = [], db = {}
  const readData = async (name, value) => {
    calls.push(name)
    if (dynamic?.name === name) throw dynamic.error
    if (fallo === name) throw new Error('Detalle privado de prueba')
    return value
  }
  const api = load('src/app/inicio/FarmasiHome.tsx', {
    'next/navigation': { unstable_rethrow: error => { if (error?.digest === 'NEXT_DYNAMIC_TEST') throw error } },
    '@/lib/class-catalog': { leerCatalogoClases: p => { assert.equal(p, profile); return readData('catalogo', classes) } },
    '@/lib/class-progress-server': { leerProgresoClases: (client, id) => { assert.equal(client, db); assert.equal(id, 'propia'); return readData('progreso', [avance(ID1, { posicion_seg: 35 })]) } },
    '@/lib/class-access': access,
    '@/lib/socias-offer-store': { leerOfertaSocias: () => readData('oferta', { oferta: { precioTexto: 'Condición ficticia', accionUrl: null } }) },
    '@/lib/farmasi-home': model,
    '@/components/FarmasiHomeSummary': { default: view.default },
  }).default
  return { run: () => api({ supabase: db, usuariaId: 'propia', perfil: profile }), calls }
}
test('el servidor usa la sesión propia y el perfil protegido sin serializar el cliente ni registros privados', async () => {
  const testServer = server(), result = await testServer.run()
  assert.deepEqual(testServer.calls, ['catalogo', 'progreso', 'oferta'])
  assert.equal(result.props.resumen.clases, 2)
  assert.deepEqual(Object.keys(result.props).sort(), ['ofertaSocias', 'resumen'])
  assert.doesNotMatch(JSON.stringify(result.props), /video_key|vimeo_url|propia|socias_farmaci_habilitada|Detalle privado/)
})
test('el servidor no consulta datos para admin, grant truthy o cuenta sin estado activo', async () => {
  for (const profile of [
    { ...perfil, rol: 'admin' }, { ...perfil, estado: 'pausada' }, { ...perfil, estado: 'cancelada' },
    { ...perfil, estado: undefined }, { ...perfil, socias_farmaci_habilitada: false }, { ...perfil, socias_farmaci_habilitada: 'true' },
  ]) {
    const testServer = server({ profile })
    assert.equal(await testServer.run(), null)
    assert.deepEqual(testServer.calls, [])
  }
})
test('fallos independientes no inventan progreso ni precio y las señales dinámicas se propagan', async () => {
  assert.equal((await server({ fallo: 'catalogo' }).run()).props.resumen, null)
  const avanceFallido = await server({ fallo: 'progreso' }).run()
  assert.equal(avanceFallido.props.resumen.clases, 2); assert.equal(avanceFallido.props.resumen.completadas, null)
  const ofertaFallida = await server({ fallo: 'oferta' }).run()
  assert.equal(ofertaFallida.props.resumen.clases, 2); assert.equal(ofertaFallida.props.ofertaSocias, undefined)
  for (const name of ['catalogo', 'progreso', 'oferta']) {
    const error = Object.assign(new Error('Señal de prueba'), { digest: 'NEXT_DYNAMIC_TEST' })
    await assert.rejects(() => server({ dynamic: { name, error } }).run(), cause => cause === error)
  }
})
