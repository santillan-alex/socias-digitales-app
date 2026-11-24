import 'server-only'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createAdminClient, isAdminSupabaseConfigured } from './supabase/admin'
import { clasificacionClase, esUuid, TAMANO_PARTE } from './class-management'
import { firmarParte, leerPartes, partesCompletas, pedirR2, r2Configurado, xmlEscape, xmlValue } from './r2-upload'
import {
  DIAS_CONEXION_CLASES, ErrorImportacionClase, MAX_BYTES_CONEXION, MAX_CONEXIONES_CLASES,
  MAX_IMPORTACIONES_CONEXION, MAX_IMPORTACIONES_DIA, validarConfiguracionConexion, validarManifestClase,
  type ManifestClase, type ResumenConexionClases, type ResumenImportacionClase,
} from './class-import'
import {
  esIdImportacion, guardarConfiguracionImportaciones, guardarTrabajoImportacion, leerConfiguracionImportaciones, leerTrabajoImportacion,
  type ConfiguracionImportaciones, type ConexionClases, type TrabajoImportacion,
} from './class-import-store'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const camposClase = 'id,titulo,descripcion,modulo,orden,activo,acceso_gratuito,solo_farmaci,farmasi_submodulo_id,video_key,vimeo_url'
const ahora = () => new Date().toISOString()
const fallo = () => new ErrorImportacionClase(503, 'No pudimos comprobar la importación. Reintentá el mismo archivo.')
type BaseDatos = ReturnType<typeof createAdminClient>
type AuthConexion = { conexion: ConexionClases; admin: BaseDatos }
type ClaseImportada = {
  id: string; titulo: string; descripcion: string | null; modulo: string; orden: number; activo: boolean;
  acceso_gratuito: boolean; solo_farmaci: boolean; farmasi_submodulo_id: string | null; video_key: string | null; vimeo_url: string | null
}

function comprobarConfiguracion() {
  if (!r2Configurado() || !isAdminSupabaseConfigured())
    throw new ErrorImportacionClase(503, 'La importación automática todavía no está configurada.')
}
function resumenConexion(c: ConexionClases): ResumenConexionClases {
  return { id: c.id, nombre: c.nombre, programa: c.programa, seccion: c.seccion, solo_farmaci: c.solo_farmaci,
    creada: c.creada, vencimiento: c.vencimiento, revocada: c.revocada, importaciones: c.importaciones.length }
}
function resumenTrabajo(t: TrabajoImportacion): ResumenImportacionClase {
  return { id: t.id, conexionId: t.conexionId, claseId: t.claseId, titulo: t.manifest.titulo, programa: t.programa,
    seccion: t.seccion, solo_farmaci: t.solo_farmaci, estado: t.estado, creada: t.creada, actualizada: t.actualizada }
}
async function mutarConfiguracion(cambio: (config: ConfiguracionImportaciones) => void) {
  for (let intento = 0; intento < 4; intento++) {
    const actual = await leerConfiguracionImportaciones()
    cambio(actual.valor)
    try { return await guardarConfiguracionImportaciones(actual.valor, actual.revision) }
    catch (error) { if (!(error instanceof ErrorImportacionClase) || error.status !== 409 || intento === 3) throw error }
  }
  throw fallo()
}
async function comprobarCreadora(admin: BaseDatos, conexion: ConexionClases) {
  const { data, error } = await admin.from('perfiles').select('rol').eq('id', conexion.creadaPor).maybeSingle()
  if (error) throw fallo()
  if (data?.rol !== 'admin') throw new ErrorImportacionClase(403, 'Esta conexión ya no tiene una administradora habilitada.')
}
async function comprobarConexionVigente(auth: AuthConexion) {
  const config = await leerConfiguracionImportaciones()
  const actual = config.valor.conexiones.find(c => c.id === auth.conexion.id)
  if (!actual || actual.revocada || Date.parse(actual.vencimiento) <= Date.now() || actual.tokenHash !== auth.conexion.tokenHash)
    throw new ErrorImportacionClase(401, 'La conexión ya no está disponible.')
  await comprobarCreadora(auth.admin, actual)
}

