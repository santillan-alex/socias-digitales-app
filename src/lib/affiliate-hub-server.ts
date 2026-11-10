import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import { origenMetricasPermitido } from './metrics'
import { esIdAfiliadas, esRecursoAfiliada, recursoCoincideAfiliada, validarEntradaAfiliada, type CatalogoAfiliadas, type EntradaRecursoAfiliada, type RecursoAfiliada } from './affiliate-hub'
import { comprobarVinculoArchivoAfiliadas, ErrorArchivoAfiliadas } from './affiliate-files-server'

export const HEADERS_AFILIADAS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
const CAMPOS = 'id,titulo,cuerpo,tipo,campana,url,estado,destacado,version,creado_en,actualizado_en,producto_id'
export interface SesionAfiliadas { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; admin: boolean }
export class ErrorAfiliadas extends Error { constructor(public status: number, mensaje: string) { super(mensaje) } }
export function origenSolicitudAfiliadas(request: Request) {
  return origenMetricasPermitido(request.headers.get('origin'), request.url, request.headers.get('host'))
}
export async function autorizarAfiliadas(admin = false): Promise<SesionAfiliadas | { error: { status: number; mensaje: string } }> {
  try {
    const supabase = await createClient(), { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { error: { status: 401, mensaje: 'Iniciá sesión para entrar a tu espacio.' } }
    const perfil = await supabase.from('perfiles').select('id,rol,estado').eq('id', user.id).maybeSingle()
    if (perfil.error || !perfil.data || perfil.data.id !== user.id) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } }
    if (perfil.data.rol === 'admin') return { supabase, userId: user.id, admin: true }
    if (admin || perfil.data.estado !== 'activa') return { error: { status: 403, mensaje: 'Este espacio requiere una habilitación de Flor.' } }
    const acceso = await supabase.from('accesos_afiliadas').select('usuaria_id,habilitada').eq('usuaria_id', user.id).maybeSingle()
    if (acceso.error) return { error: { status: 503, mensaje: 'No pudimos comprobar la habilitación de Afiliadas.' } }
    if (acceso.data?.usuaria_id !== user.id || acceso.data?.habilitada !== true) return { error: { status: 403, mensaje: 'Flor todavía no habilitó tu espacio de Afiliada.' } }
    return { supabase, userId: user.id, admin: false }
  } catch (error) { unstable_rethrow(error); return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } } }
}
function dto(row: RecursoAfiliada): RecursoAfiliada {
  if (row.producto_id !== null && !esIdAfiliadas(row.producto_id)) throw new ErrorAfiliadas(503, 'No pudimos comprobar el producto del material.')
  const result = { id: row.id, titulo: row.titulo, cuerpo: row.cuerpo, tipo: row.tipo, campana: row.campana, url: row.url, estado: row.estado, destacado: row.destacado, version: row.version, creado_en: row.creado_en, actualizado_en: row.actualizado_en, producto_id: row.producto_id }
  if (!esRecursoAfiliada(result)) throw new ErrorAfiliadas(503, 'El recurso requiere revisión del equipo. Volvé a intentar.')
  return result
}
export async function comprobarProductoRecursoAfiliadas(auth: SesionAfiliadas, productoId: unknown) {
  if (productoId === null) return
  if (!esIdAfiliadas(productoId)) throw new ErrorAfiliadas(503, 'No pudimos comprobar el producto del material.')
  const producto = await auth.supabase.from('productos').select('id,tipo,activo,estado_afiliadas').eq('id', productoId).maybeSingle()
  if (producto.error) throw new ErrorAfiliadas(503, 'No pudimos comprobar el producto del material.')
  if (!producto.data || producto.data.id !== productoId || producto.data.tipo !== 'fisico') throw new ErrorAfiliadas(auth.admin ? 400 : 404, 'El producto no está disponible.')
  if (auth.admin) return
  if (producto.data.activo !== true || producto.data.estado_afiliadas !== 'publicado') throw new ErrorAfiliadas(404, 'El producto no está disponible.')
  const permiso = await auth.supabase.from('afiliadas_productos').select('usuaria_id,producto_id,habilitada').eq('usuaria_id', auth.userId).eq('producto_id', productoId).maybeSingle()
  if (permiso.error) throw new ErrorAfiliadas(503, 'No pudimos comprobar tu acceso al producto.')
  if (permiso.data?.usuaria_id !== auth.userId || permiso.data?.producto_id !== productoId || permiso.data?.habilitada !== true) throw new ErrorAfiliadas(404, 'El producto no está disponible.')
}
export async function leerRecursosAfiliadas(auth: SesionAfiliadas): Promise<CatalogoAfiliadas> {
  try {
    let query = auth.supabase.from('recursos_afiliadas').select(CAMPOS).order('destacado', { ascending: false }).order('creado_en', { ascending: false }).order('id').limit(201)
    if (!auth.admin) query = query.eq('estado', 'publicado')
    const { data, error } = await query
    if (error || !Array.isArray(data)) throw new Error()
    const recursos = data.slice(0, 200).map(r => dto(r as RecursoAfiliada))
    if ((!auth.admin && recursos.some(r => r.estado !== 'publicado')) || new Set(recursos.map(r => r.id)).size !== recursos.length) throw new Error()
    return { estado: 'lista', recursos, limitado: data.length > 200 }
  } catch (error) { unstable_rethrow(error); return { estado: 'error', mensaje: 'No pudimos cargar los recursos. Volvé a intentar; no se muestra un catálogo parcial.' } }
}
function fallo(error: { code?: string } | null) {
  if (error?.code === '42501') return new ErrorAfiliadas(403, 'Tu permiso cambió. Volvé a ingresar al panel.')
  if (['22023', '23514', '23503'].includes(error?.code ?? '')) return new ErrorAfiliadas(400, 'Revisá los datos del recurso.')
  if (error?.code === '23505') return new ErrorAfiliadas(409, 'Ese envío ya existe con otros datos. Revisá el catálogo.')
  return new ErrorAfiliadas(503, 'No pudimos confirmar el guardado. Conservá el formulario y reintentá el mismo envío.')
}
export async function guardarRecursoAfiliadas(auth: SesionAfiliadas, entrada: EntradaRecursoAfiliada, editar = false): Promise<RecursoAfiliada> {
  if (!auth.admin) throw new ErrorAfiliadas(403, 'Solo el equipo de Flor puede editar recursos.')
  try { await comprobarVinculoArchivoAfiliadas(entrada.id, entrada.datos) }
  catch (error) { unstable_rethrow(error); if (error instanceof ErrorArchivoAfiliadas) throw new ErrorAfiliadas(error.status, error.message); throw new ErrorAfiliadas(503, 'No pudimos comprobar el archivo del recurso. Conservá el formulario y reintentá.') }
  const leer = () => auth.supabase.from('recursos_afiliadas').select(CAMPOS).eq('id', entrada.id).maybeSingle()
  const previa = await leer()
  if (previa.error) throw fallo(previa.error)
  if (previa.data && previa.data.producto_id !== null && !esIdAfiliadas(previa.data.producto_id)) throw new ErrorAfiliadas(503, 'No pudimos comprobar el producto del material.')
  if (editar && previa.data?.producto_id && !Object.hasOwn(entrada.datos, 'producto_id')) throw new ErrorAfiliadas(409, 'Abrí la última versión del material para conservar su producto.')
  await comprobarProductoRecursoAfiliadas(auth, entrada.datos.producto_id ?? null)
  const esperada = editar ? Number(entrada.version) + 1 : 1
  const igual = (row: unknown): row is RecursoAfiliada => esRecursoAfiliada(row) && Object.hasOwn(row, 'producto_id') && row.id === entrada.id && row.version === esperada && recursoCoincideAfiliada(row, entrada.datos)
  if (igual(previa.data)) return dto(previa.data)
  if (previa.data && (!editar || previa.data.version !== entrada.version)) throw new ErrorAfiliadas(409, 'Otra administradora modificó el recurso. Abrí su última versión.')
  if (!previa.data && editar) throw new ErrorAfiliadas(404, 'El recurso ya no está disponible.')
  const query = editar ? auth.supabase.from('recursos_afiliadas').update(entrada.datos).eq('id', entrada.id).eq('version', entrada.version!)
    : auth.supabase.from('recursos_afiliadas').insert({ id: entrada.id, ...entrada.datos })
  const guardada = await query.select(CAMPOS).maybeSingle()
  if (!guardada.error && igual(guardada.data)) return dto(guardada.data)
  const confirmada = await leer()
  if (!confirmada.error && igual(confirmada.data)) return dto(confirmada.data)
  if (!guardada.error || confirmada.data && editar && confirmada.data.version !== entrada.version) throw new ErrorAfiliadas(409, 'El recurso cambió mientras guardabas. Revisá la última versión.')
  throw fallo(guardada.error)
}
export async function leerJsonAfiliadas(request: Request) {
  if (!origenSolicitudAfiliadas(request)) throw new ErrorAfiliadas(403, 'Solicitud no válida.')
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new ErrorAfiliadas(415, 'Usá una solicitud JSON válida.')
  if (Number(request.headers.get('content-length') || 0) > 65000) throw new ErrorAfiliadas(413, 'El recurso supera el tamaño permitido.')
  const reader = request.body?.getReader()
  if (!reader) throw new ErrorAfiliadas(400, 'El envío no es válido.')
  const partes: Uint8Array[] = []; let bytes = 0
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 65000) { await reader.cancel(); throw new ErrorAfiliadas(413, 'El recurso supera el tamaño permitido.') }; partes.push(chunk.value) }
    const buffer = new Uint8Array(bytes); let offset = 0
    for (const parte of partes) { buffer.set(parte, offset); offset += parte.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) as unknown
  } catch (error) { if (error instanceof ErrorAfiliadas) throw error; throw new ErrorAfiliadas(400, 'Revisá el contenido del envío.') }
  finally { reader.releaseLock() }
}
export function validarGuardadoAfiliadas(input: unknown, id?: string) {
  try {
    if (id) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2 || !Object.hasOwn(input, 'version') || !Object.hasOwn(input, 'recurso')) throw new Error('Solicitud no válida.')
      return validarEntradaAfiliada({ ...input, id }, true)
    }
    return validarEntradaAfiliada(input)
  } catch (error) { throw new ErrorAfiliadas(400, error instanceof Error ? error.message : 'Revisá el recurso.') }
}
