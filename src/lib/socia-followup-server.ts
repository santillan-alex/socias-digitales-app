import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import { fechaArgentina, origenMetricasPermitido, UUID_METRICA } from './metrics'
import { esCuentaPrueba, FILTRO_CUENTAS_PRUEBA } from './test-accounts'
import { esCambioSeguimiento, esCobroSocia, esPeriodoSocia, esSociaSeguimiento, validarCobroSocia, validarPeriodoSocia,
  type CambioSeguimiento, type CobroSocia, type DetalleSeguimiento, type ListaSeguimiento, type PeriodoSocia, type SociaSeguimiento } from './socia-followup'

type Cliente = Awaited<ReturnType<typeof createClient>>
export interface SesionSeguimiento { supabase: Cliente; userId: string }
export class ErrorSeguimiento extends Error { constructor(public status: number, mensaje: string) { super(mensaje) } }
const CAMPOS_PERFIL = 'id,nombre,whatsapp,estado,created_at,tipo_usuario,rol'
const CAMPOS_PERIODO = 'usuaria_id,inicio,fin,version,actualizado_en'
const CAMPOS_COBRO = 'id,socia_id,concepto,vencimiento,monto,moneda,estado,pagado_en,nota,version,creado_en,actualizado_en'
export function hoySeguimiento() { return fechaArgentina() }
const noDisponible = () => new ErrorSeguimiento(503, 'No pudimos comprobar los registros. Volvé a intentar; no se muestran cifras como si fueran completas.')
export async function autorizarSeguimiento(): Promise<SesionSeguimiento | { error: { status: number; mensaje: string } }> {
  try {
    const supabase = await createClient(), { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { error: { status: 401, mensaje: 'Iniciá sesión para entrar al panel.' } }
    const perfil = await supabase.from('perfiles').select('id,rol').eq('id', user.id).maybeSingle()
    if (perfil.error || !perfil.data || perfil.data.id !== user.id) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } }
    if (perfil.data.rol !== 'admin') return { error: { status: 403, mensaje: 'El seguimiento está reservado al equipo de Flor.' } }
    return { supabase, userId: user.id }
  } catch (error) { unstable_rethrow(error); return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } } }
}
function periodoDto(raw: unknown): PeriodoSocia {
  if (!esPeriodoSocia(raw)) throw noDisponible()
  return { usuaria_id: raw.usuaria_id, inicio: raw.inicio, fin: raw.fin, version: raw.version, actualizado_en: raw.actualizado_en }
}
function cobroDto(raw: unknown): CobroSocia {
  if (!raw || typeof raw !== 'object') throw noDisponible()
  const row = raw as CobroSocia
  const c = { id: row.id, socia_id: row.socia_id, concepto: row.concepto, vencimiento: row.vencimiento,
    monto: row.monto === null ? null : typeof row.monto === 'number' || typeof row.monto === 'string' && /^\d+(?:\.\d{1,2})?$/.test(row.monto) ? Number(row.monto) : NaN,
    moneda: row.moneda, estado: row.estado, pagado_en: row.pagado_en, nota: row.nota, version: row.version, creado_en: row.creado_en, actualizado_en: row.actualizado_en }
  if (!esCobroSocia(c)) throw noDisponible()
  return c
}
type FilaPerfil = { id: string; nombre: string | null; whatsapp: string | null; estado: string | null; created_at: string | null; tipo_usuario: string; rol: string | null }
function sociaDto(row: FilaPerfil, acompanamiento: PeriodoSocia | null, cobros: CobroSocia[]): SociaSeguimiento {
  let alta: string | null = null
  if (row.created_at !== null) {
    if (typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) throw noDisponible()
    alta = fechaArgentina(new Date(row.created_at))
  }
  const s = { id: row.id, nombre: row.nombre, whatsapp: row.whatsapp, estado: row.estado, alta, acompanamiento, cobros, prueba: esCuentaPrueba(row.id) }
  if (row.tipo_usuario !== 'socia' || row.rol === 'admin' || !esSociaSeguimiento(s)) throw noDisponible()
  return s
}
async function buscarSocia(auth: SesionSeguimiento, id: string): Promise<FilaPerfil> {
  if (!UUID_METRICA.test(id)) throw new ErrorSeguimiento(400, 'Socia no válida.')
  const r = await auth.supabase.from('perfiles').select(CAMPOS_PERFIL).eq('id', id).eq('tipo_usuario', 'socia').or('rol.neq.admin,rol.is.null').maybeSingle()
  if (r.error) throw noDisponible()
  if (!r.data || r.data.id !== id || r.data.tipo_usuario !== 'socia' || r.data.rol === 'admin') throw new ErrorSeguimiento(404, 'La cuenta ya no figura como Socia. Revisá Acceso y actividad.')
  return r.data as FilaPerfil
}
async function buscarPeriodo(auth: SesionSeguimiento, id: string) {
  const r = await auth.supabase.from('acompanamientos_socias').select(CAMPOS_PERIODO).eq('usuaria_id', id).maybeSingle()
  if (r.error) throw noDisponible()
  if (r.data?.usuaria_id && r.data.usuaria_id !== id) throw noDisponible()
  return r.data ? periodoDto(r.data) : null
}
export async function leerSeguimiento(auth: SesionSeguimiento, incluyePrueba = false): Promise<ListaSeguimiento> {
  const hoy = hoySeguimiento()
  try {
    let consulta = auth.supabase.from('perfiles').select(CAMPOS_PERFIL).eq('tipo_usuario', 'socia').or('rol.neq.admin,rol.is.null').order('nombre').order('id').limit(501)
    if (!incluyePrueba) consulta = consulta.not('id', 'in', FILTRO_CUENTAS_PRUEBA)
    const r = await consulta
    if (r.error || !Array.isArray(r.data)) throw noDisponible()
    const perfiles = r.data.slice(0, 500) as FilaPerfil[], ids = perfiles.map(s => s.id)
    if (new Set(ids).size !== ids.length || !incluyePrueba && ids.some(esCuentaPrueba)) throw noDisponible()
    if (!ids.length) return { estado: 'lista', socias: [], hoy, limitado: r.data.length > 500, incluyePrueba }
    const [periodos, cobros] = await Promise.all([
      auth.supabase.from('acompanamientos_socias').select(CAMPOS_PERIODO).in('usuaria_id', ids).limit(501),
      auth.supabase.from('cobros_socias').select(CAMPOS_COBRO).in('socia_id', ids).order('vencimiento').order('id').limit(501),
    ])
    if (periodos.error || cobros.error || !Array.isArray(periodos.data) || !Array.isArray(cobros.data)) throw noDisponible()
    const mapa = new Map<string, PeriodoSocia>()
    for (const raw of periodos.data) { const p = periodoDto(raw); if (!ids.includes(p.usuaria_id) || mapa.has(p.usuaria_id)) throw noDisponible(); mapa.set(p.usuaria_id, p) }
    const pagos = cobros.data.slice(0, 500).map(cobroDto)
    if (pagos.some(c => !ids.includes(c.socia_id)) || new Set(pagos.map(c => c.id)).size !== pagos.length) throw noDisponible()
    return { estado: 'lista', socias: perfiles.map(s => sociaDto(s, mapa.get(s.id) ?? null, pagos.filter(c => c.socia_id === s.id))), hoy,
      limitado: r.data.length > 500 || periodos.data.length > 500 || cobros.data.length > 500, incluyePrueba }
  } catch (error) { unstable_rethrow(error); return { estado: 'error', mensaje: 'No pudimos cargar el seguimiento. No se calcularon vencimientos ni cobros.', hoy } }
}
function cambioDto(raw: unknown, id: string): CambioSeguimiento {
  if (!raw || typeof raw !== 'object') throw noDisponible()
  const x = raw as Record<string, unknown>
  if (typeof x.id !== 'string' || !UUID_METRICA.test(x.id) || x.usuaria_id !== id || (x.entidad !== 'acompanamiento' && x.entidad !== 'cobro') || typeof x.registro_id !== 'string' || !UUID_METRICA.test(x.registro_id) || typeof x.creado_en !== 'string' || !Number.isFinite(Date.parse(x.creado_en))) throw noDisponible()
  const recortar = (data: unknown) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw noDisponible()
    const r = data as Record<string, unknown>
    if (x.entidad === 'acompanamiento') {
      if (typeof r.inicio !== 'string' || typeof r.fin !== 'string' || r.usuaria_id !== id) throw noDisponible()
      return { inicio: r.inicio, fin: r.fin }
    }
    if (typeof r.concepto !== 'string' || typeof r.estado !== 'string' || r.socia_id !== id) throw noDisponible()
    return { concepto: r.concepto, estado: r.estado }
  }
  const cambio = { id: x.id, entidad: x.entidad, registro_id: x.registro_id, creado_en: x.creado_en, anterior: x.anterior === null ? null : recortar(x.anterior), nuevo: recortar(x.nuevo) }
  if (!esCambioSeguimiento(cambio)) throw noDisponible()
  return cambio
}
export async function leerDetalleSeguimiento(auth: SesionSeguimiento, id: string): Promise<DetalleSeguimiento> {
  const perfil = await buscarSocia(auth, id)
  const [periodo, cobros, historial] = await Promise.all([
    buscarPeriodo(auth, id),
    auth.supabase.from('cobros_socias').select(CAMPOS_COBRO).eq('socia_id', id).order('vencimiento').order('id').limit(501),
    auth.supabase.from('seguimientos_socias_historial').select('id,usuaria_id,entidad,registro_id,anterior,nuevo,creado_en').eq('usuaria_id', id).order('creado_en', { ascending: false }).order('id', { ascending: false }).limit(31),
  ])
  if (cobros.error || historial.error || !Array.isArray(cobros.data) || !Array.isArray(historial.data)) throw noDisponible()
  const pagos = cobros.data.slice(0, 500).map(cobroDto), cambios = historial.data.slice(0, 30).map(r => cambioDto(r, id))
  if (pagos.some(c => c.socia_id !== id) || new Set(pagos.map(c => c.id)).size !== pagos.length || new Set(cambios.map(c => c.id)).size !== cambios.length) throw noDisponible()
  return { socia: sociaDto(perfil, periodo, pagos), historial: cambios, historialLimitado: historial.data.length > 30, cobrosLimitados: cobros.data.length > 500, hoy: hoySeguimiento() }
}
function errorGuardado(error: { code?: string } | null) {
  if (error?.code === '42501') return new ErrorSeguimiento(403, 'Tu acceso cambió. Volvé a ingresar al panel.')
  if (error?.code === '23505') return new ErrorSeguimiento(409, 'Ese registro ya existe. Actualizá la ficha; no se duplicó el cobro.')
  if (['22023', '23503', '23514'].includes(error?.code ?? '')) return new ErrorSeguimiento(400, 'Revisá los datos y la condición de Socia de esta cuenta.')
  return new ErrorSeguimiento(503, 'No pudimos confirmar el guardado. Conservá el formulario y reintentá el mismo envío.')
}
export async function guardarPeriodoSocia(auth: SesionSeguimiento, id: string, raw: unknown): Promise<PeriodoSocia> {
  const perfil = await buscarSocia(auth, id)
  const alta = perfil.created_at ? fechaArgentina(new Date(perfil.created_at)) : null
  const entrada = validarEntradaSeguimiento(() => validarPeriodoSocia(raw, hoySeguimiento(), alta)), actual = await buscarPeriodo(auth, id)
  const coincide = (row: PeriodoSocia | null) => row && row.usuaria_id === id && row.inicio === entrada.inicio && row.fin === entrada.fin
  const esperada = entrada.version === null ? 1 : entrada.version + 1
  if (actual?.version === esperada && coincide(actual)) return actual
  if (actual ? actual.version !== entrada.version : entrada.version !== null) throw new ErrorSeguimiento(409, 'Otra persona cambió el acompañamiento. Actualizá la ficha antes de guardar.')
  const query = actual ? auth.supabase.from('acompanamientos_socias').update({ inicio: entrada.inicio }).eq('usuaria_id', id).eq('version', entrada.version!)
    : auth.supabase.from('acompanamientos_socias').insert({ usuaria_id: id, inicio: entrada.inicio })
  const r = await query.select(CAMPOS_PERIODO).maybeSingle()
  if (!r.error && r.data) { const p = periodoDto(r.data); if (p.version === esperada && coincide(p)) return p }
  const confirmada = await buscarPeriodo(auth, id)
  if (confirmada?.version === esperada && coincide(confirmada)) return confirmada
  if (!r.error || confirmada && confirmada.version !== entrada.version) throw new ErrorSeguimiento(409, 'El acompañamiento cambió mientras guardabas. Actualizá la ficha.')
  throw errorGuardado(r.error)
}
export async function guardarCobroSocia(auth: SesionSeguimiento, id: string, raw: unknown, editar: boolean): Promise<CobroSocia> {
  await buscarSocia(auth, id)
  const entrada = validarEntradaSeguimiento(() => validarCobroSocia(raw, hoySeguimiento()))
  if (editar ? entrada.version === null : entrada.version !== null) throw new ErrorSeguimiento(400, 'La versión del cobro no corresponde a esta operación.')
  const leer = async () => {
    const r = await auth.supabase.from('cobros_socias').select(CAMPOS_COBRO).eq('id', entrada.id).eq('socia_id', id).maybeSingle()
    if (r.error) throw noDisponible()
    const c = r.data ? cobroDto(r.data) : null
    if (c && (c.id !== entrada.id || c.socia_id !== id)) throw noDisponible()
    return c
  }
  const coincide = (row: CobroSocia | null) => row && Object.entries(entrada.datos).every(([key, value]) => row[key as keyof CobroSocia] === value)
  const esperada = entrada.version === null ? 1 : entrada.version + 1, actual = await leer()
  if (actual?.version === esperada && coincide(actual)) return actual
  if (editar ? !actual || actual.version !== entrada.version : Boolean(actual)) throw new ErrorSeguimiento(409, 'Otra persona cambió este cobro. Actualizá la ficha; no se creará otro registro.')
  const query = editar ? auth.supabase.from('cobros_socias').update(entrada.datos).eq('id', entrada.id).eq('socia_id', id).eq('version', entrada.version!)
    : auth.supabase.from('cobros_socias').insert({ id: entrada.id, socia_id: id, ...entrada.datos })
  const r = await query.select(CAMPOS_COBRO).maybeSingle()
  if (!r.error && r.data) { const c = cobroDto(r.data); if (c.socia_id === id && c.id === entrada.id && c.version === esperada && coincide(c)) return c }
  const confirmada = await leer()
  if (confirmada?.version === esperada && coincide(confirmada)) return confirmada
  if (!r.error || confirmada && confirmada.version !== entrada.version) throw new ErrorSeguimiento(409, 'El cobro cambió mientras guardabas. Actualizá la ficha antes de volver a editar.')
  throw errorGuardado(r.error)
}
export function responderSeguimiento(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
export async function ejecutarSeguimiento(request: Request, escribe: boolean, operacion: (auth: SesionSeguimiento) => Promise<Response>) {
  try {
    if (escribe && !origenMetricasPermitido(request.headers.get('origin'), request.url, request.headers.get('host'))) throw new ErrorSeguimiento(403, 'Origen no permitido.')
    const auth = await autorizarSeguimiento()
    if ('error' in auth) return responderSeguimiento({ estado: 'error', error: auth.error.mensaje }, auth.error.status)
    return await operacion(auth)
  } catch (error) { unstable_rethrow(error); const status = error instanceof ErrorSeguimiento ? error.status : 503; return responderSeguimiento({ estado: 'error', error: error instanceof ErrorSeguimiento ? error.message : 'No pudimos confirmar la operación. Conservá tus cambios e intentá nuevamente.' }, status) }
}
export function validarEntradaSeguimiento<T>(fn: () => T): T { try { return fn() } catch (error) { throw new ErrorSeguimiento(400, error instanceof Error ? error.message : 'Revisá el formulario.') } }
export async function leerJsonSeguimiento(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].toLowerCase() !== 'application/json') throw new ErrorSeguimiento(415, 'Solicitud no válida.')
  const lector = request.body?.getReader()
  if (!lector) throw new ErrorSeguimiento(400, 'Revisá el formulario.')
  const decoder = new TextDecoder('utf-8', { fatal: true }); let bytes = 0, raw = ''
  try {
    while (true) { const parte = await lector.read(); if (parte.done) break; bytes += parte.value.byteLength; if (bytes > 8192) { await lector.cancel(); throw new ErrorSeguimiento(413, 'Solicitud demasiado grande.') } raw += decoder.decode(parte.value, { stream: true }) }
    raw += decoder.decode(); return JSON.parse(raw)
  } catch (error) { if (error instanceof ErrorSeguimiento) throw error; throw new ErrorSeguimiento(400, 'Revisá el formulario.') } finally { lector.releaseLock() }
}
