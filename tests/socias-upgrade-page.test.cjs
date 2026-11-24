/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
function load(file, deps = {}) {
  const m = { exports: {} }
  const js = ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', js)(name => Object.hasOwn(deps, name) ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const helpers = load('src/lib/socias-upgrade.ts')
const access = load('src/lib/class-access.ts')
const id = '11111111-1111-4111-8111-111111111111'
const sample = { id, titulo: 'Muestra ficticia', activo: true, acceso_gratuito: true, puede_ver: true, solo_farmaci: false, tiene_video_privado: true, vimeo_url: null }

test('selección de muestra rechaza privadas, Farmasi, borradores, permisos desconocidos y videos pendientes', () => {
  for (const change of [{ acceso_gratuito: false }, { solo_farmaci: true }, { activo: false }, { puede_ver: false }, { puede_ver: undefined }, { tiene_video_privado: false }, { id: 'otro' }, { titulo: '' }]) {
    assert.equal(helpers.seleccionarMuestraSocias([{ ...sample, ...change }]), null)
  }
  assert.deepEqual(helpers.seleccionarMuestraSocias([{ ...sample, acceso_gratuito: false }, sample]), { id, titulo: 'Muestra ficticia' })
  assert.equal(helpers.rutaMuestraSocias({ id: '../admin', titulo: 'No' }), null)
})

async function page(options = {}) {
  const profile = options.profile === undefined ? { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', socias_farmaci_habilitada: true } : options.profile
  let reads = 0, offers = 0, props
  const client = { auth: { getUser: async () => ({ data: { user: options.session === false ? null : { id: 'fixture' } } }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: options.profileError ? new Error('fixture') : null }) }) }) }) }
  const Page = load('src/app/socias/page.tsx', {
    'next/link': { default: ({ children, ...rest }) => React.createElement('a', rest, children) },
    'next/navigation': { redirect: to => { throw new Error('REDIRECT:' + to) } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/socias-offer-store': { leerOfertaSocias: async () => { offers++; if (options.offerError) throw new Error('private fixture error'); return { oferta: { precioTexto: null, accionUrl: null } } } },
    '@/lib/class-catalog': { leerCatalogoClases: async () => { reads++; if (options.catalogError) throw new Error('private fixture error'); return [sample] } },
    '@/lib/class-access': access,
    '@/lib/socias-upgrade': helpers,
    '@/lib/farmasi-registration': { RUTA_AULA_FARMASI: '/classroom?espacio=farmasi' },
    '@/components/SociasUpgradePanel': { default: p => { props = p; return React.createElement('section', null, 'Propuesta de prueba') } },
  }).default
  const html = renderToStaticMarkup(await Page())
  return { html, props, reads, offers }
}

test('página Farmasi obtiene muestra del catálogo propio y vuelve a su aula; ningún parámetro concede acceso', async () => {
  const result = await page()
  assert.equal(result.props.contexto, 'farmasi')
  assert.deepEqual(result.props.muestra, { id, titulo: 'Muestra ficticia' })
  assert.match(result.html, /href="\/classroom\?espacio=farmasi"/)
  assert.equal(result.reads, 1)
  for (const profile of [
    { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa' },
    { rol: 'alumna', tipo_usuario: 'gratuito', estado: 'activa', socias_farmaci_habilitada: 'true' },
    { rol: 'admin', tipo_usuario: 'socia', estado: 'activa', socias_farmaci_habilitada: true },
  ]) assert.equal((await page({ profile })).props.contexto, 'general')
})

test('Socia ya activa y acceso pausado no consultan oferta ni catálogo ni reciben otra compra', async () => {
  const socia = await page({ profile: { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa', socias_farmaci_habilitada: true } })
  assert.match(socia.html, /Ya sos parte de Socias/)
  assert.equal(socia.props, undefined)
  assert.equal(socia.reads + socia.offers, 0)
  for (const estado of ['pausada', 'cancelada']) {
    const result = await page({ profile: { rol: 'alumna', tipo_usuario: 'socia', estado } })
    assert.match(result.html, /Tu acceso está pausado/)
    assert.equal(result.props, undefined)
    assert.equal(result.reads + result.offers, 0)
  }
})

test('errores de lectura son explícitos, no descartan lo comprobado y no filtran errores privados', async () => {
  const oferta = await page({ offerError: true })
  assert.match(oferta.html, /No pudimos cargar las opciones/)
  assert.deepEqual(oferta.props.muestra, { id, titulo: 'Muestra ficticia' })
  const catalog = await page({ catalogError: true })
  assert.match(catalog.html, /No pudimos cargar la clase de muestra/)
  assert.equal(catalog.props.muestra, null)
  assert.doesNotMatch(catalog.html + oferta.html, /private fixture error/)
  const invalid = await page({ profile: null, profileError: true })
  assert.equal(invalid.reads + invalid.offers, 0)
  assert.match(invalid.html, /No pudimos comprobar tu cuenta/)
  await assert.rejects(page({ session: false }), /REDIRECT:\/login/)
})