export async function listarImportacionesClases() {
  comprobarConfiguracion()
  const config = await leerConfiguracionImportaciones()
  const referencias = config.valor.conexiones.flatMap(c => c.importaciones)
    .sort((a, b) => b.creada.localeCompare(a.creada)).slice(0, 20)
  const trabajos: ResumenImportacionClase[] = []
  let incompletas = false
  for (let i = 0; i < referencias.length; i += 4) {
    const lote = await Promise.allSettled(referencias.slice(i, i + 4).map(r => leerTrabajoImportacion(r.id)))
    for (const resultado of lote) {
      if (resultado.status === 'fulfilled' && resultado.value) trabajos.push(resumenTrabajo(resultado.value.valor))
      else incompletas = true
    }
  }
  return { conexiones: config.valor.conexiones.map(resumenConexion), importaciones: trabajos,
    ...(incompletas ? { advertencia: 'Algunas importaciones no pudieron comprobarse. Actualizá para volver a intentar.' } : {}) }
}

export async function crearConexionClases(input: unknown, administradora: string) {
  comprobarConfiguracion()
  const scope = validarConfiguracionConexion(input)
  if (!scope || !esUuid(administradora)) throw new ErrorImportacionClase(400, 'Revisá el nombre, programa y acceso de la conexión.')
  const id = randomUUID(), clave = `sdc_${id}_${randomBytes(32).toString('base64url')}`
  const creada = ahora()
  const conexion: ConexionClases = { ...scope, id, creadaPor: administradora, creada,
    vencimiento: new Date(Date.now() + DIAS_CONEXION_CLASES * 86400_000).toISOString(), revocada: null,
    tokenHash: digest(clave), importaciones: [] }
  await comprobarCreadora(createAdminClient(), conexion)
  await mutarConfiguracion(config => {
    if (config.conexiones.some(c => c.id === id)) return
    if (config.conexiones.length >= MAX_CONEXIONES_CLASES || config.conexiones.filter(c => !c.revocada && Date.parse(c.vencimiento) > Date.now()).length >= 10)
      throw new ErrorImportacionClase(409, 'Se alcanzó el límite de conexiones. Revisá las conexiones existentes.')
    config.conexiones.push(conexion)
  })
  return { conexion: resumenConexion(conexion), clave, endpoint: '/api/integraciones/clases' as const }
}

export async function revocarConexionClases(id: unknown) {
  comprobarConfiguracion()
  if (!esUuid(id)) throw new ErrorImportacionClase(400, 'Conexión no válida.')
  await mutarConfiguracion(config => {
    const conexion = config.conexiones.find(c => c.id === id)
    if (!conexion) throw new ErrorImportacionClase(404, 'No encontramos esa conexión.')
    conexion.revocada ??= ahora()
  })
  return { ok: true }
}

export async function autorizarConexionClases(request: Request): Promise<AuthConexion> {
  // Machine credentials are never accepted from a browser origin or a cookie.
  if (request.headers.has('origin')) throw new ErrorImportacionClase(403, 'Usá el conector de clases para esta operación.')
  const authorization = request.headers.get('authorization') ?? ''
  const match = /^Bearer (sdc_([0-9a-f-]{36})_[A-Za-z0-9_-]{43})$/.exec(authorization)
  if (!match || !esUuid(match[2])) throw new ErrorImportacionClase(401, 'La conexión de clases no está autorizada.')
  comprobarConfiguracion()
  const config = await leerConfiguracionImportaciones()
  const conexion = config.valor.conexiones.find(c => c.id === match[2])
  const expected = Buffer.from(conexion?.tokenHash ?? '0'.repeat(64), 'hex')
  const given = Buffer.from(digest(match[1]), 'hex')
  if (!timingSafeEqual(expected, given) || !conexion || conexion.revocada || Date.parse(conexion.vencimiento) <= Date.now())
    throw new ErrorImportacionClase(401, 'La conexión de clases no está autorizada o venció.')
  const admin = createAdminClient()
  await comprobarCreadora(admin, conexion)
  return { conexion, admin }
}

