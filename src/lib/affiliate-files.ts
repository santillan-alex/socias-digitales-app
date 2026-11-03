import { archivoMaterial, MAX_MATERIAL_BYTES, TIPOS_MATERIAL } from './class-materials'
import { esIdAfiliadas } from './affiliate-hub'

export const MAX_ARCHIVO_AFILIADAS_BYTES = MAX_MATERIAL_BYTES
export const MAX_VIDEO_AFILIADAS_BYTES = 1024 * 1024 * 1024
export const PARTE_ARCHIVO_AFILIADAS_BYTES = 16 * 1024 * 1024
export const ACEPTAR_ARCHIVOS_AFILIADAS = [...Object.keys(TIPOS_MATERIAL), 'mp4'].map(x => `.${x}`).join(',')
export interface DatosArchivoAfiliadas { nombre: string; bytes: number; mime: string; extension: keyof typeof TIPOS_MATERIAL | 'mp4' }
export interface ArchivoAfiliadas extends DatosArchivoAfiliadas { id: string; recursoId: string; url: string }

export function validarArchivoAfiliadas(nombre: unknown, bytes: unknown): DatosArchivoAfiliadas {
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(nombre)) throw new Error('Revisá el nombre del archivo.')
  try { encodeURIComponent(nombre) } catch { throw new Error('Revisá el nombre del archivo.') }
  const limpio = nombre.trim().normalize('NFC')
  if (/\.mp4$/i.test(limpio)) {
    if (!Number.isSafeInteger(bytes) || Number(bytes) <= 0 || Number(bytes) > MAX_VIDEO_AFILIADAS_BYTES) throw new Error('El video MP4 debe pesar hasta 1 GB y no estar vacío.')
    return { nombre: limpio, bytes: bytes as number, mime: 'video/mp4', extension: 'mp4' }
  }
  return archivoMaterial(limpio, bytes)
}
export function urlArchivoAfiliadas(recursoId: string, archivoId: string) {
  if (!esIdAfiliadas(recursoId) || !esIdAfiliadas(archivoId)) throw new Error('Archivo no válido.')
  return `https://app.sociasdigitales.com/api/afiliadas/${recursoId.toLowerCase()}/archivo/${archivoId.toLowerCase()}`
}
export function analizarArchivoAfiliadasUrl(value: unknown): { recursoId: string; archivoId: string } | null {
  if (typeof value !== 'string') return null
  const found = value.match(/^https:\/\/(?:app|flor)\.sociasdigitales\.com\/api\/afiliadas\/([0-9a-f-]{36})\/archivo\/([0-9a-f-]{36})$/)
  return found && esIdAfiliadas(found[1]) && esIdAfiliadas(found[2]) ? { recursoId: found[1], archivoId: found[2] } : null
}
export function esArchivoAfiliadas(value: unknown): value is ArchivoAfiliadas {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== 7 || !Object.keys(row).every(k => ['id', 'recursoId', 'nombre', 'bytes', 'mime', 'extension', 'url'].includes(k)) || !esIdAfiliadas(row.id) || !esIdAfiliadas(row.recursoId)) return false
  try {
    const datos = validarArchivoAfiliadas(row.nombre, row.bytes)
    return row.nombre === datos.nombre && row.mime === datos.mime && row.extension === datos.extension && row.url === urlArchivoAfiliadas(row.recursoId, row.id)
  } catch { return false }
}
