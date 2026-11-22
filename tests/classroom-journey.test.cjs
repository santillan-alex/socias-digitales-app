/* eslint-disable @typescript-eslint/no-require-imports */
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
  new Function('require', 'module', 'exports', code)(n => n in deps ? deps[n] : n === '@/lib/farmasi-registration' ? load('src/lib/farmasi-registration.ts') : require(n), m, m.exports)
  return m.exports
}
const link = { default: props => React.createElement('a', props) }
function redirect(destino) { throw new Error('redirect:' + destino) }
function cliente({ user = { id: 'propia' }, perfil = { rol: 'alumna', tipo_usuario: 'socia', estado: 'activa' } } = {}) {
  const calls = []
  return { calls, db: { auth: { getUser: async () => ({ data: { user } }) }, from: tabla => {
    calls.push(tabla)
    return { select: () => ({ eq: () => ({ single: async () => ({ data: perfil }) }) }) }
  } } }
}
test('enlaces heredados comprueban sesión y regresan al catálogo actual, sin consultar o alterar tablas anteriores', async () => {
  for (const [user, destino] of [[null, '/login'], [{ id: 'propia' }, '/classroom']]) {
    const client = cliente({ user })
    const page = load('src/app/classroom/[moduloId]/page.tsx', { '@/lib/supabase/server': { createClient: async () => client.db }, 'next/navigation': { redirect } }).default
    await assert.rejects(() => page(), new RegExp('redirect:' + destino))
    assert.deepEqual(client.calls, [])
  }
  assert.ok(!read('src/app/classroom/[moduloId]/page.tsx').includes('ModuloCliente'))
})
test('error de catálogo es recuperación explícita; una biblioteca realmente vacía mantiene su estado vacío', async () => {
  for (const fallo of [true, false]) {
    const client = cliente()
    let progresoConsultado = 0
    const recovery = () => React.createElement('p', null, 'Recuperar biblioteca')
    const catalogo = props => React.createElement('p', null, 'Clases:' + props.clases.length)
    const page = load('src/app/classroom/page.tsx', {
      '@/lib/class-access': load('src/lib/class-access.ts'),
      '@/lib/supabase/server': { createClient: async () => client.db },
      'next/navigation': { redirect },
      './ClassroomCliente': { default: catalogo },
      './ClassroomRecovery': { default: recovery },
      '@/lib/class-catalog': { leerCatalogoClases: async () => { if (fallo) throw new Error('fixture'); return [] } },
      '@/lib/class-progress-server': { leerProgresoClases: async () => { progresoConsultado++; return [] } },
      '@/lib/class-management': load('src/lib/class-management.ts'),
    }).default
    const result = await page()
    assert.equal(result.type, fallo ? recovery : catalogo)
    assert.equal(progresoConsultado, fallo ? 0 : 1)
    if (!fallo) assert.deepEqual(result.props.clases, [])
  }
})
test('recuperación accesible reconsulta la ruta y ofrece regreso correcto, sin mostrar cifras ni un catálogo falso', () => {
  for (const esAdmin of [true, false]) {
    let refresh = 0
    const Recovery = load('src/app/classroom/ClassroomRecovery.tsx', {
      'next/link': link,
      'next/navigation': { useRouter: () => ({ refresh: () => refresh++ }) },
      react: { ...React, useTransition: () => [false, callback => callback()] },
    }).default
    const tree = Recovery({ esAdmin })
    const buscar = node => {
      if (!node || typeof node !== 'object') return null
      if (node.type === 'button') return node
      for (const child of React.Children.toArray(node.props?.children)) { const encontrado = buscar(child); if (encontrado) return encontrado }
      return null
    }
    buscar(tree).props.onClick()
    assert.equal(refresh, 1)
    const html = renderToStaticMarkup(tree)
    assert.match(html, /role="alert"/); assert.match(html, /Reintentar/)
    assert.ok(html.includes(`href="${esAdmin ? '/admin' : '/inicio'}"`))
    assert.ok(!html.includes('clases disponibles')); assert.ok(!html.includes('Estamos preparando tus clases'))
  }
})
test('loading de biblioteca comunica espera y no inventa clases, progreso ni enlaces privados', () => {
  const Loading = load('src/app/classroom/loading.tsx').default
  const html = renderToStaticMarkup(React.createElement(Loading))
  assert.match(html, /role="status"/); assert.match(html, /aria-busy="true"/)
  assert.match(html, /Cargando tus clases y tu avance/)
  assert.ok(!html.includes('0 clases')); assert.ok(!html.includes('completadas')); assert.ok(!html.includes('http'))
})
test('sin avance abre Bienvenida existente; Continuar real tiene prioridad, errores y admin no inventan un inicio', () => {
  const management = load('src/lib/class-management.ts'), progress = load('src/lib/class-progress.ts')
  const filters = load('src/lib/class-library-filters.ts', { './class-management': management })
  const program = props => React.createElement('div', { 'data-programa': props.programa, 'data-abierto': props.abierto })
  const Classroom = load('src/app/classroom/ClassroomCliente.tsx', {
    './ClassPlayer': { default: () => null }, './ClassroomProgram': { default: program },
    '@/lib/class-management': management, '@/lib/class-progress': progress, '@/lib/class-access': load('src/lib/class-access.ts'),
    '@/lib/class-library-filters': filters,
  }).default
  const bienvenida = { id: 'a', titulo: 'Bienvenida de Flor', descripcion: null, modulo: 'Introducción', orden: 0, activo: true, puede_ver: true, tiene_video_privado: true }
  const desafio = { ...bienvenida, id: 'b', titulo: 'Clase de Flor', modulo: 'Desafío Socias' }
  const perfil = { rol: 'alumna', estado: 'activa', tipo_usuario: 'socia' }
  const enCurso = { clase_id: 'b', posicion_seg: 30, duracion_seg: 100, completada: false, actualizado_en: '2026-10-22T10:00:00Z' }
  for (const [props, apertura] of [
    [{}, 'Bienvenida'],
    [{ progresoInicial: [enCurso] }, 'Desafío Socias'],
    [{ progresoInicial: [{ ...enCurso, completada: true }] }, null],
    [{ errorProgreso: true }, null],
    [{ esAdmin: true }, null],
  ]) {
    const html = renderToStaticMarkup(React.createElement(Classroom, { clases: [bienvenida, desafio], perfil, esAdmin: false, ...props }))
    for (const programa of ['Bienvenida', 'Desafío Socias']) assert.ok(html.includes(`data-programa="${programa}" data-abierto="${programa === apertura}"`))
    assert.equal(html.includes('Continuar viendo'), apertura === 'Desafío Socias')
  }
  const html = renderToStaticMarkup(React.createElement(Classroom, { clases: [desafio], perfil, esAdmin: false }))
  assert.ok(!html.includes('data-programa="Bienvenida"'))
  assert.match(read('src/app/classroom/ClassroomProgram.tsx'), /open=\{abierto \|\| abrirCoincidencias\}/)
})
