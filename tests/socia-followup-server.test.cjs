/* eslint-disable @typescript-eslint/no-require-imports */
// Contratos aislados de aplicación. La aceptación PostgreSQL/RLS se ejecuta por separado.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
function load(file, deps = {}) { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n === 'server-only' ? {} : n in deps ? deps[n] : require(n), m, m.exports); return m.exports }
const metrics = load('src/lib/metrics.ts'), accounts = load('src/lib/test-accounts.ts'), d = load('src/lib/socia-followup.ts', { './metrics': metrics })
const uid = '00000000-0000-4000-8000-000000000010', id = '00000000-0000-4000-8000-000000000001', cid = '00000000-0000-4000-8000-000000000002', stamp = '2026-11-02T12:00:00.123456+00:00'
const profile = changes => ({ id, nombre: 'Socia real', whatsapp: '+5493511234567', estado: 'activa', created_at: '2026-09-01T01:00:00Z', tipo_usuario: 'socia', rol: 'alumna', ...changes })
const period = changes => ({ usuaria_id: id, inicio: '2026-09-01', fin: '2027-03-01', version: 1, actualizado_en: stamp, ...changes })
const payment = changes => ({ id: cid, socia_id: id, concepto: 'Cuota acordada', vencimiento: '2026-11-01', monto: null, moneda: null, estado: 'pendiente', pagado_en: null, nota: null, version: 1, creado_en: stamp, actualizado_en: stamp, ...changes })
const entrada = changes => { const c = payment(changes); return { id: c.id, version: null, concepto: c.concepto, vencimiento: c.vencimiento, monto: c.monto, moneda: c.moneda, estado: c.estado, pagado_en: c.pagado_en, nota: c.nota } }
function fixture(options = {}) {
  const calls = [], rows = structuredClone({ perfiles: options.profiles ?? [profile()], acompanamientos_socias: options.periods ?? [], cobros_socias: options.payments ?? [], seguimientos_socias_historial: options.history ?? [] })
  let thrown = false
  const db = { auth: { getUser: async () => ({ data: { user: options.user === undefined ? { id: uid, user_metadata: { rol: 'admin' } } : options.user }, error: options.authError ?? null }) }, from(table) {
    assert.ok(Object.hasOwn(rows, table), table)
    const q = { table, action: 'read', filters: [], orders: [] }
    const b = { select(fields) { q.fields = fields; return b }, eq(k, v) { q.filters.push(['eq', k, v]); return b }, in(k, v) { q.filters.push(['in', k, v]); return b }, not(k, op, v) { q.filters.push(['not', k, op, v]); return b }, or(value) { q.filters.push(['or', value]); return b }, order(k, value) { q.orders.push([k, value]); return b }, limit(n) { q.limit = n; return b }, insert(value) { q.action = 'insert'; q.value = value; return b }, update(value) { q.action = 'update'; q.value = value; return b }, maybeSingle() { q.single = true; return run() }, then(resolve, reject) { return run().then(resolve, reject) } }
    async function run() {
      calls.push(structuredClone(q))
      if (table === 'perfiles' && q.filters.some(x => x[0] === 'eq' && x[1] === 'id' && x[2] === uid)) return { data: options.adminProfile === undefined ? { id: uid, rol: 'admin' } : options.adminProfile, error: options.profileError ?? null }
      if (options.readError === table && q.action === 'read') return { data: null, error: { message: 'Detalle interno privado' } }
      let data = rows[table].filter(r => q.filters.every(([op, k, v, extra]) => op === 'eq' ? r[k] === v : op === 'in' ? v.includes(r[k]) : op === 'not' ? !extra.slice(1, -1).split(',').includes(r[k]) : op === 'or' ? r.rol === null || r.rol !== 'admin' : false))
      if (q.action !== 'read') {
        if (options.writeError && !options.committed) return { data: null, error: options.writeError }
        if (q.action === 'insert') {
          const key = table === 'acompanamientos_socias' ? 'usuaria_id' : 'id'
          if (rows[table].some(r => r[key] === q.value[key])) return { data: null, error: { code: '23505' } }
          const row = table === 'acompanamientos_socias' ? period(q.value) : payment(q.value)
          if (table === 'acompanamientos_socias') row.fin = d.finAcompanamiento(row.inicio)
          rows[table].push(row); data = [row]
        } else {
          if (options.conflict) { if (data[0]) data[0].version += 2; return { data: null, error: null } }
          data.forEach(r => { Object.assign(r, q.value, { version: r.version + 1 }); if (table === 'acompanamientos_socias') r.fin = d.finAcompanamiento(r.inicio) })
        }
        if (options.throwAfterCommit && !thrown) { thrown = true; throw new Error('Respuesta perdida tras guardar') }
        if (options.committed) return { data: null, error: { code: 'respuesta_perdida' } }
      }
      for (const [k, value] of [...q.orders].reverse()) data.sort((a, z) => String(a[k] ?? '').localeCompare(String(z[k] ?? '')) * (value?.ascending === false ? -1 : 1))
      if (q.limit) data = data.slice(0, q.limit)
      return { data: structuredClone(q.single ? data[0] ?? null : data), error: null }
    }
    return b
  } }
  const api = load('src/lib/socia-followup-server.ts', { 'next/navigation': { unstable_rethrow: e => { if (e?.digest === 'NEXT_CONTROL') throw e } }, './supabase/server': { createClient: async () => { if (options.control) throw options.control; return db } }, './metrics': { ...metrics, fechaArgentina: date => metrics.fechaArgentina(date ?? new Date(stamp)) }, './test-accounts': accounts, './socia-followup': d })
  return { api, calls, rows, auth: { supabase: db, userId: uid } }
}
test('solo el perfil administrador verificado autoriza; metadata, cuenta ausente y fallos no habilitan el panel', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ authError: {} }, 401], [{ adminProfile: null }, 503], [{ profileError: {} }, 503], [{ adminProfile: { id, rol: 'admin' } }, 503], [{ adminProfile: { id: uid, rol: 'alumna' } }, 403], [{ adminProfile: { id: uid, rol: 'afiliada' } }, 403], [{ adminProfile: { id: uid, rol: null } }, 403]]) {
    const f = fixture(options), result = await f.api.autorizarSeguimiento(); assert.equal(result.error.status, status); assert.ok(!Object.hasOwn(result, 'supabase')); assert.ok(f.calls.every(c => c.table === 'perfiles'))
  }
  const f = fixture(), result = await f.api.autorizarSeguimiento(); assert.equal(result.userId, uid); assert.deepEqual(f.calls[0].filters, [['eq', 'id', uid]]); assert.equal(f.calls[0].fields, 'id,rol')
  const control = { digest: 'NEXT_CONTROL' }; await assert.rejects(fixture({ control }).api.autorizarSeguimiento(), e => e === control)
})
test('listado separa Socias no admin, excluye prueba por ID y no interpreta alta como inicio de acompañamiento', async () => {
  const f = fixture({ profiles: [profile({ nombre: 'Alex alumna real', email: 'privado@example.invalid' }), profile({ id: accounts.CUENTAS_PRUEBA_IDS[0], nombre: 'Prueba' }), profile({ id: cid, tipo_usuario: 'desafio' }), profile({ id: uid, rol: 'admin' })] })
  const result = await f.api.leerSeguimiento(f.auth); assert.equal(result.estado, 'lista'); assert.equal(result.socias.length, 1); assert.equal(result.socias[0].nombre, 'Alex alumna real'); assert.equal(result.socias[0].acompanamiento, null); assert.equal(result.socias[0].alta, '2026-08-31'); assert.ok(!JSON.stringify(result).includes('privado')); assert.ok(!Object.hasOwn(result.socias[0], 'email'))
  assert.ok(f.calls[0].filters.some(c => c[0] === 'eq' && c[1] === 'tipo_usuario' && c[2] === 'socia')); assert.ok(f.calls[0].filters.some(c => c[0] === 'or' && c[1] === 'rol.neq.admin,rol.is.null')); assert.equal(f.calls[0].limit, 501)
  const included = await f.api.leerSeguimiento(f.auth, true); assert.equal(included.socias.length, 2); assert.equal(included.socias.find(s => s.id === accounts.CUENTAS_PRUEBA_IDS[0]).prueba, true); assert.equal(d.resumenSeguimiento(included.socias, included.hoy).socias, 1)
  const nullableRole = fixture({ profiles: [profile({ rol: null })] }); assert.equal((await nullableRole.api.leerSeguimiento(nullableRole.auth)).socias.length, 1)
})
test('fallos, períodos corruptos y cobros cruzados nunca se representan como ceros; vacío sí requiere lectura confirmada', async () => {
  const empty = fixture({ profiles: [] }); assert.deepEqual(await empty.api.leerSeguimiento(empty.auth), { estado: 'lista', socias: [], hoy: '2026-11-02', limitado: false, incluyePrueba: false }); assert.equal(empty.calls.length, 1)
  for (const options of [{ readError: 'perfiles' }, { readError: 'acompanamientos_socias' }, { readError: 'cobros_socias' }, { periods: [period({ fin: '2027-03-02' })] }, { profiles: [profile({ created_at: 'no válido' })] }, { payments: [payment({ monto: '0', moneda: 'USD' })] }, { payments: [payment({ monto: '1e2', moneda: 'USD' })] }]) { const f = fixture(options), result = await f.api.leerSeguimiento(f.auth); assert.equal(result.estado, 'error'); assert.ok(!Object.hasOwn(result, 'socias')); assert.ok(!JSON.stringify(result).includes('Detalle interno privado')) }
  const numeric = fixture({ payments: [payment({ monto: '123.45', moneda: 'USD' })] }); assert.equal((await numeric.api.leerSeguimiento(numeric.auth)).socias[0].cobros[0].monto, 123.45)
})
test('los límites de 500 se indican tanto para Socias como cobros, sin afirmar totales completos', async () => {
  const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const f = fixture({ profiles: Array.from({ length: 501 }, (_, n) => profile({ id: uuid(n + 100) })) }), result = await f.api.leerSeguimiento(f.auth); assert.equal(result.socias.length, 500); assert.equal(result.limitado, true)
  const g = fixture({ payments: Array.from({ length: 501 }, (_, n) => payment({ id: uuid(n + 100) })) }), limited = await g.api.leerSeguimiento(g.auth); assert.equal(limited.socias[0].cobros.length, 500); assert.equal(limited.limitado, true)
  const detalle = await g.api.leerDetalleSeguimiento(g.auth, id); assert.equal(detalle.cobrosLimitados, true); assert.equal(detalle.socia.cobros.length, 500)
})
test('ficha exige Socia real, conserva historial y entrega solo campos operativos de los últimos 30 cambios', async () => {
  const h = n => ({ id: `00000000-0000-4000-8000-${String(n + 100).padStart(12, '0')}`, usuaria_id: id, entidad: 'acompanamiento', registro_id: id, creado_en: stamp, administradora_id: uid, anterior: period(), nuevo: period({ inicio: '2026-10-01', fin: '2027-04-01', secreto: 'No exponer' }) })
  const f = fixture({ periods: [period()], history: Array.from({ length: 31 }, (_, n) => h(n)) }), detail = await f.api.leerDetalleSeguimiento(f.auth, id)
  assert.equal(detail.historial.length, 30); assert.equal(detail.historialLimitado, true); assert.deepEqual(detail.historial[0].anterior, { inicio: '2026-09-01', fin: '2027-03-01' }); assert.ok(!JSON.stringify(detail).includes('No exponer')); assert.ok(!JSON.stringify(detail).includes('administradora_id')); assert.ok(f.calls.find(c => c.table === 'seguimientos_socias_historial').filters.some(c => c[1] === 'usuaria_id' && c[2] === id))
  const payHistory = fixture({ history: [{ ...h(0), entidad: 'cobro', registro_id: cid, anterior: null, nuevo: payment({ nota: 'Nota interna no va en resumen de historial' }) }] }); const payDetail = await payHistory.api.leerDetalleSeguimiento(payHistory.auth, id); assert.deepEqual(payDetail.historial[0].nuevo, { concepto: 'Cuota acordada', estado: 'pendiente' }); assert.ok(!JSON.stringify(payDetail.historial).includes('Nota interna'))
  for (const options of [{ profiles: [] }, { profiles: [profile({ tipo_usuario: 'desafio' })] }, { profiles: [profile({ rol: 'admin' })] }]) { const g = fixture(options); await assert.rejects(g.api.leerDetalleSeguimiento(g.auth, id), e => e.status === 404) }
  for (const history of [[{ ...h(0), nuevo: period({ usuaria_id: cid }) }], [{ ...h(0), nuevo: period({ fin: '2027-03-02' }) }]]) { const g = fixture({ history }); await assert.rejects(g.api.leerDetalleSeguimiento(g.auth, id), e => e.status === 503) }
})
test('acompañamiento se guarda con CAS y recupera respuestas perdidas sin renovar dos veces ni borrar el historial', async () => {
  const raw = { inicio: '2026-09-01', version: null, confirmacion_pago: true }
  for (const committed of [false, true]) {
    const f = fixture({ committed }), p = await f.api.guardarPeriodoSocia(f.auth, id, raw); assert.equal(p.version, 1); assert.equal(p.fin, '2027-03-01'); assert.deepEqual(await f.api.guardarPeriodoSocia(f.auth, id, raw), p); assert.equal(f.rows.acompanamientos_socias.length, 1)
    const next = { ...raw, inicio: '2026-10-01', version: 1 }, renewed = await f.api.guardarPeriodoSocia(f.auth, id, next); assert.equal(renewed.version, 2); assert.equal(renewed.fin, '2027-04-01'); assert.deepEqual(await f.api.guardarPeriodoSocia(f.auth, id, next), renewed)
    const update = f.calls.find(c => c.action === 'update'); assert.deepEqual(update.value, { inicio: '2026-10-01' }); assert.ok(update.filters.some(c => c[1] === 'version' && c[2] === 1)); assert.ok(f.calls.filter(c => c.action !== 'read').every(c => c.table === 'acompanamientos_socias'))
  }
  const conflict = fixture({ periods: [period()], conflict: true }); await assert.rejects(conflict.api.guardarPeriodoSocia(conflict.auth, id, { ...raw, version: 1, inicio: '2026-10-01' }), e => e.status === 409)
  const future = fixture(); await assert.rejects(future.api.guardarPeriodoSocia(future.auth, id, { ...raw, inicio: '2026-11-03' }), e => e.status === 400); assert.ok(!future.calls.some(c => c.action !== 'read'))
  const beforeSignup = fixture(); await assert.rejects(beforeSignup.api.guardarPeriodoSocia(beforeSignup.auth, id, { ...raw, inicio: '2026-08-30' }), e => e.status === 400)
  const thrown = fixture({ throwAfterCommit: true }); await assert.rejects(thrown.api.guardarPeriodoSocia(thrown.auth, id, raw)); assert.equal((await thrown.api.guardarPeriodoSocia(thrown.auth, id, raw)).version, 1); assert.equal(thrown.calls.filter(c => c.action === 'insert').length, 1)
})
test('UUID estable y versión protegen cobros: pagar no renueva ni genera débitos, y anular conserva el registro', async () => {
  for (const committed of [false, true]) {
    const f = fixture({ committed, periods: [period()] }), raw = entrada(), saved = await f.api.guardarCobroSocia(f.auth, id, raw, false); assert.equal(saved.id, cid); assert.equal(saved.version, 1); assert.deepEqual(await f.api.guardarCobroSocia(f.auth, id, raw, false), saved)
    const paid = await f.api.guardarCobroSocia(f.auth, id, { ...raw, version: 1, estado: 'pagado', pagado_en: '2026-11-02' }, true); assert.equal(paid.estado, 'pagado'); assert.equal(paid.version, 2); assert.deepEqual(f.rows.acompanamientos_socias, [period()])
    const annulled = await f.api.guardarCobroSocia(f.auth, id, { ...raw, version: 2, estado: 'anulado' }, true); assert.equal(annulled.estado, 'anulado'); assert.equal(annulled.version, 3); assert.equal(f.rows.cobros_socias.length, 1)
    assert.ok(f.calls.filter(c => c.action !== 'read').every(c => c.table === 'cobros_socias')); assert.ok(f.calls.find(c => c.action === 'update').filters.some(c => c[1] === 'version' && c[2] === 1)); assert.ok(f.calls.find(c => c.action === 'update').filters.some(c => c[1] === 'socia_id' && c[2] === id))
  }
  const duplicate = fixture({ payments: [payment()] }); await assert.rejects(duplicate.api.guardarCobroSocia(duplicate.auth, id, entrada({ concepto: 'Otra cuota' }), false), e => e.status === 409)
  const conflict = fixture({ payments: [payment()], conflict: true }); await assert.rejects(conflict.api.guardarCobroSocia(conflict.auth, id, { ...entrada(), version: 1, concepto: 'Edición concurrente' }, true), e => e.status === 409)
  const fail = fixture({ writeError: { code: 'conexion' } }); await assert.rejects(fail.api.guardarCobroSocia(fail.auth, id, entrada(), false), e => e.status === 503); assert.equal(fail.rows.cobros_socias.length, 0)
  const denied = fixture({ writeError: { code: '42501' } }); await assert.rejects(denied.api.guardarCobroSocia(denied.auth, id, entrada(), false), e => e.status === 403)
  const thrown = fixture({ throwAfterCommit: true }); await assert.rejects(thrown.api.guardarCobroSocia(thrown.auth, id, entrada(), false)); assert.equal((await thrown.api.guardarCobroSocia(thrown.auth, id, entrada(), false)).version, 1); assert.equal(thrown.rows.cobros_socias.length, 1)
})
test('API no expone finanzas a alumnas; exige origen, parámetros exactos, JSON acotado y misma identidad antes de mutar', async () => {
  const f = fixture(), deps = { '@/lib/socia-followup-server': f.api, '@/lib/metrics': metrics }
  const list = load('src/app/api/admin/socias/route.ts', deps), detail = load('src/app/api/admin/socias/[id]/route.ts', deps), periodRoute = load('src/app/api/admin/socias/[id]/acompanamiento/route.ts', deps), create = load('src/app/api/admin/socias/[id]/cobros/route.ts', deps), edit = load('src/app/api/admin/socias/[id]/cobros/[cobroId]/route.ts', deps)
  const url = 'https://app.example.invalid/api/admin/socias', params = { params: Promise.resolve({ id }) }, editParams = { params: Promise.resolve({ id, cobroId: cid }) }
  const req = (body, origin = 'https://app.example.invalid', contentType = 'application/json', suffix = '') => new Request(url + suffix, { method: 'POST', headers: { origin, 'content-type': contentType }, body: JSON.stringify(body) })
  const student = fixture({ adminProfile: { id: uid, rol: 'alumna' } }), deniedList = load('src/app/api/admin/socias/route.ts', { '@/lib/socia-followup-server': student.api }); assert.equal((await deniedList.GET(new Request(url))).status, 403); assert.equal(student.calls.length, 1)
  for (const query of ['?hoy=2020-01-01', '?prueba=0', '?prueba=1&prueba=1', '?prueba=1&id=' + id]) assert.equal((await list.GET(new Request(url + query))).status, 400)
  assert.equal((await list.GET(new Request(url + '?prueba=1'))).status, 200)
  assert.equal((await detail.GET(new Request(url + '/' + id + '?id=' + cid), params)).status, 400)
  assert.equal((await create.POST(req(entrada(), 'https://otra.example.invalid'), params)).status, 403)
  assert.equal((await create.POST(req(entrada(), ''), params)).status, 403)
  assert.equal((await create.POST(req(entrada(), 'https://app.example.invalid', 'text/plain'), params)).status, 415)
  assert.equal((await create.POST(req('ñ'.repeat(5000)), params)).status, 413)
  assert.equal((await create.POST(req({ ...entrada(), socia_id: cid }), params)).status, 400)
  assert.equal((await create.POST(req(entrada(), 'https://app.example.invalid', 'application/json', '?force=1'), params)).status, 400)
  assert.equal((await periodRoute.PUT(req({ inicio: '2026-09-01', version: null, confirmacion_pago: false }), params)).status, 400)
  assert.equal((await edit.PATCH(req({ ...entrada(), id: uid, version: 1 }), editParams)).status, 400)
  assert.ok(!f.calls.some(c => c.action !== 'read'))
  const result = await create.POST(req(entrada()), params); assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'private, no-store'); assert.equal((await result.json()).cobro.id, cid)
  const paid = await edit.PATCH(req({ ...entrada(), version: 1, estado: 'pagado', pagado_en: '2026-11-02' }), editParams); assert.equal(paid.status, 200); assert.equal((await paid.json()).cobro.estado, 'pagado')
  const stale = await edit.PATCH(req({ ...entrada(), version: 1, concepto: 'Viejo formulario' }), editParams); assert.equal(stale.status, 409)
  const unauth = fixture({ user: null }), unauthRoute = load('src/app/api/admin/socias/route.ts', { '@/lib/socia-followup-server': unauth.api }); assert.equal((await unauthRoute.GET(new Request(url))).status, 401)
})
test('lector JSON limita bytes reales aun sin Content-Length y rechaza UTF-8 inválido', async () => {
  const f = fixture(), make = (bytes, type = 'application/json') => new Request('https://example.invalid/', { method: 'PUT', headers: { 'content-type': type }, body: new Uint8Array(bytes) })
  assert.deepEqual(await f.api.leerJsonSeguimiento(make(Buffer.from('{"ok":true}'), 'application/json; charset=utf-8')), { ok: true })
  await assert.rejects(f.api.leerJsonSeguimiento(make([0xff, 0xfe])), e => e.status === 400)
  await assert.rejects(f.api.leerJsonSeguimiento(make(Buffer.from('{'))), e => e.status === 400)
  await assert.rejects(f.api.leerJsonSeguimiento(make(new Uint8Array(8193).fill(32))), e => e.status === 413)
  const control = { digest: 'NEXT_CONTROL' }, signal = fixture({ control }); await assert.rejects(signal.api.ejecutarSeguimiento(new Request('https://example.invalid'), false, () => Response.json({})), e => e === control)
})
