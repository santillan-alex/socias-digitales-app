/* eslint-disable @typescript-eslint/no-require-imports */
// Text-only fixtures and simulated hooks/network. No real Socia records or writes.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(name => name in deps ? deps[name] : require(name), m, m.exports)
  return m.exports
}
const domain = load('src/lib/community.ts'), client = load('src/components/community/community-client.ts')
const id = n => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`
const author = { nombre: 'Socia Ejemplo', avatar_url: null, es_admin: false }
const post = (n = 1, changes = {}) => ({ id: id(n), contenido: 'Hoy elegí mi nicho.', tipo: 'avance', created_at: `2026-10-${String(26 - n).padStart(2, '0')}T15:00:00+00:00`, actualizado_at: `2026-10-${String(26 - n).padStart(2, '0')}T15:00:00+00:00`, version: 1, retirada: false, oculta: false, propia: true, autor: author, total_comentarios: 0, total_felicitaciones: 0, felicitada: false, ...changes })
const comment = (n = 11, changes = {}) => { const { tipo, total_comentarios, total_felicitaciones, felicitada, ...base } = post(1); void tipo; void total_comentarios; void total_felicitaciones; void felicitada; return { ...base, id: id(n), publicacion_id: id(1), contenido: '¡Qué lindo avance!', ...changes } }
const page = (posts = [], next = null) => ({ estado: 'lista', publicaciones: posts, siguiente: next })
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const tick = () => new Promise(resolve => setImmediate(resolve))
function all(tree, predicate) { if (!tree || typeof tree !== 'object') return []; return [...(predicate(tree) ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap(child => all(child, predicate))] }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); return !tree || typeof tree !== 'object' ? '' : [tree.props?.children].flat(Infinity).map(text).join('') }
function ComposerStub() { return null }
function CommentsStub() { return null }
function PostStub({ publicacion }) { return React.createElement('article', null, publicacion.contenido) }
function view(file, props) {
  const cells = [], pending = [], cleanups = new Map(); let cursor = 0
  const events = { guardadas: [], actualizadas: [], borradores: [], cantidades: [], accesos: 0, celebraciones: [] }
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in cells)) cells[i] = { current: initial }; return cells[i] },
    useCallback(fn) { cursor++; return fn },
    useEffect(effect, deps) { const i = cursor++, previous = cells[i]; if (!previous || deps.some((value, n) => !Object.is(value, previous[n]))) { cells[i] = deps; pending.push([i, effect]) } },
  }
  const deps = {
    react: hooks, 'next/link': { default: ({ prefetch, ...rest }) => { void prefetch; return React.createElement('a', rest) } },
    '@/components/ArrowIcon': { default: () => null }, '@/components/NavigationIcon': { default: () => null },
    '@/components/SuccessCelebration': { default: () => null, useSuccessCelebration: () => ({ celebration: null, celebrate: value => events.celebraciones.push(value) }) },
    '@/lib/community': domain, './community-client': client, '@/components/community/community-client': client,
    '@/lib/community-photo-client': load('src/lib/community-photo-client.ts'),
    './CommunityPhotoPicker': { default: () => null }, './CommunityPhotos': { default: () => null },
    './CommunityAvatar': load('src/components/community/CommunityAvatar.tsx'),
    './CommunityComposer': { default: ComposerStub }, '@/components/community/CommunityComposer': { default: ComposerStub },
    './CommunityComments': { default: CommentsStub }, '@/components/community/CommunityPostCard': { default: PostStub },
  }
  const Component = load(file, deps).default
  const current = { nombre: 'Socia Ejemplo', onGuardada: value => events.guardadas.push(value), onActualizada: value => events.actualizadas.push(value), onBorrador: (...values) => events.borradores.push(values), onCantidad: value => events.cantidades.push(value), onAcceso: () => events.accesos++, ...props }
  const render = () => { cursor = 0; return Component(current) }
  const find = predicate => all(render(), predicate)[0]
  const button = title => find(node => node.type === 'button' && text(node).trim() === title)
  const flush = () => { render(); while (pending.length) { const [i, effect] = pending.shift(); cleanups.get(i)?.(); cleanups.set(i, effect()) } }
  flush()
  return { render, find, button, flush, events, html: () => renderToStaticMarkup(render()), props: current, textarea: () => find(node => node.type === 'textarea'), submit: value => find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: () => ({ value: value ?? find(node => node.type === 'textarea').props.value }) } } }), unmount: () => { for (const cleanup of cleanups.values()) cleanup?.() } }
}
function network(impl) {
  const original = global.fetch, calls = []
  global.fetch = async (url, options = {}) => { const call = { url, options, body: options.body ? JSON.parse(options.body) : null }; calls.push(call); return impl(call, calls.length) }
  return { calls, restore: () => { global.fetch = original } }
}
const previousWindow = global.window
test.before(() => { global.window = { addEventListener() {}, removeEventListener() {}, confirm: () => true } })
test.after(() => { global.window = previousWindow })
const composerFile = 'src/components/community/CommunityComposer.tsx', cardFile = 'src/components/community/CommunityPostCard.tsx', commentsFile = 'src/components/community/CommunityComments.tsx', feedFile = 'src/app/comunidad/ComunidadCliente.tsx'

test('SSR distingue vacío/error, conserva marca, no obtiene pruebas privadas ni publica al montar', () => {
  const n = network(() => { throw new Error('No network expected') })
  try {
    const empty = view(feedFile, { inicial: page(), miPerfil: author }), failed = view(feedFile, { inicial: { estado: 'error', mensaje: 'Información interna' }, miPerfil: author })
    assert.match(empty.html(), /Hagamos lugar a la primera conversación/); assert.match(failed.html(), /No pudimos cargar la comunidad/)
    assert.ok(!failed.html().includes('0 publicaciones')); assert.ok(!failed.html().includes('Información interna'))
    assert.match(empty.html(), /bg-\[#F4EFEA\]/); assert.match(empty.html(), /border-\[#E7DDD5\]/); assert.match(empty.html(), /min-h-11/)
    for (const file of [feedFile, cardFile, commentsFile, composerFile]) {
      assert.ok(!read(file).includes('/api/resultados/')); assert.ok(!read(file).includes('createClient')); assert.ok(!read(file).includes('dangerouslySetInnerHTML'))
    }
    assert.equal(n.calls.length, 0); empty.unmount(); failed.unmount()
  } finally { n.restore() }
})
test('crear usa texto nativo NFC, espera ACK exacto y bloquea un doble clic sin éxito optimista', async () => {
  let finish
  const n = network(call => new Promise(resolve => { finish = () => resolve(response({ ok: true, publicacion: post(1, { id: call.body.id, contenido: call.body.contenido, tipo: call.body.tipo }) })) }))
  try {
    const ui = view(composerFile)
    assert.equal(ui.textarea().props.className.includes('text-base'), true); assert.equal(ui.textarea().props.maxLength, 2000)
    const first = ui.submit('  Un paso\r\nmás.  '), twice = ui.submit('Otro texto')
    assert.equal(n.calls.length, 1); assert.equal(n.calls[0].url, '/api/comunidad'); assert.equal(n.calls[0].body.contenido, 'Un paso\nmás.')
    assert.equal(ui.events.guardadas.length, 0); assert.equal(ui.find(node => node.type === 'fieldset').props.disabled, true)
    finish(); await first; await twice; await tick()
    assert.equal(ui.events.guardadas.length, 1); assert.equal(ui.textarea().props.value, ''); assert.equal(n.calls[0].options.cache, 'no-store')
    assert.equal(n.calls[0].options.credentials, 'same-origin'); assert.equal(n.calls[0].options.method, 'POST'); ui.unmount()
  } finally { n.restore() }
})
test('respuestas perdidas o incoherentes conservan UUID/texto y reintentan exactamente el mismo envío', async () => {
  const failures = [() => { throw new Error('network') }, () => response({ ok: true, publicacion: post(2) }), () => response({ ok: true, publicacion: post(1, { monto: 150 }) }), () => response({ error: 'internal' }, 503)]
  for (const failure of failures) {
    const n = network((call, count) => count === 1 ? failure(call) : response({ ok: true, publicacion: post(1, { id: call.body.id, contenido: call.body.contenido, tipo: call.body.tipo }) }))
    try {
      const ui = view(composerFile); ui.textarea().props.onChange({ target: { value: 'Mi avance real' } }); ui.submit(); await tick()
      assert.equal(ui.events.guardadas.length, 0); assert.equal(ui.textarea().props.value, 'Mi avance real'); assert.ok(ui.button('Reintentar el mismo envío'))
      ui.submit('No debe reemplazarlo'); await tick()
      assert.deepEqual(n.calls[1].body, n.calls[0].body); assert.equal(ui.events.guardadas.length, 1); ui.unmount()
    } finally { n.restore() }
  }
})
test('texto vacío/control/largo no se envía; 400 libera edición, 409 impide reenvío y permite cancelar edición', async () => {
  const n = network(() => response({ error: 'No mostrar detalle' }, 400))
  try {
    const ui = view(composerFile)
    for (const value of [' ', 'a\u0001b', 'a'.repeat(2001)]) { ui.submit(value); await tick() }
    assert.equal(n.calls.length, 0)
    ui.submit('Un texto'); await tick(); assert.equal(ui.find(node => node.type === 'fieldset').props.disabled, false)
    ui.unmount()
  } finally { n.restore() }
  const conflict = network(() => response({}, 409))
  try {
    const ui = view(composerFile, { publicacion: post(), onCancelar() {} }); ui.submit('Mi cambio'); await tick()
    assert.equal(ui.button('Cancelar edición').props.disabled, false); assert.equal(ui.button('Guardar cambios').props.disabled, true)
    ui.submit('Otro'); await tick(); assert.equal(conflict.calls.length, 1); ui.unmount()
  } finally { conflict.restore() }
})
test('401/403 notifican al contenedor sin confirmar publicaciones', async () => {
  for (const status of [401, 403]) {
    const n = network(() => response({}, status))
    try { const ui = view(composerFile); ui.submit('Mi texto'); await tick(); assert.equal(ui.events.accesos, 1); assert.equal(ui.events.guardadas.length, 0); ui.unmount() } finally { n.restore() }
  }
})
test('felicitación no cambia contador hasta confirmar y reintenta el estado deseado sin alternarlo', async () => {
  const n = network((_call, count) => count === 1 ? response({}, 503) : response({ ok: true, activo: true, total: 1 }))
  try {
    const ui = view(cardFile, { publicacion: post() })
    ui.button('Felicitar0').props.onClick(); ui.button('Confirmando…0').props.onClick(); await tick()
    assert.equal(n.calls.length, 1); assert.equal(ui.events.actualizadas.length, 0)
    ui.button('Reintentar felicitación0').props.onClick(); await tick()
    assert.equal(n.calls[0].options.method, 'PUT'); assert.equal(n.calls[0].url, `/api/comunidad/${id(1)}/felicitar`); assert.deepEqual(n.calls.map(call => call.body), [{ activo: true }, { activo: true }])
    assert.equal(ui.events.actualizadas[0].felicitada, true); assert.equal(ui.events.actualizadas[0].total_felicitaciones, 1); ui.unmount()
  } finally { n.restore() }
})
test('retiro propio requiere confirmación y versión; nunca borra filas ni permite gestionar autoras ajenas', async () => {
  const n = network(() => response({ ok: true, publicacion: post(1, { retirada: true, version: 2 }) }))
  try {
    const ui = view(cardFile, { publicacion: post() }), other = view(cardFile, { publicacion: post(2, { propia: false }) })
    assert.equal(other.find(node => node.props?.['aria-label']?.startsWith('Opciones')), undefined)
    ui.find(node => node.props?.['aria-label']?.startsWith('Opciones')).props.onClick(); ui.button('Retirar publicación').props.onClick()
    assert.equal(n.calls.length, 0); ui.button('Confirmar retiro').props.onClick(); await tick()
    assert.equal(n.calls[0].options.method, 'PATCH'); assert.deepEqual(n.calls[0].body, { accion: 'retirar', version: 1 }); assert.equal(ui.events.actualizadas[0].retirada, true)
    ui.unmount(); other.unmount()
  } finally { n.restore() }
})
test('comentarios cargan al abrir, error no se confunde con vacío y conserva texto tras fallo de guardado', async () => {
  const n = network((call, count) => call.options.method === 'POST' ? count === 2 ? response({}, 503) : response({ ok: true, comentario: comment(11, { id: call.body.id, contenido: call.body.contenido }) }) : response({ estado: 'lista', comentarios: [], siguiente: null }))
  try {
    const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 0 }); await tick()
    assert.equal(n.calls[0].url, `/api/comunidad/${id(1)}/comentarios`); assert.match(ui.html(), /Todavía no hay comentarios/)
    ui.textarea().props.onChange({ target: { value: 'Acompañando este paso' } }); ui.submit(); await tick()
    assert.equal(ui.events.cantidades.length, 0); assert.equal(ui.textarea().props.value, 'Acompañando este paso'); assert.ok(!ui.html().includes('Tu comentario ya acompaña'))
    ui.submit('Otro texto'); await tick()
    assert.deepEqual(n.calls[2].body, n.calls[1].body); assert.deepEqual(ui.events.cantidades, [1]); assert.equal(ui.textarea().props.value, ''); assert.match(ui.html(), /Tu comentario ya acompaña/); ui.unmount()
  } finally { n.restore() }
  const fail = network(() => response({}, 500))
  try { const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 0 }); await tick(); assert.match(ui.html(), /No pudimos cargar los comentarios/); assert.ok(!ui.html().includes('Todavía no hay comentarios')); ui.unmount() } finally { fail.restore() }
})
test('editar comentario usa id y versión originales y no altera el número de comentarios', async () => {
  const initial = comment()
  const n = network(call => call.options.method === 'PATCH' ? response({ ok: true, comentario: { ...initial, contenido: call.body.contenido, version: 2 } }) : response({ estado: 'lista', comentarios: [initial], siguiente: null }))
  try {
    const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 1 }); await tick(); ui.button('Editar').props.onClick(); ui.submit('Mi edición'); await tick()
    assert.equal(n.calls[1].url, `/api/comunidad/comentarios/${initial.id}`); assert.deepEqual(n.calls[1].body, { contenido: 'Mi edición', version: 1, accion: 'editar' }); assert.deepEqual(ui.events.cantidades, []); assert.match(ui.html(), /Mi edición/); ui.unmount()
  } finally { n.restore() }
})
test('un borrador de comentario bloquea plegado y otras acciones que podrían perderlo', () => {
  const ui = view(cardFile, { publicacion: post() })
  ui.button('Comentarios0').props.onClick()
  ui.find(node => node.type === CommentsStub).props.onBorrador(true)
  assert.equal(ui.button('Ocultar comentarios0').props.disabled, true); assert.equal(ui.button('Felicitar0').props.disabled, true)
  assert.equal(ui.find(node => node.props?.['aria-label']?.startsWith('Opciones')).props.disabled, true); ui.unmount()
})
test('feed pagina sin duplicar, conserva última lectura ante error y oculta datos si vence acceso', async () => {
  const next = domain.cursorComunidad(post(1)), n = network((_call, count) => count === 1 ? response(page([post(1), post(2)])) : response({}, 403))
  try {
    const ui = view(feedFile, { inicial: page([post(1)], next), miPerfil: author })
    ui.button('Cargar más conversaciones').props.onClick(); ui.button('Cargar más conversaciones').props.onClick(); await tick()
    assert.equal(n.calls.length, 1); assert.equal((ui.html().match(/Hoy elegí mi nicho\./g) || []).length, 2)
    assert.ok(n.calls[0].url.includes('vista=todas&cursor=')); ui.button('Actualizar comunidad').props.onClick(); await tick()
    assert.match(ui.html(), /Volvamos a comprobar tu acceso/); assert.ok(!ui.html().includes('Hoy elegí mi nicho.')); assert.match(ui.html(), /href="\/login\?next=%2Fcomunidad"/); ui.unmount()
  } finally { n.restore() }
})
test('vista propia exige filas propias y borradores bloquean filtros/recargas antes de cualquier petición', async () => {
  const n = network(() => response(page([post(2, { propia: false })])))
  try {
    const ui = view(feedFile, { inicial: page([post()]), miPerfil: author })
    ui.find(node => node.type === ComposerStub).props.onBorrador(true)
    assert.equal(ui.button('Actualizar comunidad').props.disabled, true); assert.equal(ui.find(node => node.type === 'select').props.disabled, true)
    ui.button('Mis publicaciones').props.onClick(); await tick(); assert.equal(n.calls.length, 0)
    ui.find(node => node.type === ComposerStub).props.onBorrador(false); ui.button('Mis publicaciones').props.onClick(); await tick()
    assert.equal(n.calls.length, 1); assert.match(ui.html(), /No pudimos actualizar/); assert.equal(ui.button('Todas las conversaciones').props['aria-pressed'], true); ui.unmount()
  } finally { n.restore() }
})
test('desmontar aborta la operación y descarta una respuesta tardía', async () => {
  let finish
  const n = network(call => new Promise(resolve => { finish = () => resolve(response({ ok: true, publicacion: post(1, { id: call.body.id, contenido: call.body.contenido }) })) }))
  try {
    const ui = view(composerFile); ui.submit('Mi texto'); ui.unmount(); assert.equal(n.calls[0].options.signal.aborted, true)
    finish(); await tick(); assert.equal(ui.events.guardadas.length, 0)
  } finally { n.restore() }
})
test('Flor reutiliza tarjetas y modera por callback sin apropiarse de publicaciones ni comentar en padres retirados', async () => {
  const moderated = [], ui = view(cardFile, { publicacion: post(1, { propia: false, retirada: true }), administracion: true, onModerarPublicacion: value => moderated.push(value), onModerarComentario() {} })
  assert.match(ui.html(), /Retirada por su autora/); assert.ok(!ui.html().includes('Retirada por vos'))
  ui.button('Ocultar publicación').props.onClick(); assert.equal(moderated[0].id, id(1))
  assert.equal(ui.button('Felicitar0').props.disabled, true); ui.button('Comentarios0').props.onClick()
  assert.equal(ui.find(node => node.type === CommentsStub).props.lecturaPendiente, true); assert.equal(ui.find(node => node.type === CommentsStub).props.administracion, true); ui.unmount()
  const n = network(() => response({ estado: 'lista', comentarios: [comment(11, { propia: false })], siguiente: null }))
  try {
    const saved = [], comments = view(commentsFile, { publicacionId: id(1), cantidadInicial: 1, administracion: true, onModerarComentario: value => saved.push(value) }); await tick()
    comments.button('Ocultar comentario').props.onClick(); assert.equal(saved[0].id, id(11))
    comments.props.comentarioActualizado = comment(11, { propia: false, oculta: true, version: 2 }); comments.flush()
    assert.ok(comments.button('Mostrar comentario')); assert.match(comments.html(), /Oculto por moderación/); comments.unmount()
  } finally { n.restore() }
})
test('leer comentarios impide enviar antes de confirmar la lista y una lectura abortada no altera la nueva', async () => {
  let finish
  const n = network(() => new Promise(resolve => { finish = () => resolve(response({ estado: 'lista', comentarios: [], siguiente: null })) }))
  try {
    const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 0 }); assert.equal(ui.textarea().props.disabled, true)
    ui.submit('No enviar mientras carga'); await tick(); assert.equal(n.calls.length, 1)
    finish(); await tick(); assert.equal(ui.textarea().props.disabled, false); ui.unmount()
  } finally { n.restore() }
})

test('moderar comentarios reconcilia el total una sola vez y conserva cada versión antes de comentar', async () => {
  const initial = comment(11, { propia: false }), second = comment(12, { propia: false })
  const n = network(call => call.options.method === 'POST'
    ? response({ ok: true, comentario: comment(13, { id: call.body.id, contenido: call.body.contenido }) })
    : response({ estado: 'lista', comentarios: [initial, second], siguiente: null }))
  try {
    const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 2, administracion: true, onModerarComentario() {} }); await tick()
    const receive = updated => { ui.props.comentarioActualizado = updated; ui.flush() }
    const hidden = { ...initial, oculta: true, version: 2 }
    receive(hidden); assert.deepEqual(ui.events.cantidades, [1])
    ui.flush(); receive({ ...hidden }); assert.deepEqual(ui.events.cantidades, [1])
    receive({ ...second, oculta: true, version: 2 }); assert.deepEqual(ui.events.cantidades, [1, 0])
    assert.equal(all(ui.render(), node => node.type === 'button' && text(node).trim() === 'Mostrar comentario').length, 2)
    receive({ ...initial, oculta: false, version: 3 }); assert.deepEqual(ui.events.cantidades, [1, 0, 1])
    receive(hidden); assert.deepEqual(ui.events.cantidades, [1, 0, 1])
    assert.equal(all(ui.render(), node => node.type === 'button' && text(node).trim() === 'Ocultar comentario').length, 1)
    ui.submit('Gracias por acompañar'); await tick()
    assert.deepEqual(ui.events.cantidades, [1, 0, 1, 2]); assert.equal(n.calls.length, 2); ui.unmount()
  } finally { n.restore() }
})

test('la moderación usa el total actualizado del padre y no vuelve visibles comentarios retirados', async () => {
  const initial = comment(11, { propia: false }), withdrawn = comment(12, { propia: false, retirada: true, oculta: true })
  const n = network(call => call.options.method === 'POST'
    ? response({ ok: true, comentario: comment(13, { id: call.body.id, contenido: call.body.contenido }) })
    : response({ estado: 'lista', comentarios: [initial, withdrawn], siguiente: null }))
  try {
    const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 1, administracion: true }); await tick()
    ui.props.cantidadInicial = 5; ui.flush(); assert.deepEqual(ui.events.cantidades, [])
    ui.props.comentarioActualizado = { ...initial, oculta: true, version: 2 }; ui.flush(); assert.deepEqual(ui.events.cantidades, [4])
    ui.props.cantidadInicial = 4; ui.flush(); assert.deepEqual(ui.events.cantidades, [4])
    ui.props.comentarioActualizado = { ...withdrawn, oculta: false, version: 2 }; ui.flush(); assert.deepEqual(ui.events.cantidades, [4])
    ui.props.comentarioActualizado = comment(99, { oculta: true, version: 2 }); ui.flush()
    ui.props.comentarioActualizado = { ...initial, publicacion_id: id(2), oculta: false, version: 3 }; ui.flush(); assert.deepEqual(ui.events.cantidades, [4])
    ui.submit('Sigo por acá'); await tick(); assert.deepEqual(ui.events.cantidades, [4, 5]); ui.unmount()
  } finally { n.restore() }
})

test('una página de comentarios atrasada no reemplaza moderaciones confirmadas por versiones anteriores', async () => {
  const initial = comment(11, { propia: false }), second = comment(12, { propia: false })
  const n = network((_call, count) => response({ estado: 'lista', comentarios: count === 1 ? [initial] : [initial, second], siguiente: count === 1 ? domain.cursorComunidad(initial) : null }))
  try {
    const ui = view(commentsFile, { publicacionId: id(1), cantidadInicial: 2, administracion: true, onModerarComentario() {} }); await tick()
    ui.props.comentarioActualizado = { ...initial, oculta: true, version: 2 }; ui.flush()
    ui.button('Cargar más comentarios').props.onClick(); await tick(); ui.flush()
    ui.props.comentarioActualizado = { ...second, oculta: true, version: 2 }; ui.flush()
    assert.equal(all(ui.render(), node => node.type === 'button' && text(node).trim() === 'Mostrar comentario').length, 2)
    assert.deepEqual(ui.events.cantidades, [1, 0]); assert.equal(n.calls.length, 2); ui.unmount()
  } finally { n.restore() }
})
