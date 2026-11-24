/* eslint-disable @typescript-eslint/no-require-imports */
// Datos ficticios; no consulta personas, grabaciones ni destinos comerciales.
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
const read = file => readFileSync(join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  const output = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', output)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const link = { default: ({ prefetch, ...props }) => { void prefetch; return React.createElement('a', props) } }
const icon = { default: () => React.createElement('span', { 'aria-hidden': true }) }
const Upgrade = load('src/components/SociasUpgradePanel.tsx', { 'next/link': link, './ArrowIcon': icon, './NavigationIcon': icon }).default
const management = load('src/lib/class-management.ts')
const progress = load('src/lib/class-progress.ts')
const filters = load('src/lib/class-library-filters.ts', { './class-management': management })
const access = load('src/lib/class-access.ts')
const profile = { nombre: 'Alumna ficticia', avatar_url: null, rol: 'alumna', estado: 'activa', tipo_usuario: 'gratuito', plan: null, socias_farmaci_habilitada: true }
const base = { descripcion: null, orden: 0, activo: true, acceso_gratuito: false, solo_farmaci: false, tiene_video_privado: true, vimeo_url: null, plan: '27' }
const rows = [
  { ...base, id: 'farmasi', titulo: 'Clase Farmasi incluida', modulo: 'Socias Farmasi', solo_farmaci: true },
  { ...base, id: 'muestra', titulo: 'Muestra incluida', modulo: 'Bienvenida', acceso_gratuito: true },
  { ...base, id: 'socia', titulo: 'Privada de Socias', modulo: 'Negocio digital' },
  { ...base, id: 'preparacion', titulo: 'Video Farmasi por preparar', modulo: 'Socias Farmasi', solo_farmaci: true, tiene_video_privado: false },
]
function library({ perfil = profile, esAdmin = false, clases = rows, errorProgreso = false, espacioFarmasi = false, submodulosFarmasi, ...props } = {}) {
  const programs = []
  const Program = p => {
    programs.push(p)
    return React.createElement('section', { 'data-library-program': p.programa },
      React.createElement('h2', null, p.programa),
      p.clases.filter(c => p.idsVisibles.includes(c.id)).map(c => React.createElement('p', { key: c.id }, c.titulo)))
  }
  const Classroom = load('src/app/classroom/ClassroomCliente.tsx', {
    'next/link': link,
    './ClassPlayer': { default: () => null }, './ClassroomProgram': { default: Program },
    '@/lib/class-management': management, '@/lib/class-progress': progress, '@/lib/class-access': access,
    '@/lib/class-library-filters': filters, '@/lib/farmasi-registration': load('src/lib/farmasi-registration.ts'),
    '@/components/SociasUpgradePanel': { default: Upgrade },
  }).default
  const catalogo = clases.map(c => ({ ...c, puede_ver: access.puedeVerClase(perfil, c) }))
  const html = renderToStaticMarkup(React.createElement(Classroom, { clases: catalogo, perfil, esAdmin, errorProgreso, espacioFarmasi, submodulosFarmasi, ...props }))
  return { html, programs, catalogo }
}

test('Farmasi ve sus clases y muestras sin filas ni programas Socias cerrados; el upgrade queda separado', () => {
  const view = library()
  assert.match(view.html, /Clase Farmasi incluida/)
  assert.match(view.html, /Muestra incluida/)
  assert.doesNotMatch(view.html, /Privada de Socias|Negocio digital|Video Farmasi por preparar/)
  assert.match(view.html, /Incluido en tu acceso/)
  assert.match(view.html, /href="\/socias"/)
  assert.match(view.html, /Conocer Socias Digitales/)
  assert.match(view.html.match(/<nav[^>]*aria-label="Contenido del programa"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '', /href="\/socias"[^>]*>Conocer Socias<\/a>/)
  assert.doesNotMatch(view.html, /sin reproducción disponible|Todas también muestra/)
  assert.deepEqual(view.programs.flatMap(p => p.clases.map(c => c.id)).sort(), ['farmasi', 'muestra'])
  assert.equal(view.catalogo.find(c => c.id === 'socia').puede_ver, false)
  assert.match(view.html, /2<\/p><p[^>]*>clases disponibles/)
})

test('el aula Farmasi conserva grupos y su orden; el banner no incorpora clases de otros accesos', () => {
  const groups = [{ id: 'grupo', nombre: 'Primeros pasos', orden: 1, claseIds: ['farmasi'] }]
  const view = library({ espacioFarmasi: true, clases: rows.filter(c => c.solo_farmaci), submodulosFarmasi: groups })
  assert.equal(view.programs.length, 1)
  assert.equal(view.programs[0].programa, 'Contenido de Farmasi')
  assert.deepEqual(view.programs[0].gruposFarmasi, groups)
  assert.deepEqual(view.programs[0].clases.map(c => c.id), ['farmasi'])
  assert.match(view.html, /href="\/classroom\?espacio=farmasi"/)
  assert.match(view.html, /href="\/socias"/)
  assert.match(view.html.match(/<nav[^>]*aria-label="Contenido del programa"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '', /Conocer Socias/)
})

test('gratuita sin Farmasi y Desafío activo reciben su contenido autorizado y propuesta, sin cambiar permisos', () => {
  const gratis = library({ perfil: { ...profile, socias_farmaci_habilitada: false } })
  assert.deepEqual(gratis.programs.flatMap(p => p.clases.map(c => c.id)), ['muestra'])
  assert.match(gratis.html, /Conocer Socias Digitales/)
  assert.doesNotMatch(gratis.html, /Clase Farmasi incluida/)
  const desafio = library({ perfil: { ...profile, tipo_usuario: 'desafio', desafio_socias_habilitada: true, socias_farmaci_habilitada: false } })
  assert.match(desafio.html, /Privada de Socias/)
  assert.match(desafio.html, /Conocer Socias Digitales/)
  assert.doesNotMatch(desafio.html, /Clase Farmasi incluida/)
})

test('Socia, admin, acceso pausado y perfil sin comprobar no reciben una oferta de upgrade equivocada', () => {
  for (const options of [
    { perfil: { ...profile, tipo_usuario: 'socia' } },
    { perfil: { ...profile, rol: 'admin' }, esAdmin: true },
    { perfil: { ...profile, estado: 'pausada' } },
    { perfil: { ...profile, tipo_usuario: null, socias_farmaci_habilitada: false } },
    { perfil: null },
  ]) {
    const { html } = library(options)
    assert.doesNotMatch(html, /Conocer Socias|upgrade-socias-titulo/)
  }
})

test('error de progreso conserva el catálogo personal, expresa desconocido y no repone tarjetas cerradas', () => {
  const { html, programs } = library({ errorProgreso: true })
  assert.match(html, /No pudimos cargar tu progreso/)
  assert.doesNotMatch(html, /Privada de Socias|Negocio digital|Video Farmasi por preparar/)
  assert.deepEqual(programs.flatMap(p => p.clases.map(c => c.id)).sort(), ['farmasi', 'muestra'])
  assert.match(html, /Conocer Socias Digitales/)
})

test('una cuenta sin contenido disponible tiene un vacío propio y puede conocer Socias sin una compra simulada', () => {
  const { html, programs } = library({ perfil: { ...profile, socias_farmaci_habilitada: false }, clases: rows.filter(c => c.id !== 'muestra') })
  assert.equal(programs.length, 0)
  assert.match(html, /Todavía no hay clases disponibles en tu acceso/)
  assert.match(html, /Conocer Socias Digitales/)
  assert.doesNotMatch(html, /Privada de Socias|Negocio digital|Quiero ser Socia|checkout/)
})

test('la propuesta completa enumera beneficios actuales y acompañamiento sin inventar importe ni compra', () => {
  const html = renderToStaticMarkup(React.createElement(Upgrade, { formato: 'completo' }))
  for (const text of ['Clases y materiales', 'Una comunidad para crecer', 'Mi día', 'tus métricas', 'de acompañamiento', 'Enlace de inscripción por confirmar']) assert.match(html, new RegExp(text))
  assert.match(html, /<button[^>]*disabled=""[^>]*>Quiero ser Socia/)
  assert.doesNotMatch(html, /597|299|197|Ranking|Mis objetivos|Continuar a Whop|Valor del upgrade por confirmar|href=/)
})

test('precio y destino configurados se muestran sin claves, y destinos no seguros no se convierten en compra', () => {
  const precioTexto = 'Condición ficticia <especial>'
  const html = renderToStaticMarkup(React.createElement(Upgrade, { formato: 'completo', ofertaSocias: { precioTexto, accionUrl: 'https://example.com/inscripcion' } }))
  assert.match(html, /Condición ficticia &lt;especial&gt;/)
  assert.match(html, /href="https:\/\/example.com\/inscripcion"/)
  assert.doesNotMatch(html, /disabled=""/)
  for (const accionUrl of ['javascript:alert(1)', 'http://example.com', 'https://clave:secreto@example.com', '/ruta-no-verificada']) {
    const blocked = renderToStaticMarkup(React.createElement(Upgrade, { formato: 'completo', ofertaSocias: { precioTexto: null, accionUrl } }))
    assert.match(blocked, /disabled=""/)
    assert.doesNotMatch(blocked, /href=/)
  }
  const summary = renderToStaticMarkup(React.createElement(Upgrade, { ofertaSocias: { precioTexto, accionUrl: 'https://example.com/inscripcion' } }))
  assert.match(summary, /href="\/socias"/)
  assert.doesNotMatch(summary, /https:\/\/example.com/)
})
