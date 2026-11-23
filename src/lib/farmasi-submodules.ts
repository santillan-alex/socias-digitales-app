import { esUuid } from './class-management'

export type SubmoduloFarmasi = { id: string; nombre: string; orden: number }

export type AccionFarmasi =
  | { accion: 'crear'; nombre: string }
  | { accion: 'mover'; id: string; direccion: 'arriba' | 'abajo' }
  | { accion: 'eliminar'; id: string }

export function validarAccionSubmoduloFarmasi(input: unknown): AccionFarmasi | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const data = input as Record<string, unknown>
  if (data.accion === 'crear' && Object.keys(data).length === 2 && typeof data.nombre === 'string') {
    if (/\p{C}/u.test(data.nombre)) return null
    const nombre = data.nombre.normalize('NFC').trim().replace(/\s+/g, ' ')
    return nombre && nombre.length <= 75 ? { accion: 'crear', nombre } : null
  }
  if (data.accion === 'eliminar' && Object.keys(data).length === 2 && esUuid(data.id))
    return { accion: 'eliminar', id: data.id.toLowerCase() }
  if (data.accion === 'mover' && Object.keys(data).length === 3 && esUuid(data.id) &&
    (data.direccion === 'arriba' || data.direccion === 'abajo'))
    return { accion: 'mover', id: data.id.toLowerCase(), direccion: data.direccion }
  return null
}

export function esListaSubmodulosFarmasi(input: unknown): input is SubmoduloFarmasi[] {
  return Array.isArray(input) && input.length <= 200 && input.every((dato, i) =>
    dato && typeof dato === 'object' && esUuid(dato.id) && typeof dato.nombre === 'string' &&
    dato.nombre.length > 0 && dato.nombre.length <= 75 && Number.isInteger(dato.orden) &&
    dato.orden >= 0 && (i === 0 || input[i - 1].orden < dato.orden)) &&
    new Set(input.map(dato => dato.id)).size === input.length
}