function comprobarMismoManifest(trabajo: TrabajoImportacion, manifest: ManifestClase, conexion: ConexionClases) {
  if (trabajo.conexionId !== conexion.id || JSON.stringify(trabajo.manifest) !== JSON.stringify(manifest) ||
      trabajo.programa !== conexion.programa || trabajo.seccion !== conexion.seccion || trabajo.solo_farmaci !== conexion.solo_farmaci)
    throw new ErrorImportacionClase(409, 'Ya existe una importación distinta con ese identificador de origen. Revisala en el panel.')
}
async function reservarTrabajo(conexion: ConexionClases, manifest: ManifestClase) {
  const id = digest(`${conexion.id}\0${manifest.fuenteId}`)
  const fingerprint = digest(JSON.stringify(manifest))
  // Reserve quota first: an exhausted/revoked connector cannot mint orphan job objects.
  const config = await mutarConfiguracion(config => {
    const actual = config.conexiones.find(c => c.id === conexion.id)
    if (!actual || actual.revocada || Date.parse(actual.vencimiento) <= Date.now()) throw new ErrorImportacionClase(401, 'La conexión ya no está disponible.')
    const previa = actual.importaciones.find(r => r.id === id)
    if (previa) {
      if (previa.fingerprint !== fingerprint || previa.bytes !== manifest.bytes)
        throw new ErrorImportacionClase(409, 'Ya existe una importación distinta con ese identificador de origen. Revisala en el panel.')
      return
    }
    const hoy = ahora().slice(0, 10)
    if (actual.importaciones.length >= MAX_IMPORTACIONES_CONEXION ||
        actual.importaciones.reduce((total, r) => total + r.bytes, 0) + manifest.bytes > MAX_BYTES_CONEXION ||
        actual.importaciones.filter(r => r.creada.startsWith(hoy)).length >= MAX_IMPORTACIONES_DIA)
      throw new ErrorImportacionClase(429, 'La conexión alcanzó su límite de importaciones. Revisala con el equipo de Flor.')
    actual.importaciones.push({ id, bytes: manifest.bytes, creada: ahora(), fingerprint })
  })
  const referencia = config.valor.conexiones.find(c => c.id === conexion.id)!.importaciones.find(r => r.id === id)!
  let guardado = await leerTrabajoImportacion(id)
  if (!guardado) {
    const creada = referencia.creada, claseId = randomUUID()
    const trabajo: TrabajoImportacion = { version: 1, id, conexionId: conexion.id, claseId,
      videoKey: `clases/${claseId}/${randomUUID()}.mp4`, programa: conexion.programa, seccion: conexion.seccion,
      solo_farmaci: conexion.solo_farmaci, manifest, estado: 'preparando', uploadId: null, creada, actualizada: creada }
    try { guardado = await guardarTrabajoImportacion(trabajo, null) }
    catch (error) {
      if (!(error instanceof ErrorImportacionClase) || error.status !== 409) throw error
      guardado = await leerTrabajoImportacion(id)
      if (!guardado) throw fallo()
    }
  }
  comprobarMismoManifest(guardado.valor, manifest, conexion)
  return guardado
}

async function leerClase(auth: AuthConexion, trabajo: TrabajoImportacion) {
  const result = await auth.admin.from('clases').select(camposClase).eq('id', trabajo.claseId).maybeSingle()
  if (result.error) throw fallo()
  return result.data as ClaseImportada | null
}
function esBorradorPropio(clase: ClaseImportada, trabajo: TrabajoImportacion) {
  return !clase.activo && !clase.acceso_gratuito && clase.solo_farmaci === trabajo.solo_farmaci &&
    clase.farmasi_submodulo_id === null && clase.video_key === null && clase.vimeo_url === null &&
    clase.modulo === clasificacionClase(trabajo.programa, trabajo.seccion) &&
    clase.titulo === trabajo.manifest.titulo && clase.descripcion === (trabajo.manifest.descripcion || null) && clase.orden === trabajo.manifest.orden
}
const conflictoClase = () => new ErrorImportacionClase(409, 'La clase cambió en el panel. La importación no reemplazará esos cambios.')
async function asegurarBorrador(auth: AuthConexion, trabajo: TrabajoImportacion) {
  let clase = await leerClase(auth, trabajo)
  if (trabajo.estado === 'lista' && clase?.video_key !== trabajo.videoKey) throw conflictoClase()
  if (!clase && trabajo.estado !== 'preparando') throw conflictoClase()
  if (!clase) {
    await comprobarConexionVigente(auth)
    const result = await auth.admin.from('clases').insert({ id: trabajo.claseId, titulo: trabajo.manifest.titulo,
      descripcion: trabajo.manifest.descripcion || null, modulo: clasificacionClase(trabajo.programa, trabajo.seccion),
      orden: trabajo.manifest.orden, activo: false, acceso_gratuito: false, solo_farmaci: trabajo.solo_farmaci,
      farmasi_submodulo_id: null, vimeo_url: null, plan: '27' })
    if (result.error && result.error.code !== '23505') throw fallo()
    clase = await leerClase(auth, trabajo)
  }
  if (!clase) throw fallo()
  if (clase.video_key === trabajo.videoKey) return clase
  if (!esBorradorPropio(clase, trabajo)) throw conflictoClase()
  return clase
}

