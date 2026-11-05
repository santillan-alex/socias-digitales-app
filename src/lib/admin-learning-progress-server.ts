import 'server-only'
import { createHash } from 'node:crypto'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import { esIdAfiliadas } from './affiliate-hub'
import { esCuentaPrueba, FILTRO_CUENTAS_PRUEBA } from './test-accounts'
import { esAlumnaSeguimiento, esClaseSeguimiento, esProgresoSeguimiento, esSeguimientoFormacion, LIMITE_ALUMNAS_FORMACION, LIMITE_CLASES_FORMACION, LIMITE_PROGRESO_FORMACION,
  type AlumnaSeguimiento, type ClaseSeguimiento, type ProgresoSeguimiento, type SeguimientoFormacion } from './admin-learning-progress'

export interface SesionSeguimientoFormacion { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; admin: true }
export const HEADERS_SEGUIMIENTO_FORMACION = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
const MENSAJE_ERROR = 'No pudimos comprobar los avances de formación. Volvé a intentar; no mostramos datos incompletos como resultados definitivos.'
const PAGINA = 500, TIEMPO_TOTAL_MS = 20_000
interface Pagina { data: unknown[] | null; error: unknown; count: number | null }
const objeto = (x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x))
async function aTiempo<T>(promesa: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([Promise.resolve(promesa), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('learning_timeout')), ms) })]).finally(() => clearTimeout(timer))
}
export async function autorizarSeguimientoFormacion(): Promise<SesionSeguimientoFormacion | { error: { status: number; mensaje: string } }> {
  try {
    const supabase = await createClient(), { data: { user }, error } = await aTiempo(supabase.auth.getUser(), 6000)
    if (error || !user) return { error: { status: 401, mensaje: 'Iniciá sesión para consultar los avances.' } }
    if (!esIdAfiliadas(user.id)) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso al seguimiento.' } }
    const perfil = await aTiempo(supabase.from('perfiles').select('id,rol').eq('id', user.id).maybeSingle(), 6000)
    if (perfil.error || !perfil.data || perfil.data.id !== user.id) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso al seguimiento.' } }
    if (perfil.data.rol !== 'admin') return { error: { status: 403, mensaje: 'El seguimiento de formación está reservado al equipo de Flor.' } }
    return { supabase, userId: user.id, admin: true }
  } catch (error) { unstable_rethrow(error); return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso al seguimiento.' } } }
}
async function leerPaginas(consultar: (desde: number, hasta: number, signal: AbortSignal) => PromiseLike<Pagina>, limite: number, clave: (raw: unknown) => string, hasta: number): Promise<unknown[]> {
  const filas: unknown[] = []; let offset = 0, cantidad: number | null = null, ultima = ''
  while (offset < limite) {
    const restante = hasta - Date.now()
    if (restante <= 0) throw new Error('learning_timeout')
    const controller = new AbortController(), fin = Math.min(offset + PAGINA, limite) - 1
    let result: Pagina
    try { result = await aTiempo(consultar(offset, fin, controller.signal), Math.min(6000, restante)) }
    finally { controller.abort() }
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || Number(result.count) < 0 || Number(result.count) > limite
      || result.data.length > fin - offset + 1 || offset + result.data.length > Number(result.count) || cantidad !== null && cantidad !== result.count) throw new Error('learning_incomplete')
    cantidad = Number(result.count)
    for (const raw of result.data) {
      const actual = clave(raw)
      if (!actual || actual <= ultima) throw new Error('learning_order_changed')
      ultima = actual; filas.push(raw)
    }
    offset += result.data.length
    if (offset === cantidad) return filas
    if (!result.data.length) throw new Error('learning_empty_page')
  }
  throw new Error('learning_limit')
}
function claveId(raw: unknown) { if (!objeto(raw) || !esIdAfiliadas(raw.id)) throw new Error('invalid_id'); return raw.id.toLowerCase() }
function claveProgreso(raw: unknown) { if (!objeto(raw) || !esIdAfiliadas(raw.alumna_id) || !esIdAfiliadas(raw.clase_id)) throw new Error('invalid_progress_id'); return `${raw.alumna_id.toLowerCase()}:${raw.clase_id.toLowerCase()}` }
function texto(valor: unknown, max: number, nullable = false): string | null {
  if (nullable && valor === null) return null
  if (typeof valor !== 'string' || valor.length > max || /[\u0000-\u001f\u007f]/.test(valor)) throw new Error('invalid_text')
  const limpio = valor.trim().normalize('NFC')
  if (!limpio) { if (nullable) return null; throw new Error('empty_text') }
  return limpio
}
function revision(clase: Record<string, unknown>) {
  if (!(clase.video_key === null || typeof clase.video_key === 'string') || !(clase.vimeo_url === null || typeof clase.vimeo_url === 'string') || !(clase.video_key || clase.vimeo_url)) throw new Error('invalid_video')
  return createHash('md5').update((clase.video_key ?? clase.vimeo_url ?? '') as string).digest('hex')
}
function alumnaDto(raw: unknown): AlumnaSeguimiento {
  if (!objeto(raw) || !esIdAfiliadas(raw.id) || esCuentaPrueba(raw.id.toLowerCase()) || raw.rol === 'admin' || !(raw.rol === null || typeof raw.rol === 'string')
    || !(raw.tipo_usuario === null || typeof raw.tipo_usuario === 'string') || !(raw.estado === null || typeof raw.estado === 'string')
    || !(raw.desafio_socias_habilitada === null || typeof raw.desafio_socias_habilitada === 'boolean')) throw new Error('invalid_student')
  const alumna = { id: raw.id.toLowerCase(), nombre: texto(raw.nombre, 240, true), tipo_usuario: ['gratuito', 'desafio', 'socia'].includes(String(raw.tipo_usuario)) ? raw.tipo_usuario as AlumnaSeguimiento['tipo_usuario'] : null,
    estado: ['activa', 'pausada', 'cancelada'].includes(String(raw.estado)) ? raw.estado as AlumnaSeguimiento['estado'] : null, desafio_socias_habilitada: raw.desafio_socias_habilitada as boolean | null }
  if (!esAlumnaSeguimiento(alumna)) throw new Error('invalid_student')
  return alumna
}
function relacion(raw: unknown): Record<string, unknown> {
  const fila = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw
  if (!objeto(fila)) throw new Error('invalid_relation')
  return fila
}
export async function leerSeguimientoFormacion(auth: SesionSeguimientoFormacion): Promise<SeguimientoFormacion> {
  try {
    if (auth.admin !== true || !esIdAfiliadas(auth.userId)) throw new Error('invalid_admin_session')
    const hasta = Date.now() + TIEMPO_TOTAL_MS, db = auth.supabase
    const [rawClases, rawAlumnas] = await Promise.all([
      leerPaginas((desde, fin, signal) => db.from('clases').select('id,titulo,modulo,orden,acceso_gratuito,activo,video_key,vimeo_url', { count: 'exact' }).eq('activo', true).or('video_key.not.is.null,vimeo_url.not.is.null').order('id').range(desde, fin).abortSignal(signal), LIMITE_CLASES_FORMACION, claveId, hasta),
      leerPaginas((desde, fin, signal) => db.from('perfiles').select('id,nombre,tipo_usuario,estado,desafio_socias_habilitada,rol', { count: 'exact' }).or('rol.neq.admin,rol.is.null').not('id', 'in', FILTRO_CUENTAS_PRUEBA).order('id').range(desde, fin).abortSignal(signal), LIMITE_ALUMNAS_FORMACION, claveId, hasta),
    ])
    const revisiones = new Map<string, string>()
    const clases: ClaseSeguimiento[] = rawClases.map(raw => {
      if (!objeto(raw) || !esIdAfiliadas(raw.id) || raw.activo !== true) throw new Error('invalid_class')
      const clase = { id: raw.id.toLowerCase(), titulo: texto(raw.titulo, 180), modulo: texto(raw.modulo, 100), orden: raw.orden, acceso_gratuito: raw.acceso_gratuito }
      if (!esClaseSeguimiento(clase)) throw new Error('invalid_class')
      revisiones.set(clase.id, revision(raw))
      return clase
    })
    const alumnas = rawAlumnas.map(alumnaDto), idsAlumnas = new Set(alumnas.map(a => a.id)), progreso: ProgresoSeguimiento[] = []
    if (clases.length && alumnas.length) {
      const filas = await leerPaginas((desde, fin, signal) => db.from('progreso_clases').select('alumna_id,clase_id,posicion_seg,duracion_seg,completada,actualizado_en,video_revision,clases!inner(id,activo,video_key,vimeo_url),perfiles!inner(id,rol)', { count: 'exact' })
        .eq('clases.activo', true).or('video_key.not.is.null,vimeo_url.not.is.null', { referencedTable: 'clases' }).or('rol.neq.admin,rol.is.null', { referencedTable: 'perfiles' }).not('alumna_id', 'in', FILTRO_CUENTAS_PRUEBA)
        .order('alumna_id').order('clase_id').range(desde, fin).abortSignal(signal), LIMITE_PROGRESO_FORMACION, claveProgreso, hasta)
      for (const raw of filas) {
        if (!objeto(raw) || !esIdAfiliadas(raw.alumna_id) || !esIdAfiliadas(raw.clase_id)) throw new Error('invalid_progress')
        const alumnaId = raw.alumna_id.toLowerCase(), claseId = raw.clase_id.toLowerCase(), clase = relacion(raw.clases), alumna = relacion(raw.perfiles)
        if (!idsAlumnas.has(alumnaId) || !revisiones.has(claseId) || clase.id !== raw.clase_id || alumna.id !== raw.alumna_id || clase.activo !== true || alumna.rol === 'admin' || !(alumna.rol === null || typeof alumna.rol === 'string')
          || revision(clase) !== revisiones.get(claseId) || typeof raw.video_revision !== 'string' || !/^[a-f0-9]{32}$/.test(raw.video_revision)) throw new Error('learning_snapshot_changed')
        const row = { alumna_id: alumnaId, clase_id: claseId, posicion_seg: raw.posicion_seg, duracion_seg: raw.duracion_seg, completada: raw.completada, actualizado_en: raw.actualizado_en }
        if (!esProgresoSeguimiento(row)) throw new Error('invalid_progress')
        if (raw.video_revision === revisiones.get(claseId)) progreso.push(row)
      }
    }
    const resultado: SeguimientoFormacion = { estado: 'lista', clases, alumnas, progreso }
    if (!esSeguimientoFormacion(resultado)) throw new Error('invalid_learning')
    return resultado
  } catch (error) { unstable_rethrow(error); return { estado: 'error', mensaje: MENSAJE_ERROR } }
}
