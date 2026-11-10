/* eslint-disable @typescript-eslint/no-require-imports */
// Contract tests with isolated transport. SQL/RLS and browser acceptance run separately.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const compiled = new Map()
function load(file, deps = {}) {
  if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)
  const m = { exports: {} }; new Function('require', 'module', 'exports', compiled.get(file))(n => n === 'server-only' ? {} : n in deps ? deps[n] : require(n), m, m.exports); return m.exports
}
const id = '00000000-0000-4000-8000-000000000001', uid = '00000000-0000-4000-8000-000000000010', other = '00000000-0000-4000-8000-000000000020', third = '00000000-0000-4000-8000-000000000030'
const when = '2026-11-06T12:00:00.123456+00:00'
const domain = load('src/lib/affiliate-hub.ts'), products = load('src/lib/affiliate-products.ts', { './affiliate-hub': domain })
const management = load('src/lib/class-management.ts'), access = load('src/lib/affiliate-access-client.ts', { './class-management': management })
const datos = { nombre: 'Producto de ensayo aislado', descripcion: null, subtipo: 'Carteras', marca: null, precio: null, moneda: 'ARS', comision_pct: null, imagen_url: null, activo: true, orden: 0, estado_afiliadas: 'publicado' }
const row = { id, ...datos, tipo: 'fisico', version: 1, actualizado_en: when }
const permiso = { usuaria_id: other, producto_id: id, habilitada: true, version: 1, actualizada_en: when }
const general = { usuaria_id: other, habilitada: true, version: 1, actualizada_en: when }
const material = { id: third, titulo: 'Copy del producto', cuerpo: 'Texto de ensayo.', tipo: 'copy', campana: null, url: null, estado: 'publicado', destacado: false, producto_id: id, version: 1, creado_en: when, actualizado_en: when }
function fixture(options = {}) {
  const rows = { productos: structuredClone(options.products ?? [row]), perfiles: structuredClone(options.people ?? [{ id: uid, nombre: 'Administración', rol: 'admin', estado: 'activa' }, { id: other, nombre: 'Afiliada', rol: 'alumna', estado: 'activa' }]), accesos_afiliadas: structuredClone(options.general ?? [general]), afiliadas_productos: structuredClone(options.grants ?? []), recursos_afiliadas: structuredClone(options.resources ?? []) }
  const calls = [], writes = []; let authReads = 0
  const db = { auth: { getUser: async () => { authReads++; return { data: { user: options.user === null ? null : { id: options.user ?? uid, user_metadata: { rol: 'admin' } } }, error: options.authError ?? null } } }, from(table) {
    assert.ok(table in rows, table)
    const q = { table, action: 'read', filters: [], count: false }, b = {
      select(fields, config) { q.fields = fields; q.count = config?.count === 'exact'; return b },
      eq(k, v) { q.filters.push(['eq', k, v]); return b }, neq(k, v) { q.filters.push(['neq', k, v]); return b }, in(k, v) { q.filters.push(['in', k, v]); return b },
      order() { return b }, limit(n) { q.limit = n; return b },
      insert(value) { q.action = 'insert'; q.value = structuredClone(value); return b }, update(value) { q.action = 'update'; q.value = structuredClone(value); return b },
      maybeSingle() { q.single = true; return run() }, then(resolve, reject) { return run().then(resolve, reject) },
    }
    const matches = r => q.filters.every(([op, k, v]) => op === 'eq' ? r[k] === v : op === 'neq' ? r[k] !== v : v.includes(r[k]))
    async function run() {
      calls.push(structuredClone(q))
      if (options.controlRead) throw options.controlRead
      if (options.readError === table && q.action === 'read') return { data: null, error: { message: 'private-provider-detail' }, count: null }
      let found = table === 'recursos_afiliadas' && options.ignoreResourceFilters ? [...rows[table]] : rows[table].filter(matches)
      if (q.action !== 'read') {
        writes.push(structuredClone(q))
        if (options.writeError && !options.lostResponse) return { data: null, error: options.writeError }
        if (options.conflict === table && q.action === 'update') {
          const changed = rows[table].find(r => table === 'productos' ? r.id === id : r.producto_id === id && r.usuaria_id === other)
          if (changed) { changed.version++; if (table === 'productos') changed.nombre = 'Edición concurrente' }
          return { data: null, error: null }
        }
        if (q.action === 'insert') {
          const exists = table === 'productos' ? rows[table].some(r => r.id === q.value.id) : rows[table].some(r => r.producto_id === q.value.producto_id && r.usuaria_id === q.value.usuaria_id)
          if (exists) return { data: null, error: { code: '23505' } }
          const created = { ...q.value, version: 1, ...(table === 'productos' ? { actualizado_en: when } : { actualizada_en: when }) }; rows[table].push(created); found = [created]
        } else found.forEach(r => Object.assign(r, q.value, { version: r.version + 1 }))
        if (options.lostResponse) return { data: null, error: { code: 'network' } }
      }
      const count = Object.hasOwn(options.counts ?? {}, table) ? options.counts[table] : found.length
      if (q.limit) found = found.slice(0, q.limit)
      if (options.truncate === table) found = found.slice(0, Math.max(0, found.length - 1))
      return { data: q.single ? found[0] ?? null : found, error: null, count: q.count ? count : undefined }
    }
    return b
  } }
  class FileError extends Error {}
  const nav = { unstable_rethrow(e) { if (e?.digest === 'NEXT_CONTROL') throw e } }
  const hub = load('src/lib/affiliate-hub-server.ts', { 'next/navigation': nav, './supabase/server': { createClient: async () => db }, './metrics': load('src/lib/metrics.ts'), './affiliate-hub': domain, './affiliate-files-server': { comprobarVinculoArchivoAfiliadas: async () => {}, ErrorArchivoAfiliadas: FileError } })
  const api = load('src/lib/affiliate-products-server.ts', { 'next/navigation': nav, './affiliate-hub-server': hub, './affiliate-hub': domain, './affiliate-access-client': access, './test-accounts': { esCuentaPrueba: value => value === third }, './affiliate-products': products })
  const deps = { '@/lib/affiliate-products-server': api }
  const routes = { admin: load('src/app/api/admin/afiliadas/productos/route.ts', deps), item: load('src/app/api/admin/afiliadas/productos/[id]/route.ts', deps), permissions: load('src/app/api/admin/afiliadas/productos/[id]/permisos/route.ts', deps), student: load('src/app/api/afiliadas/productos/route.ts', deps) }
  const request = (body, overrides = {}) => new Request('https://app.example.invalid/api/admin/afiliadas/productos' + (overrides.search ?? ''), { method: overrides.method ?? 'POST', headers: { origin: overrides.origin === undefined ? 'https://app.example.invalid' : overrides.origin, 'Content-Type': overrides.type ?? 'application/json', ...overrides.headers }, body: overrides.raw === undefined ? JSON.stringify(body) : overrides.raw })
  return { api, hub, rows, calls, writes, routes, request, auth: { supabase: db, userId: uid, admin: true }, authReads: () => authReads }
}
const context = { params: Promise.resolve({ id }) }