async function trabajoAutorizado(auth: AuthConexion, id: unknown) {
  if (!esIdImportacion(id)) throw new ErrorImportacionClase(400, 'Importación no válida.')
  const guardado = await leerTrabajoImportacion(id)
  if (!guardado || guardado.valor.conexionId !== auth.conexion.id || !auth.conexion.importaciones.some(r => r.id === id))
    throw new ErrorImportacionClase(404, 'No encontramos esa importación en esta conexión.')
  return guardado
}
async function leerPartesTrabajo(trabajo: TrabajoImportacion) {
  if (!trabajo.uploadId || trabajo.estado === 'lista') return []
  const response = await pedirR2('GET', trabajo.videoKey, { uploadId: trabajo.uploadId, 'max-parts': '1000' })
  if (!response.ok) throw fallo()
  return leerPartes(await response.text())
}
async function respuestaTrabajo(trabajo: TrabajoImportacion) {
  const partes = await leerPartesTrabajo(trabajo)
  const numeros = partes.filter(p => Number.isInteger(p.number) && p.number >= 1 && p.number <= Math.ceil(trabajo.manifest.bytes / TAMANO_PARTE) &&
    p.size === Math.min(TAMANO_PARTE, trabajo.manifest.bytes - (p.number - 1) * TAMANO_PARTE) && /^"?[0-9a-f-]+"?$/i.test(p.etag)).map(p => p.number)
  return { importacion: resumenTrabajo(trabajo), partSize: TAMANO_PARTE, partes: numeros }
}
async function marcarLista(trabajo: TrabajoImportacion, revision: string | null) {
  if (trabajo.estado === 'lista') return trabajo
  const lista: TrabajoImportacion = { ...trabajo, estado: 'lista', actualizada: ahora() }
  try { return (await guardarTrabajoImportacion(lista, revision)).valor }
  catch (error) {
    if (!(error instanceof ErrorImportacionClase) || error.status !== 409) throw error
    const actual = await leerTrabajoImportacion(trabajo.id)
    if (actual?.valor.estado === 'lista' && actual.valor.videoKey === trabajo.videoKey) return actual.valor
    throw error
  }
}

