import { clasificacionClase, SECCIONES_CLASE, validarVideo, type SeccionClase } from './class-management'

export const MAX_IMPORT_BODY_BYTES = 16_000
export const MAX_IMPORTACIONES_CONEXION = 200
export const MAX_BYTES_CONEXION = 200 * 1024 * 1024 * 1024
export const MAX_IMPORTACIONES_DIA = 10
export const MAX_CONEXIONES_CLASES = 20
export const DIAS_CONEXION_CLASES = 90

export type ConfiguracionConexionClases = { nombre: string; programa: string; seccion: SeccionClase; solo_farmaci: boolean }
export type ManifestClase = { fuenteId: string; titulo: string; descripcion: string; orden: number; nombre: string; bytes: number; sha256: string }
export type ResumenConexionClases = ConfiguracionConexionClases & {
  id: string; creada: string; vencimiento: string; revocada: string | null; importaciones: number
}
export type ResumenImportacionClase = {
  id: string; conexionId: string; claseId: string; titulo: string; programa: string; seccion: SeccionClase;
  solo_farmaci: boolean; estado: 'preparando' | 'cargando' | 'lista'; creada: string; actualizada: string
}

export class ErrorImportacionClase extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ErrorImportacionClase' }
}

export function objetoImportacion(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function texto(value: unknown, maximo: number) {
  return typeof value === 'string' && value.length <= maximo && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
}
export function validarConfiguracionConexion(value: unknown): ConfiguracionConexionClases | null {
  if (!objetoImportacion(value)) return null
  const nombre = typeof value.nombre === 'string' ? value.nombre.trim() : ''
  const programa = typeof value.programa === 'string' ? value.programa.trim().replace(/\s+/g, ' ') : ''
  const seccion = value.seccion as SeccionClase
  if (!nombre || !texto(nombre, 80) || !texto(programa, 75) || !SECCIONES_CLASE.includes(seccion) ||
      !clasificacionClase(programa, seccion) || typeof value.solo_farmaci !== 'boolean') return null
  return { nombre, programa, seccion, solo_farmaci: value.solo_farmaci }
}

// The connector chooses no audience, destination, publication state, URL or storage key.
export function validarManifestClase(value: unknown): ManifestClase | null {
  if (!objetoImportacion(value)) return null
  const permitidos = new Set(['action', 'fuenteId', 'titulo', 'descripcion', 'orden', 'nombre', 'bytes', 'sha256'])
  if (Object.keys(value).some(key => !permitidos.has(key))) return null
  const fuenteId = typeof value.fuenteId === 'string' ? value.fuenteId.trim() : ''
  const titulo = typeof value.titulo === 'string' ? value.titulo.trim() : ''
  const descripcion = value.descripcion === undefined ? '' : value.descripcion
  const nombre = value.nombre
  if (!fuenteId || !texto(fuenteId, 240) || /[\r\n]/.test(fuenteId) || !titulo || !texto(titulo, 180) ||
      !texto(descripcion, 3000) || typeof value.orden !== 'number' || !Number.isInteger(value.orden) ||
      value.orden < 0 || value.orden > 9999 || typeof nombre !== 'string' || /[\\/\r\n]/.test(nombre) ||
      !validarVideo(nombre, value.bytes) || typeof value.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.sha256)) return null
  return { fuenteId, titulo, descripcion: (descripcion as string).trim(), orden: value.orden, nombre, bytes: value.bytes as number, sha256: value.sha256 }
}

export async function leerJsonImportacion(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new ErrorImportacionClase(415, 'Usá una solicitud JSON; el video se carga por partes.')
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_IMPORT_BODY_BYTES))
    throw new ErrorImportacionClase(413, 'La solicitud es demasiado grande.')
  const reader = request.body?.getReader()
  if (!reader) throw new ErrorImportacionClase(400, 'Faltan los datos de la solicitud.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_IMPORT_BODY_BYTES) {
        await reader.cancel()
        throw new ErrorImportacionClase(413, 'La solicitud es demasiado grande.')
      }
      chunks.push(value)
    }
    const joined = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined))
    if (!objetoImportacion(value)) throw new Error('object')
    return value
  } catch (error) {
    if (error instanceof ErrorImportacionClase) throw error
    throw new ErrorImportacionClase(400, 'Los datos de la solicitud no son válidos.')
  } finally { reader.releaseLock() }
}
