/* eslint-disable @typescript-eslint/no-require-imports */
// Orquestación de página con sesión/lectores simulados; no prueba una sesión real ni RLS.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const catalogo = { estado: 'lista', recursos: [], limitado: false }, sesion = { userId: 'socia-ficticia', admin: false, supabase: {} }
function pagina({ auth = sesion, inicial = catalogo } = {}) {
  const calls = [], Client = () => React.createElement('section', null, 'Catálogo de prueba')
  const deps = {
    'next/link': { default: props => React.createElement('a', props) },
    'next/navigation': { redirect: href => { throw new Error('redirect:' + href) } },
    './AfiliadasCliente': { default: Client },
    '@/lib/affiliate-hub-server': {
      autorizarAfiliadas: async () => { calls.push('auth'); return auth },
      leerRecursosAfiliadas: async checked => { assert.equal(checked, sesion); calls.push('catalogo'); return inicial },
    },
  }
  const m = { exports: {} }, source = fs.readFileSync(path.join(__dirname, '..', 'src/app/afiliadas/page.tsx'), 'utf8')
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return { Page: m.exports.default, Client, calls }
}
test('la página espera searchParams y solo pasa los dos códigos de aviso fijos al catálogo autorizado', async () => {
  for (const descarga of ['reintentar', 'no-disponible']) {
    const ui = pagina(), result = await ui.Page({ searchParams: Promise.resolve({ descarga }) })
    assert.equal(result.type, ui.Client); assert.equal(result.props.inicial, catalogo); assert.equal(result.props.avisoDescarga, descarga)
    assert.deepEqual(ui.calls, ['auth', 'catalogo']); assert.ok(Object.keys(result.props).every(k => ['inicial', 'avisoDescarga'].includes(k)))
  }
})
test('valores desconocidos, arrays y parámetros ajenos no se convierten en avisos ni se serializan al cliente', async () => {
  for (const descarga of [undefined, '', 'REINTENTAR', ' reintentar', 'reintentar ', 'no_disponible', 'constructor', '<script>dato-ajeno</script>', ['reintentar'], ['no-disponible'], ['reintentar', 'no-disponible']]) {
    const ui = pagina(), result = await ui.Page({ searchParams: Promise.resolve({ descarga, texto: 'dato-ajeno-no-renderizar', usuaria_id: 'otra-identidad' }) })
    assert.equal(result.type, ui.Client); assert.equal(result.props.avisoDescarga, undefined); assert.equal(result.props.inicial, catalogo)
    assert.ok(Object.keys(result.props).every(k => ['inicial', 'avisoDescarga'].includes(k))); assert.ok(!JSON.stringify(result.props).includes('dato-ajeno')); assert.ok(!JSON.stringify(result.props).includes('otra-identidad'))
    assert.deepEqual(ui.calls, ['auth', 'catalogo'])
  }
  const ui = pagina(), result = await ui.Page({}); assert.equal(result.props.avisoDescarga, undefined); assert.equal(result.type, ui.Client)
})
test('sin sesión y administración conservan sus destinos y no consultan ni entregan catálogo de alumna', async () => {
  const anon = pagina({ auth: { error: { status: 401, mensaje: 'Iniciá sesión.' } } })
  await assert.rejects(anon.Page({ searchParams: Promise.resolve({ descarga: 'reintentar' }) }), /redirect:\/login\?next=%2Fafiliadas$/); assert.deepEqual(anon.calls, ['auth'])
  const admin = pagina({ auth: { ...sesion, admin: true } })
  await assert.rejects(admin.Page({ searchParams: Promise.resolve({ descarga: 'no-disponible' }) }), /redirect:\/admin\/afiliadas$/); assert.deepEqual(admin.calls, ['auth'])
})
test('acceso denegado y fallo de autorización mantienen sus vistas y jamás leen recursos', async () => {
  for (const status of [403, 503]) {
    const mensaje = status === 403 ? 'Flor todavía no habilitó tu espacio.' : 'No pudimos comprobar la habilitación.', ui = pagina({ auth: { error: { status, mensaje } } })
    const result = await ui.Page({ searchParams: Promise.resolve({ descarga: 'reintentar', otro: 'no-reflejar-query' }) }), html = renderToStaticMarkup(result)
    assert.notEqual(result.type, ui.Client); assert.match(html, /Tu espacio para vender/); assert.ok(html.includes(mensaje)); assert.match(html, /href="\/inicio"/); assert.match(html, /Tus otros accesos y avances se mantienen/); assert.ok(!html.includes('no-reflejar-query'))
    if (status === 503) { assert.match(html, /role="alert"/); assert.match(html, /Reintentar/); assert.match(html, /href="\/afiliadas"/) }
    assert.deepEqual(ui.calls, ['auth'])
  }
})
test('el aviso de descarga no convierte un fallo del catálogo en vacío ni altera la respuesta del lector', async () => {
  const inicial = { estado: 'error', mensaje: 'No pudimos cargar los recursos.' }, ui = pagina({ inicial }), result = await ui.Page({ searchParams: Promise.resolve({ descarga: 'reintentar' }) })
  assert.equal(result.type, ui.Client); assert.equal(result.props.inicial, inicial); assert.equal(result.props.avisoDescarga, 'reintentar'); assert.deepEqual(ui.calls, ['auth', 'catalogo'])
})
test('el catálogo presenta avisos fijos junto al encabezado y omite valores arbitrarios', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/app/afiliadas/AfiliadasCliente.tsx'), 'utf8'), m = { exports: {} }
  const deps = {
    'next/link': { default: props => React.createElement('a', props) }, 'next/image': { default: props => React.createElement('img', props) },
    '@/components/ArrowIcon': { default: () => null }, '@/components/NavigationIcon': { default: () => null },
    '@/lib/affiliate-hub': { filtrarRecursosAfiliadas: () => [], TIPOS_RECURSO_AFILIADA: [] },
    '@/lib/affiliate-campaigns': { opcionesCampanasAfiliadas: () => [], separarAvisosDestacadosAfiliadas: () => ({ avisos: [], recursos: [] }), agruparCampanasAfiliadas: () => [] },
    '@/lib/affiliate-files': { analizarArchivoAfiliadasUrl: () => null },
  }
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in deps ? deps[name] : require(name), m, m.exports)
  for (const [avisoDescarga, mensaje] of [['reintentar', 'No pudimos preparar la descarga. Actualizá los recursos y volvé a intentarlo.'], ['no-disponible', 'Este archivo ya no está disponible. Actualizá los recursos para ver el material vigente.']]) {
    const html = renderToStaticMarkup(React.createElement(m.exports.default, { inicial: catalogo, avisoDescarga }))
    assert.ok(html.includes(mensaje)); assert.ok(html.includes(`role="alert" data-download-notice="${avisoDescarga}"`)); assert.ok(html.indexOf('data-download-notice') > html.indexOf('</h1>')); assert.ok(html.indexOf('data-download-notice') < html.indexOf('Encontrar recursos de Afiliadas'))
  }
  for (const avisoDescarga of [undefined, 'texto-ajeno', '<script>texto-ajeno</script>']) {
    const html = renderToStaticMarkup(React.createElement(m.exports.default, { inicial: catalogo, avisoDescarga }))
    assert.ok(!html.includes('data-download-notice')); assert.ok(!html.includes('texto-ajeno'))
  }
})
