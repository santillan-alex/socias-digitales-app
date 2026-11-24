import 'server-only'
import { pedirR2 } from './r2-upload'
import { esUuid } from './class-management'
import { ErrorImportacionClase, objetoImportacion, validarConfiguracionConexion, validarManifestClase,
  MAX_CONEXIONES_CLASES, MAX_IMPORTACIONES_CONEXION, type ConfiguracionConexionClases, type ManifestClase } from './class-import'

export type ReferenciaImportacion = { id: string; bytes: number; creada: string; fingerprint: string }
export type ConexionClases = ConfiguracionConexionClases & {
  id: string; creadaPor: string; creada: string; vencimiento: string; revocada: string | null;
  tokenHash: string; importaciones: ReferenciaImportacion[]
}
export type ConfiguracionImportaciones = { version: 1; conexiones: ConexionClases[] }
export type TrabajoImportacion = {
  version: 1; id: string; conexionId: string; claseId: string; videoKey: string;
  programa: string; seccion: ConfiguracionConexionClases['seccion']; solo_farmaci: boolean;
  manifest: ManifestClase; estado: 'preparando' | 'cargando' | 'lista';
  uploadId: string | null; creada: string; actualizada: string
}
type Guardado<T> = { valor: T; revision: string | null }
const CONFIG = 'plataforma/importaciones-clases/config-v1.json'
const FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
export const esIdImportacion = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
function fecha(value: unknown): value is string { return typeof value === 'string' && FECHA.test(value) && Number.isFinite(Date.parse(value)) }
function validarConfig(value: unknown): value is ConfiguracionImportaciones {
  if (!objetoImportacion(value) || value.version !== 1 || !Array.isArray(value.conexiones) || value.conexiones.length > MAX_CONEXIONES_CLASES) return false
  const ids = new Set<string>()
  return value.conexiones.every((c: unknown) => {
    if (!objetoImportacion(c) || !validarConfiguracionConexion(c) || !esUuid(c.id) || ids.has(c.id) || !esUuid(c.creadaPor) ||
        !fecha(c.creada) || !fecha(c.vencimiento) || !(c.revocada === null || fecha(c.revocada)) ||
        typeof c.tokenHash !== 'string' || !/^[0-9a-f]{64}$/.test(c.tokenHash) || !Array.isArray(c.importaciones) || c.importaciones.length > MAX_IMPORTACIONES_CONEXION) return false
    ids.add(c.id)
    const trabajos = new Set<string>()
    return c.importaciones.every((r: unknown) => {
      if (!objetoImportacion(r) || !esIdImportacion(r.id) || trabajos.has(r.id) || !esIdImportacion(r.fingerprint) || !fecha(r.creada) || !Number.isSafeInteger(r.bytes) || (r.bytes as number) <= 0) return false
      trabajos.add(r.id); return true
    })
  })
}
function validarTrabajo(value: unknown): value is TrabajoImportacion {
  if (!objetoImportacion(value) || value.version !== 1 || !esIdImportacion(value.id) || !esUuid(value.conexionId) ||
      !esUuid(value.claseId) || !validarConfiguracionConexion({ nombre: 'Importación', programa: value.programa, seccion: value.seccion, solo_farmaci: value.solo_farmaci }) ||
      !validarManifestClase(value.manifest) || !fecha(value.creada) || !fecha(value.actualizada) ||
      !['preparando', 'cargando', 'lista'].includes(value.estado as string) ||
      !(value.uploadId === null || (typeof value.uploadId === 'string' && value.uploadId.length > 0 && value.uploadId.length <= 2000))) return false
  return typeof value.videoKey === 'string' && new RegExp(`^clases/${value.claseId}/[0-9a-f-]{36}\\.mp4$`).test(value.videoKey)
}
function claveTrabajo(id: string) {
  if (!esIdImportacion(id)) throw new ErrorImportacionClase(400, 'Importación no válida.')
  return `plataforma/importaciones-clases/trabajos/${id}.json`
}

async function leer<T>(key: string, validar: (value: unknown) => value is T): Promise<Guardado<T> | null> {
  const response = await pedirR2('GET', key, {}, '', undefined, undefined, { sinCompresion: true, timeoutMs: 8000 })
  if (response.status === 404) return null
  if (!response.ok) throw new ErrorImportacionClase(503, 'No pudimos leer las importaciones. Volvé a intentar.')
  if (Number(response.headers.get('content-length') || 0) > 512_000) throw new ErrorImportacionClase(503, 'La configuración de importación requiere revisión.')
  const body = await response.text()
  if (body.length > 512_000) throw new ErrorImportacionClase(503, 'La configuración de importación requiere revisión.')
  const value: unknown = JSON.parse(body)
  if (!validar(value)) throw new ErrorImportacionClase(503, 'La configuración de importación requiere revisión.')
  let revision = response.headers.get('etag')
  if (revision?.startsWith('W/')) {
    const head = await pedirR2('HEAD', key, {}, '', undefined, undefined, { sinCompresion: true, timeoutMs: 8000 })
    const strong = head.headers.get('etag')
    if (!head.ok || strong !== revision.slice(2)) throw new ErrorImportacionClase(409, 'La importación cambió. Reintentá.')
    revision = strong
  }
  if (!revision || !/^"[\x21\x23-\x7e]{1,200}"$/.test(revision)) throw new ErrorImportacionClase(503, 'No pudimos comprobar la versión de la importación.')
  return { valor: value, revision }
}
async function guardar<T>(key: string, valor: T, revision: string | null, validar: (value: unknown) => value is T) {
  if (!validar(valor) || (revision !== null && !/^"[\x21\x23-\x7e]{1,200}"$/.test(revision))) throw new ErrorImportacionClase(400, 'Datos de importación no válidos.')
  const body = JSON.stringify(valor)
  if (body.length > 512_000) throw new ErrorImportacionClase(413, 'La configuración alcanzó su límite.')
  const response = await pedirR2('PUT', key, {}, body, 'application/json', revision ? { 'If-Match': revision } : { 'If-None-Match': '*' }, { timeoutMs: 8000 })
  if (response.status === 412 || response.status === 409) throw new ErrorImportacionClase(409, 'La importación cambió. Reintentá sin crear otra clase.')
  if (!response.ok) throw new ErrorImportacionClase(503, 'No pudimos guardar la importación. Consultá su estado antes de reintentar.')
  const checked = await leer(key, validar)
  if (!checked || JSON.stringify(checked.valor) !== body) throw new ErrorImportacionClase(409, 'La importación cambió mientras guardabas. Consultá su estado.')
  return checked
}
export async function leerConfiguracionImportaciones(): Promise<Guardado<ConfiguracionImportaciones>> {
  return await leer(CONFIG, validarConfig) ?? { valor: { version: 1, conexiones: [] }, revision: null }
}
export const guardarConfiguracionImportaciones = (valor: ConfiguracionImportaciones, revision: string | null) => guardar(CONFIG, valor, revision, validarConfig)
export const leerTrabajoImportacion = (id: string) => leer(claveTrabajo(id), validarTrabajo)
export const guardarTrabajoImportacion = (valor: TrabajoImportacion, revision: string | null) => guardar(claveTrabajo(valor.id), valor, revision, validarTrabajo)