test('productos: validación distingue precio/comisión desconocidos de cero y normaliza solo texto', () => {
  const result = products.validarDatosProductoAfiliadas({ ...datos, nombre: '  Cartera  ', descripcion: ' Línea 1\r\nLínea 2 ', marca: '', subtipo: '' })
  assert.equal(result.nombre, 'Cartera'); assert.equal(result.descripcion, 'Línea 1\nLínea 2'); assert.equal(result.marca, null); assert.equal(result.subtipo, null)
  assert.equal(result.precio, null); assert.equal(result.comision_pct, null); assert.equal(products.precioProductoAfiliadas(result), 'A definir')
  const zero = products.validarDatosProductoAfiliadas({ ...datos, precio: 0, comision_pct: 0 }); assert.equal(zero.precio, 0); assert.equal(zero.comision_pct, 0); assert.notEqual(products.precioProductoAfiliadas(zero), 'A definir')
  assert.equal(products.esProductoAfiliadas(row), true); assert.equal(products.esProductoAfiliadas({ ...row, precio: undefined }), false)
})
test('productos: campos extra, tipos, enlaces inseguros y versiones inválidas no producen escrituras', async () => {
  for (const delta of [{ precio: -1 }, { precio: 1.001 }, { precio: '20' }, { precio: Infinity }, { comision_pct: 101 }, { comision_pct: '20' }, { activo: 'true' }, { orden: 0.5 }, { moneda: 'COP' }, { estado_afiliadas: 'eliminado' }, { nombre: '' }, { nombre: 'a'.repeat(201) }, { descripcion: '\u0000' }, { link_compra: 'https://example.invalid' }]) assert.throws(() => products.validarDatosProductoAfiliadas({ ...datos, ...delta }))
  for (const imagen_url of ['http://example.invalid/a.jpg', 'javascript:alert(1)', 'data:image/png,1', 'https://user:password@example.invalid/a.jpg', 'https://example.invalid/a b.jpg']) assert.throws(() => products.validarDatosProductoAfiliadas({ ...datos, imagen_url }))
  const f = fixture()
  for (const input of [null, [], { id, producto: datos, rol: 'admin' }, { id: 'inválido', producto: datos }, { producto: datos, version: 0 }, { producto: datos, version: '1' }, { producto: datos, version: 1e9 }]) await assert.rejects(f.api.guardarProductoAfiliadas(f.auth, input, input?.version !== undefined ? id : undefined), e => e.status === 400)
  assert.equal(f.writes.length, 0)
})
test('productos: no sesión o no admin se rechazan antes de leer catálogo; metadata editable no concede acceso', async () => {
  for (const options of [{ user: null }, { user: other }]) {
    const f = fixture(options), result = await f.routes.admin.GET(new Request('https://app.example.invalid/api/admin/afiliadas/productos'))
    assert.equal(result.status, options.user === null ? 401 : 403); assert.equal(f.calls.some(q => q.table === 'productos'), false); assert.equal(f.writes.length, 0)
  }
  const f = fixture(), student = { ...f.auth, admin: false }
  await assert.rejects(f.api.guardarProductoAfiliadas(student, { id, producto: datos }), e => e.status === 403)
  await assert.rejects(f.api.guardarPermisoProductoAfiliadas(student, id, { usuariaId: other, habilitada: true, version: null }), e => e.status === 403)
  assert.equal(f.calls.length, 0); assert.equal((await f.api.leerCatalogoAdminProductosAfiliadas(student)).estado, 'error')
})
test('productos: rutas controlan origen, query y JSON acotado antes de escribir y devuelven headers privados', async () => {
  const f = fixture({ products: [] }), body = { id, producto: datos }
  for (const overrides of [{ origin: 'https://otro.example.invalid' }, { origin: '' }]) { const r = await f.routes.admin.POST(f.request(body, overrides)); assert.equal(r.status, 403) }
  assert.equal(f.authReads(), 0)
  for (const [overrides, status] of [[{ search: '?forzar=true' }, 400], [{ type: 'text/plain' }, 415], [{ raw: '{' }, 400], [{ raw: 'x'.repeat(65001) }, 413], [{ headers: { 'content-length': '65001' } }, 413]]) assert.equal((await f.routes.admin.POST(f.request(body, overrides))).status, status)
  assert.equal(f.writes.length, 0)
  const result = await f.routes.admin.POST(f.request(body)); assert.equal(result.status, 200)
  assert.equal(result.headers.get('cache-control'), 'private, no-store'); assert.equal(result.headers.get('x-content-type-options'), 'nosniff'); assert.equal(result.headers.get('referrer-policy'), 'no-referrer')
  assert.equal((await result.json()).producto.id, id)
})
test('productos: DTO elimina enlace genérico e identidades, mantiene null, filtros y conteo exacto', async () => {
  const f = fixture({ products: [{ ...row, link_compra: 'no-serializar-link', email: 'no-serializar-email', afiliada_id: other, comision_pct: null }] })
  const catalog = await f.api.leerProductosAfiliadas({ ...f.auth, admin: false }); assert.equal(catalog.estado, 'lista')
  const p = catalog.productos[0]; assert.equal(p.precio, null); assert.equal(p.comision_pct, null)
  assert.deepEqual(Object.keys(p).sort(), f.api.CAMPOS_PRODUCTOS_AFILIADAS.split(',').sort()); assert.ok(!JSON.stringify(catalog).includes('no-serializar')); assert.ok(!Object.hasOwn(p, 'tipo'))
  assert.ok(f.calls[0].filters.some(([op, k, v]) => op === 'eq' && k === 'tipo' && v === 'fisico')); assert.ok(f.calls[0].filters.some(([, k, v]) => k === 'activo' && v === true)); assert.ok(f.calls[0].filters.some(([, k, v]) => k === 'estado_afiliadas' && v === 'publicado'))
  for (const options of [{ readError: 'productos' }, { counts: { productos: null } }, { counts: { productos: 2 } }, { counts: { productos: '1' } }, { products: [{ ...row, version: 0 }] }, { products: [row, row] }, { truncate: 'productos' }]) {
    const no = fixture(options), result = await no.api.leerProductosAfiliadas(no.auth); assert.equal(result.estado, 'error'); assert.equal('productos' in result, false)
  }
  const empty = fixture({ products: [] }); assert.deepEqual(await empty.api.leerProductosAfiliadas(empty.auth), { estado: 'lista', productos: [] })
})
test('productos: textos opcionales vacíos heredados se normalizan al leer sin alterar importes, metadata o filas', async () => {
  const legacy = [
    { ...row, descripcion: '', imagen_url: '', precio: 15, moneda: 'USD', comision_pct: 25 },
    { ...row, id: third, nombre: 'Segundo producto de ensayo', descripcion: '', imagen_url: 'https://example.invalid/producto-local.png', precio: 90, moneda: 'USD', comision_pct: 0 },
  ]
  assert.equal(products.esProductoAfiliadas(legacy[0]), false)
  const f = fixture({ products: legacy }), response = await f.routes.admin.GET(new Request('https://app.example.invalid/api/admin/afiliadas/productos'))
  assert.equal(response.status, 200)
  const catalog = await response.json(); assert.equal(products.esCatalogoProductosAfiliadas(catalog), true); assert.equal(catalog.productos.length, 2)
  for (const [index, p] of catalog.productos.entries()) {
    assert.equal(p.descripcion, null); assert.equal(p.imagen_url, legacy[index].imagen_url || null)
    for (const field of ['id', 'nombre', 'precio', 'moneda', 'comision_pct', 'version', 'actualizado_en']) assert.equal(p[field], legacy[index][field])
  }
  const member = await f.api.leerVentaAfiliadas({ ...f.auth, admin: false })
  assert.equal(products.esCatalogoVentaAfiliadas(member), true); assert.deepEqual(member.productos, catalog.productos)
  const permissions = await f.api.leerPermisosProductoAfiliadas(f.auth, id)
  assert.equal(products.esListaPermisosProductoAfiliadas(permissions), true); assert.deepEqual(permissions.producto, catalog.productos[0])
  assert.deepEqual(f.rows.productos, legacy); assert.equal(f.writes.length, 0)
})
test('productos: adaptar textos heredados no convierte campos malformados ni devuelve un catálogo parcial', async () => {
  const legacy = { ...row, id: third, descripcion: '', imagen_url: '' }
  for (const invalid of [{ precio: '15' }, { precio: -1 }, { precio: Infinity }, { comision_pct: '25' }, { comision_pct: 101 }, { activo: 'true' }, { orden: '0' }, { nombre: '' }, { descripcion: undefined }, { descripcion: '\u0000' }, { imagen_url: 'http://example.invalid/imagen.png' }, { moneda: 'CLP' }, { estado_afiliadas: 'desconocido' }, { version: '1' }, { actualizado_en: 'sin-fecha' }]) {
    const stored = [row, { ...legacy, ...invalid }], f = fixture({ products: stored }), catalog = await f.api.leerCatalogoAdminProductosAfiliadas(f.auth)
    assert.equal(catalog.estado, 'error', JSON.stringify(invalid)); assert.equal('productos' in catalog, false)
    assert.deepEqual(f.rows.productos, stored); assert.equal(f.writes.length, 0)
  }
})
test('productos: guardar alta y edición usa CAS y reintento idempotente con respuesta perdida', async () => {
  for (const lostResponse of [false, true]) {
    const f = fixture({ products: [], lostResponse }), input = { id, producto: datos }
    const first = await f.api.guardarProductoAfiliadas(f.auth, input), again = await f.api.guardarProductoAfiliadas(f.auth, input)
    assert.deepEqual(first, again); assert.equal(f.rows.productos.length, 1); assert.equal(f.writes.length, 1); assert.equal(first.precio, null); assert.equal(first.comision_pct, null)
    const edit = { version: 1, producto: { ...datos, nombre: 'Nombre editado', precio: 2500.25, comision_pct: 0 } }
    const edited = await f.api.guardarProductoAfiliadas(f.auth, edit, id); assert.equal(edited.version, 2); assert.equal(edited.nombre, 'Nombre editado'); assert.equal(edited.comision_pct, 0)
    assert.deepEqual(await f.api.guardarProductoAfiliadas(f.auth, edit, id), edited); assert.equal(f.writes.length, 2)
    assert.ok(f.writes[1].filters.some(([, k, v]) => k === 'version' && v === 1)); assert.ok(f.writes[1].filters.some(([, k, v]) => k === 'tipo' && v === 'fisico'))
  }
})
test('productos: conflicto y mismo UUID con otro contenido no sobrescriben; fallo conserva incertidumbre', async () => {
  const duplicate = fixture(); await assert.rejects(duplicate.api.guardarProductoAfiliadas(duplicate.auth, { id, producto: { ...datos, nombre: 'Otra ficha' } }), e => e.status === 409); assert.equal(duplicate.writes.length, 0)
  const conflict = fixture({ conflict: 'productos' }); await assert.rejects(conflict.api.guardarProductoAfiliadas(conflict.auth, { version: 1, producto: datos }, id), e => e.status === 409); assert.equal(conflict.rows.productos[0].nombre, 'Edición concurrente')
  const missing = fixture({ products: [] }); await assert.rejects(missing.api.guardarProductoAfiliadas(missing.auth, { version: 1, producto: datos }, id), e => e.status === 404)
  const failed = fixture({ products: [], writeError: { code: 'network' } }); await assert.rejects(failed.api.guardarProductoAfiliadas(failed.auth, { id, producto: datos }), e => e.status === 503); assert.equal(failed.rows.productos.length, 0)
})
test('materiales de venta: solo DTO mínimo asociado a catálogo; parcial, relación ajena o duplicado fallan cerrados', async () => {
  const f = fixture({ resources: [{ ...material, autora_id: uid, storage_key: 'no-serializar-storage' }] }), catalog = await f.api.leerVentaAfiliadas({ ...f.auth, admin: false })
  assert.equal(catalog.estado, 'lista'); assert.equal(catalog.recursos[0].producto_id, id); assert.ok(!JSON.stringify(catalog).includes('no-serializar')); assert.equal('autora_id' in catalog.recursos[0], false)
  for (const options of [{ resources: [material], counts: { recursos_afiliadas: 2 } }, { resources: [material], readError: 'recursos_afiliadas' }, { resources: [{ ...material, version: 0 }] }, { resources: [{ ...material, producto_id: other }], ignoreResourceFilters: true }, { resources: [material, material] }]) { const no = fixture(options), result = await no.api.leerVentaAfiliadas(no.auth); assert.equal(result.estado, 'error'); assert.equal('recursos' in result, false) }
  const empty = fixture({ products: [], resources: [material] }); assert.deepEqual(await empty.api.leerVentaAfiliadas(empty.auth), { estado: 'lista', productos: [], recursos: [] }); assert.equal(empty.calls.some(q => q.table === 'recursos_afiliadas'), false)
})
test('permisos: lista solo cuentas con habilitación general o relación existente y evita identidades privadas', async () => {
  const people = [{ id: uid, nombre: 'Equipo', rol: 'admin', estado: 'activa' }, { id: other, nombre: ' Afiliada ', rol: 'alumna', estado: 'activa', email: 'no-serializar-email' }, { id: third, nombre: null, rol: 'alumna', estado: 'pausada' }, { id, nombre: 'Sin Afiliadas', rol: 'alumna', estado: 'activa' }]
  const old = { ...permiso, usuaria_id: third, habilitada: false }
  const f = fixture({ people, grants: [old] }), list = await f.api.leerPermisosProductoAfiliadas(f.auth, id)
  assert.deepEqual(list.cuentas.map(c => c.id), [other, third]); assert.equal(list.cuentas[0].nombre, 'Afiliada'); assert.equal(list.cuentas[0].permiso, null); assert.equal(list.cuentas[1].prueba, true); assert.equal(list.cuentas[1].afiliadaHabilitada, false); assert.equal(list.cuentas[1].permiso.habilitada, false)
  assert.ok(!JSON.stringify(list).includes('no-serializar')); assert.equal(list.cuentas.some(c => c.id === uid), false)
  for (const options of [{ counts: { perfiles: null } }, { counts: { accesos_afiliadas: 99 } }, { readError: 'afiliadas_productos' }, { grants: [permiso, permiso] }, { grants: [{ ...permiso, version: 0 }] }, { general: [general, general] }]) { const no = fixture(options); await assert.rejects(no.api.leerPermisosProductoAfiliadas(no.auth, id), e => e.status === 503) }
})
test('permisos: conceder requiere cuenta activa y Afiliadas general; retirar conserva campus y permite cuenta suspendida', async () => {
  for (const changes of [{ people: [{ id: other, rol: 'alumna', estado: 'pausada' }] }, { people: [{ id: other, rol: 'admin', estado: 'activa' }] }, { general: [{ ...general, habilitada: false }] }, { general: [] }, { people: [] }, { readError: 'accesos_afiliadas' }]) {
    const f = fixture(changes); await assert.rejects(f.api.guardarPermisoProductoAfiliadas(f.auth, id, { usuariaId: other, habilitada: true, version: null }), e => e.status === (changes.readError ? 503 : 409)); assert.equal(f.writes.length, 0)
  }
  const f = fixture({ people: [{ id: other, rol: 'alumna', estado: 'pausada' }], general: [], grants: [permiso] })
  const revoked = await f.api.guardarPermisoProductoAfiliadas(f.auth, id, { usuariaId: other, habilitada: false, version: 1 }); assert.equal(revoked.habilitada, false); assert.equal(revoked.version, 2)
  assert.ok(f.writes.every(q => q.table === 'afiliadas_productos')); assert.equal(f.calls.some(q => q.table === 'perfiles' || q.table === 'accesos_afiliadas'), false)
})
test('permisos: respuesta perdida y doble envío no duplican relación; versiones y contenido ajenos requieren recarga', async () => {
  for (const lostResponse of [false, true]) {
    const f = fixture({ lostResponse }), input = { usuariaId: other, habilitada: true, version: null }
    const first = await f.api.guardarPermisoProductoAfiliadas(f.auth, id, input); assert.equal(first.version, 1)
    assert.deepEqual(await f.api.guardarPermisoProductoAfiliadas(f.auth, id, input), first); assert.equal(f.rows.afiliadas_productos.length, 1); assert.equal(f.writes.length, 1)
    const edit = { usuariaId: other, habilitada: false, version: 1 }, revoked = await f.api.guardarPermisoProductoAfiliadas(f.auth, id, edit)
    assert.deepEqual(await f.api.guardarPermisoProductoAfiliadas(f.auth, id, edit), revoked); assert.equal(revoked.version, 2); assert.equal(f.writes.length, 2)
  }
  const stale = fixture({ grants: [{ ...permiso, version: 3 }] }); await assert.rejects(stale.api.guardarPermisoProductoAfiliadas(stale.auth, id, { usuariaId: other, habilitada: false, version: 1 }), e => e.status === 409); assert.equal(stale.writes.length, 0)
  const conflict = fixture({ grants: [permiso], conflict: 'afiliadas_productos' }); await assert.rejects(conflict.api.guardarPermisoProductoAfiliadas(conflict.auth, id, { usuariaId: other, habilitada: false, version: 1 }), e => e.status === 409)
  for (const input of [{ usuariaId: other, habilitada: true, version: 0 }, { usuariaId: other, habilitada: true, version: null, rol: 'admin' }, { usuariaId: 'invalido', habilitada: true, version: null }, { usuariaId: other, habilitada: 'true', version: null }]) { const f = fixture(); await assert.rejects(f.api.guardarPermisoProductoAfiliadas(f.auth, id, input), e => e.status === 400); assert.equal(f.writes.length, 0) }
})
test('rutas item y permisos esperan params y no aceptan mutaciones de alumnas ni querys de identidad', async () => {
  const f = fixture(), patch = f.request({ version: 1, producto: { ...datos, nombre: 'Editado por ruta' } }, { method: 'PATCH' })
  const changed = await f.routes.item.PATCH(patch, context); assert.equal(changed.status, 200); assert.equal((await changed.json()).producto.nombre, 'Editado por ruta')
  const grant = await f.routes.permissions.PATCH(f.request({ usuariaId: other, habilitada: true, version: null }, { method: 'PATCH' }), context); assert.equal(grant.status, 200); assert.equal((await grant.json()).permiso.producto_id, id)
  const student = fixture({ user: other }), denied = await student.routes.permissions.PATCH(student.request({ usuariaId: other, habilitada: true, version: null }, { method: 'PATCH' }), context)
  assert.equal(denied.status, 403); assert.equal(student.writes.length, 0)
  assert.equal((await student.routes.student.GET(new Request('https://app.example.invalid/api/afiliadas/productos?usuaria_id=' + uid))).status, 400); assert.equal(student.calls.length, 1)
})