export async function procesarImportacionClase(auth: AuthConexion, input: Record<string, unknown>) {
  if (input.action === 'iniciar') {
    const manifest = validarManifestClase(input)
    if (!manifest) throw new ErrorImportacionClase(400, 'Revisá los datos del archivo y de la clase.')
    const guardado = await reservarTrabajo(auth.conexion, manifest)
    const trabajo = guardado.valor
    const clase = await asegurarBorrador(auth, trabajo)
    if (clase.video_key === trabajo.videoKey) return respuestaTrabajo(await marcarLista(trabajo, guardado.revision))
    if (!trabajo.uploadId) {
      const response = await pedirR2('POST', trabajo.videoKey, { uploads: '' }, '', 'video/mp4')
      const uploadId = xmlValue(await response.text(), 'UploadId')
      if (!response.ok || !uploadId || uploadId.length > 2000) throw fallo()
      const cargando: TrabajoImportacion = { ...trabajo, uploadId, estado: 'cargando', actualizada: ahora() }
      try { return respuestaTrabajo((await guardarTrabajoImportacion(cargando, guardado.revision)).valor) }
      catch (error) {
        // Only abort the losing multipart session, never a video or another upload.
        if (error instanceof ErrorImportacionClase && error.status === 409) {
          const actual = await leerTrabajoImportacion(trabajo.id)
          if (actual?.valor.uploadId && actual.valor.uploadId !== uploadId) {
            try { await pedirR2('DELETE', trabajo.videoKey, { uploadId }, '', undefined, undefined, { timeoutMs: 2000 }) } catch { /* Conserved for storage review. */ }
            return respuestaTrabajo(actual.valor)
          }
        }
        throw error
      }
    }
    return respuestaTrabajo(trabajo)
  }
  if (Object.keys(input).some(k => !['action', 'id', 'numero'].includes(k))) throw new ErrorImportacionClase(400, 'Solicitud de importación no válida.')
  const guardado = await trabajoAutorizado(auth, input.id), trabajo = guardado.valor
  if (input.action === 'estado') return respuestaTrabajo(trabajo)
  if (!['parte', 'finalizar'].includes(input.action as string)) throw new ErrorImportacionClase(400, 'Acción no válida.')
  const clase = await leerClase(auth, trabajo)
  if (!clase) throw new ErrorImportacionClase(409, 'La clase ya no está disponible en el panel.')
  if (clase.video_key === trabajo.videoKey) return respuestaTrabajo(await marcarLista(trabajo, guardado.revision))
  if (trabajo.estado === 'lista') throw conflictoClase()
  if (!esBorradorPropio(clase, trabajo)) throw conflictoClase()
  if (!trabajo.uploadId) throw new ErrorImportacionClase(409, 'La carga todavía no se inició. Reintentá el mismo archivo.')
  if (input.action === 'parte') {
    if (!Number.isInteger(input.numero) || (input.numero as number) < 1 || (input.numero as number) > Math.ceil(trabajo.manifest.bytes / TAMANO_PARTE))
      throw new ErrorImportacionClase(400, 'Parte del video no válida.')
    const bytesParte = Math.min(TAMANO_PARTE, trabajo.manifest.bytes - ((input.numero as number) - 1) * TAMANO_PARTE)
    return { url: firmarParte(trabajo.videoKey, trabajo.uploadId, input.numero as number, bytesParte) }
  }
  const head = await pedirR2('HEAD', trabajo.videoKey)
  if (!head.ok) {
    if (head.status !== 404) throw fallo()
    const partes = await leerPartesTrabajo(trabajo)
    if (!partesCompletas(partes, trabajo.manifest.bytes)) throw new ErrorImportacionClase(409, 'Faltan partes del video. Reintentá la misma importación.')
    const body = `<CompleteMultipartUpload>${partes.map(p => `<Part><PartNumber>${p.number}</PartNumber><ETag>${xmlEscape(p.etag)}</ETag></Part>`).join('')}</CompleteMultipartUpload>`
    const response = await pedirR2('POST', trabajo.videoKey, { uploadId: trabajo.uploadId }, body, 'application/xml')
    if (!response.ok || (await response.text()).includes('<Error>')) throw fallo()
  }
  const verified = await pedirR2('HEAD', trabajo.videoKey)
  if (!verified.ok || Number(verified.headers.get('content-length')) !== trabajo.manifest.bytes || verified.headers.get('content-type')?.split(';')[0] !== 'video/mp4')
    throw new ErrorImportacionClase(409, 'El archivo recibido no coincide con el video esperado.')
  const prefix = await pedirR2('GET', trabajo.videoKey, {}, '', undefined, undefined, { rango: { inicio: 0, fin: 31 } })
  const bytes = new Uint8Array(await prefix.arrayBuffer())
  if (!prefix.ok || bytes.length < 12 || String.fromCharCode(...bytes.subarray(4, 8)) !== 'ftyp')
    throw new ErrorImportacionClase(409, 'El archivo recibido no tiene una cabecera MP4 válida.')
  await comprobarConexionVigente(auth)
  let update = auth.admin.from('clases').update({ video_key: trabajo.videoKey, vimeo_url: null })
    .eq('id', trabajo.claseId).eq('activo', false).eq('acceso_gratuito', false).eq('solo_farmaci', trabajo.solo_farmaci)
    .eq('titulo', trabajo.manifest.titulo).eq('modulo', clasificacionClase(trabajo.programa, trabajo.seccion)!)
    .eq('orden', trabajo.manifest.orden).is('video_key', null).is('vimeo_url', null).is('farmasi_submodulo_id', null)
  update = trabajo.manifest.descripcion ? update.eq('descripcion', trabajo.manifest.descripcion) : update.is('descripcion', null)
  const saved = await update.select('id').maybeSingle()
  if (saved.error) throw fallo()
  if (!saved.data) {
    const actual = await leerClase(auth, trabajo)
    if (actual?.video_key !== trabajo.videoKey) throw conflictoClase()
  }
  return respuestaTrabajo(await marcarLista(trabajo, guardado.revision))
}
