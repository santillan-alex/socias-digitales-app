import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { esIdAfiliadas, type DatosRecursoAfiliada } from './affiliate-hub'
import type { SesionAfiliadas } from './affiliate-hub-server'
import { analizarArchivoAfiliadasUrl, esArchivoAfiliadas, PARTE_ARCHIVO_AFILIADAS_BYTES, urlArchivoAfiliadas, validarArchivoAfiliadas, type ArchivoAfiliadas, type DatosArchivoAfiliadas } from './affiliate-files'
import { firmaArchivoMaterial } from './class-materials'
import { firmarParte, leerPartes, partesCompletas, pedirR2, r2Configurado, xmlEscape, xmlValue } from './r2-upload'

export class ErrorArchivoAfiliadas extends Error { constructor(public status: number, mensaje: string) { super(mensaje) } }
export interface CargaArchivoAfiliadas { userId: string; recursoId: string; archivoId: string; archivo: DatosArchivoAfiliadas; uploadId: string; exp: number }
const fallo = () => new ErrorArchivoAfiliadas(503, 'No pudimos comprobar el archivo. Conservá la carga e intentá nuevamente.')
const total = (s: CargaArchivoAfiliadas) => Math.ceil(s.archivo.bytes / PARTE_ARCHIVO_AFILIADAS_BYTES)
export function claveArchivoAfiliadas(recursoId: string, archivoId: string, extension: string) {
  if (!esIdAfiliadas(recursoId) || !esIdAfiliadas(archivoId) || !/^(pdf|docx|xlsx|pptx|txt|png|jpg|jpeg|webp|mp4)$/.test(extension)) throw new ErrorArchivoAfiliadas(400, 'Archivo no válido.')
  return `afiliadas/archivos/${recursoId}/${archivoId}.${extension}`
}
function claveIndice(recursoId: string, archivoId: string) {
  if (!esIdAfiliadas(recursoId) || !esIdAfiliadas(archivoId)) throw new ErrorArchivoAfiliadas(400, 'Archivo no válido.')
  return `afiliadas/indices/${recursoId}/${archivoId}.json`
}
function exigirAdmin(auth: SesionAfiliadas) {
  if (!auth.admin || !esIdAfiliadas(auth.userId)) throw new ErrorArchivoAfiliadas(403, 'Solo el equipo de Flor puede cargar archivos.')
  if (!r2Configurado()) throw new ErrorArchivoAfiliadas(503, 'La carga de archivos no está configurada.')
}
export function tokenArchivoAfiliadas(state: CargaArchivoAfiliadas) {
  const data = Buffer.from(JSON.stringify(state)).toString('base64url')
  return `${data}.${createHmac('sha256', process.env.R2_SECRET_ACCESS_KEY!).update('sd-afiliadas-archivo-v1:' + data).digest('base64url')}`
}
export function leerTokenArchivoAfiliadas(value: unknown, userId: string): CargaArchivoAfiliadas {
  try {
    if (typeof value !== 'string' || value.length > 5000 || !process.env.R2_SECRET_ACCESS_KEY) throw new Error()
    const [data, signature, ...extra] = value.split('.')
    if (!data || !signature || extra.length) throw new Error()
    const expected = createHmac('sha256', process.env.R2_SECRET_ACCESS_KEY).update('sd-afiliadas-archivo-v1:' + data).digest(), actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error()
    const s = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (!s || typeof s !== 'object' || Object.keys(s).length !== 6 || !esIdAfiliadas(s.userId) || s.userId !== userId || !esIdAfiliadas(s.recursoId) || !esIdAfiliadas(s.archivoId) || !Number.isSafeInteger(s.exp) || s.exp < Date.now() || s.exp > Date.now() + 12 * 60 * 60_000 + 60_000 || typeof s.uploadId !== 'string' || !s.uploadId || s.uploadId.length > 1500 || !s.archivo || Object.keys(s.archivo).length !== 4) throw new Error()
    const archivo = validarArchivoAfiliadas(s.archivo.nombre, s.archivo.bytes)
    if (!Object.entries(archivo).every(([k, v]) => s.archivo[k] === v)) throw new Error()
    return { userId: s.userId, recursoId: s.recursoId, archivoId: s.archivoId, archivo, uploadId: s.uploadId, exp: s.exp }
  } catch { throw new ErrorArchivoAfiliadas(400, 'La carga venció o no corresponde a esta administradora. Volvé a elegir el archivo.') }
}
async function bytesAcotados(response: Response, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body || Number(response.headers.get('content-length') ?? 0) > max) { await response.body?.cancel(); throw fallo() }
  const reader = response.body.getReader(), partes: Uint8Array[] = []; let bytes = 0
  try {
    for (;;) { const parte = await reader.read(); if (parte.done) break; bytes += parte.value.byteLength; if (bytes > max) { await reader.cancel(); throw fallo() }; partes.push(parte.value) }
  } finally { reader.releaseLock() }
  const output = new Uint8Array(bytes); let offset = 0
  for (const parte of partes) { output.set(parte, offset); offset += parte.byteLength }
  return output
}
async function textoR2(response: Response, max: number) { return new TextDecoder('utf-8', { fatal: true }).decode(await bytesAcotados(response, max)) }
export async function leerArchivoAfiliadas(recursoId: string, archivoId: string): Promise<ArchivoAfiliadas | null> {
  const response = await pedirR2('GET', claveIndice(recursoId, archivoId), {}, '', undefined, undefined, { sinCompresion: true, timeoutMs: 7000 })
  if (response.status === 404) return null
  if (!response.ok) throw fallo()
  const data = JSON.parse(await textoR2(response, 4096))
  if (!data || data.version !== 1 || !esIdAfiliadas(data.creadoraId) || typeof data.creadoEn !== 'string' || !Number.isFinite(Date.parse(data.creadoEn)) || !esArchivoAfiliadas(data.archivo) || data.archivo.id !== archivoId || data.archivo.recursoId !== recursoId) throw fallo()
  return data.archivo
}
function datosPublicos(s: CargaArchivoAfiliadas): ArchivoAfiliadas { return { id: s.archivoId, recursoId: s.recursoId, ...s.archivo, url: urlArchivoAfiliadas(s.recursoId, s.archivoId) } }
function igual(a: ArchivoAfiliadas, b: ArchivoAfiliadas) { return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k as keyof ArchivoAfiliadas] === v) }
async function objetoCompleto(s: CargaArchivoAfiliadas) {
  const response = await pedirR2('HEAD', claveArchivoAfiliadas(s.recursoId, s.archivoId, s.archivo.extension))
  if (response.status === 404) return false
  if (!response.ok) throw fallo()
  if (Number(response.headers.get('content-length')) !== s.archivo.bytes || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== s.archivo.mime) throw new ErrorArchivoAfiliadas(409, 'El archivo cargado no coincide con el tamaño o formato esperado.')
  return true
}
async function partesActuales(s: CargaArchivoAfiliadas) {
  const response = await pedirR2('GET', claveArchivoAfiliadas(s.recursoId, s.archivoId, s.archivo.extension), { uploadId: s.uploadId, 'max-parts': '1000' })
  if (response.status === 404) throw new ErrorArchivoAfiliadas(409, 'Esta carga ya no está disponible. Volvé a elegir el archivo.')
  if (!response.ok) throw fallo()
  const xml = await textoR2(response, 128_000)
  if (xmlValue(xml, 'IsTruncated') === 'true') throw fallo()
  const parts = leerPartes(xml)
  if (parts.length > total(s) || new Set(parts.map(p => p.number)).size !== parts.length || parts.some(p => !Number.isInteger(p.number) || p.number < 1 || p.number > total(s) || p.size !== Math.min(PARTE_ARCHIVO_AFILIADAS_BYTES, s.archivo.bytes - (p.number - 1) * PARTE_ARCHIVO_AFILIADAS_BYTES) || !/^"?[0-9a-f-]+"?$/i.test(p.etag))) throw new ErrorArchivoAfiliadas(409, 'Hay partes que no coinciden con el archivo elegido. Descartá esta carga y volvé a elegirlo.')
  return parts
}
async function comprobarFormato(s: CargaArchivoAfiliadas) {
  const ultimo = Math.min(31, s.archivo.bytes - 1)
  const response = await pedirR2('GET', claveArchivoAfiliadas(s.recursoId, s.archivoId, s.archivo.extension), {}, '', undefined, undefined, { rango: { inicio: 0, fin: ultimo }, sinCompresion: true })
  const longitud = ultimo + 1
  if (response.status !== 206 || response.headers.get('content-range') !== `bytes 0-${ultimo}/${s.archivo.bytes}`) { await response.body?.cancel(); throw fallo() }
  const bytes = await bytesAcotados(response, longitud)
  let valido = bytes.byteLength === longitud
  if (s.archivo.extension === 'mp4') valido = valido && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash|MSNV)$/.test(new TextDecoder().decode(bytes.slice(8, 12)))
  else if (s.archivo.extension === 'txt') {
    try { valido = valido && !new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: s.archivo.bytes > longitud }).includes('\0') } catch { valido = false }
  } else valido = valido && firmaArchivoMaterial(bytes, s.archivo.extension)
  if (!valido) throw new ErrorArchivoAfiliadas(400, 'El contenido no coincide con el formato del archivo. Elegí el documento original o un video MP4 compatible.')
}
export async function iniciarArchivoAfiliadas(auth: SesionAfiliadas, input: { recursoId: unknown; nombre: unknown; bytes: unknown }) {
  exigirAdmin(auth)
  if (!esIdAfiliadas(input.recursoId)) throw new ErrorArchivoAfiliadas(400, 'Recurso no válido.')
  let archivo: DatosArchivoAfiliadas
  try { archivo = validarArchivoAfiliadas(input.nombre, input.bytes) } catch (e) { throw new ErrorArchivoAfiliadas(400, e instanceof Error ? e.message : 'Archivo no válido.') }
  const recursoId = input.recursoId.toLowerCase(), archivoId = randomUUID()
  const response = await pedirR2('POST', claveArchivoAfiliadas(recursoId, archivoId, archivo.extension), { uploads: '' }, '', archivo.mime)
  if (!response.ok) throw fallo()
  const uploadId = xmlValue(await textoR2(response, 64_000), 'UploadId')
  if (!uploadId || uploadId.length > 1500) throw fallo()
  const state = { userId: auth.userId, recursoId, archivoId, archivo, uploadId, exp: Date.now() + 12 * 60 * 60_000 }
  return { token: tokenArchivoAfiliadas(state), parteBytes: PARTE_ARCHIVO_AFILIADAS_BYTES, totalPartes: total(state) }
}
export async function operarArchivoAfiliadas(auth: SesionAfiliadas, input: { action: 'firmar' | 'estado' | 'completar' | 'cancelar'; token: unknown; numero?: unknown }) {
  exigirAdmin(auth)
  if (!['firmar', 'estado', 'completar', 'cancelar'].includes(input.action)) throw new ErrorArchivoAfiliadas(400, 'Acción no válida.')
  const s = leerTokenArchivoAfiliadas(input.token, auth.userId), publico = datosPublicos(s)
  const previo = await leerArchivoAfiliadas(s.recursoId, s.archivoId)
  if (previo && !igual(previo, publico)) throw new ErrorArchivoAfiliadas(409, 'La información de este archivo cambió. Volvé a cargarlo.')
  if (input.action === 'completar' && previo) return { archivo: previo }
  if (input.action === 'cancelar') {
    if (!previo) {
      const response = await pedirR2('DELETE', claveArchivoAfiliadas(s.recursoId, s.archivoId, s.archivo.extension), { uploadId: s.uploadId })
      if (!response.ok && response.status !== 404) throw fallo()
    }
    return { ok: true }
  }
  if (input.action === 'estado') {
    if (previo || await objetoCompleto(s)) return { partes: Array.from({ length: total(s) }, (_, i) => i + 1) }
    return { partes: (await partesActuales(s)).map(p => p.number) }
  }
  if (input.action === 'firmar') {
    if (!Number.isInteger(input.numero) || Number(input.numero) < 1 || Number(input.numero) > total(s)) throw new ErrorArchivoAfiliadas(400, 'Parte no válida.')
    if (previo || await objetoCompleto(s)) throw new ErrorArchivoAfiliadas(409, 'El archivo ya se cargó. Comprobá su estado para finalizar.')
    return { url: firmarParte(claveArchivoAfiliadas(s.recursoId, s.archivoId, s.archivo.extension), s.uploadId, input.numero as number) }
  }
  if (!await objetoCompleto(s)) {
    const parts = await partesActuales(s)
    if (!partesCompletas(parts, s.archivo.bytes)) throw new ErrorArchivoAfiliadas(409, 'Faltan partes del archivo. Reintentá sin cerrar esta ventana.')
    const xml = `<CompleteMultipartUpload>${parts.map(p => `<Part><PartNumber>${p.number}</PartNumber><ETag>${xmlEscape(p.etag)}</ETag></Part>`).join('')}</CompleteMultipartUpload>`
    const response = await pedirR2('POST', claveArchivoAfiliadas(s.recursoId, s.archivoId, s.archivo.extension), { uploadId: s.uploadId }, xml, 'application/xml')
    if (!response.ok || (await textoR2(response, 64_000)).includes('<Error>')) throw fallo()
  }
  if (!await objetoCompleto(s)) throw fallo()
  await comprobarFormato(s)
  const body = JSON.stringify({ version: 1, archivo: publico, creadoraId: auth.userId, creadoEn: new Date().toISOString() })
  const saved = await pedirR2('PUT', claveIndice(s.recursoId, s.archivoId), {}, body, 'application/json', { 'If-None-Match': '*' })
  if (!saved.ok && saved.status !== 412) {
    const recuperado = await leerArchivoAfiliadas(s.recursoId, s.archivoId)
    if (recuperado && igual(recuperado, publico)) return { archivo: recuperado }
    throw fallo()
  }
  const confirmada = await leerArchivoAfiliadas(s.recursoId, s.archivoId)
  if (!confirmada || !igual(confirmada, publico)) throw fallo()
  return { archivo: confirmada }
}
export async function comprobarVinculoArchivoAfiliadas(recursoId: string, datos: DatosRecursoAfiliada) {
  const referencia = analizarArchivoAfiliadasUrl(datos.url)
  if (!referencia) {
    if (datos.url) { const url = new URL(datos.url); if (['app.sociasdigitales.com', 'flor.sociasdigitales.com'].includes(url.hostname) && url.pathname.startsWith('/api/afiliadas/')) throw new ErrorArchivoAfiliadas(400, 'El enlace de archivo no es válido.') }
    return
  }
  if (referencia.recursoId !== recursoId) throw new ErrorArchivoAfiliadas(400, 'Este archivo pertenece a otro recurso.')
  const archivo = await leerArchivoAfiliadas(recursoId, referencia.archivoId)
  if (!archivo) throw new ErrorArchivoAfiliadas(400, 'Terminá de subir el archivo antes de guardar el recurso.')
  if (datos.tipo !== (archivo.extension === 'mp4' ? 'video' : 'archivo')) throw new ErrorArchivoAfiliadas(400, 'El tipo de recurso no coincide con el archivo cargado.')
}
