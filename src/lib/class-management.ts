export const PROGRAMAS_INICIALES = [
  'Bienvenida',
  'Desafío Socias',
] as const
export const SECCIONES_CLASE = ['Clases', 'Material de apoyo'] as const
export type SeccionClase = typeof SECCIONES_CLASE[number]
const SEPARADOR_SECCION = ' › '

// Jerarquía compatible con el campo existente. Solo el apoyo lleva sufijo;
// los IDs, los permisos y el progreso de las clases no se modifican.
export function ubicacionClase(modulo: string) {
  const partes = modulo.split(SEPARADOR_SECCION)
  let programa = partes[0].trim()
  if (programa === 'Introducción') programa = 'Bienvenida'
  if (programa === 'Desafío Socias en vivo') programa = 'Desafío Socias'
  const seccion: SeccionClase = partes[1] === 'Material de apoyo' ? 'Material de apoyo' : 'Clases'
  return { programa, seccion }
}
export function clasificacionClase(programa: string, seccion: SeccionClase = 'Clases') {
  const nombre = programa.trim().replace(/\s+/g, ' ')
  if (!nombre || nombre.includes('›') || nombre.length > 75 || !SECCIONES_CLASE.includes(seccion)) return null
  return nombre + (seccion === 'Clases' ? '' : SEPARADOR_SECCION + seccion)
}
export function puedeEliminarProgramaLocal(nombre: string, programasLocales: readonly string[], clases: readonly { modulo: string }[]) {
  const clave = (valor: string) => valor.split(SEPARADOR_SECCION)[0].trim().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const protegidos = [...PROGRAMAS_INICIALES, 'Introducción', 'Desafío Socias en vivo', 'Socias', 'Socias Digitales', 'Farmasi', 'Socias Farmasi']
  const buscado = clave(nombre)
  return programasLocales.includes(nombre) && !protegidos.some(programa => clave(programa) === buscado) &&
    !clases.some(clase => clave(clase.modulo) === buscado)
}
export function ordenarClases<T extends { orden: number; id: string }>(clases: T[]) {
  return [...clases].sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id))
}
export const TAMANO_PARTE = 16 * 1024 * 1024
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024 * 1024
export const esUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function validarVideo(nombre: unknown, bytes: unknown) {
  return (
    typeof nombre === 'string' &&
    nombre.length <= 200 &&
    /\.mp4$/i.test(nombre) &&
    typeof bytes === 'number' &&
    Number.isSafeInteger(bytes) &&
    bytes > 0 &&
    bytes <= MAX_VIDEO_BYTES
  )
}
export function puedePublicarClase(ficha: {
  tieneVideo: boolean
  vimeo_url: string | null
  solo_farmaci?: boolean
}) {
  if (ficha.solo_farmaci) return ficha.tieneVideo
  return (
    ficha.tieneVideo ||
    /^https:\/\/(?:www\.)?vimeo\.com\/\d+(?:\/\w+)?$/.test(
      ficha.vimeo_url?.trim() ?? '',
    )
  )
}
export function datosClase(input: Record<string, unknown>) {
  const titulo = typeof input.titulo === 'string' ? input.titulo.trim() : ''
  const modulo =
    typeof input.modulo === 'string'
      ? input.modulo.trim().replace(/\s+/g, ' ')
      : ''
  const descripcion =
    typeof input.descripcion === 'string' ? input.descripcion.trim() : ''
  const orden = Number(input.orden)
  const vimeo_url =
    typeof input.vimeo_url === 'string' ? input.vimeo_url.trim() : ''
  if (
    !titulo ||
    titulo.length > 180 ||
    !modulo ||
    modulo.length > 100 ||
    descripcion.length > 3000 ||
    !Number.isInteger(orden) ||
    orden < 0 ||
    orden > 9999
  )
    return null
  if (modulo.includes('›')) {
    const partes = modulo.split(' › ')
    if (partes.length !== 2 || partes[0].includes('›') || partes[1] !== 'Material de apoyo' || !clasificacionClase(partes[0], 'Material de apoyo')) return null
  }
  if (input.solo_farmaci !== undefined && typeof input.solo_farmaci !== 'boolean') return null
  if (input.solo_farmaci === true && (input.acceso_gratuito === true || vimeo_url)) return null
  if (
    vimeo_url &&
    !/^https:\/\/(?:www\.)?vimeo\.com\/\d+(?:\/\w+)?$/.test(vimeo_url)
  )
    return null
  return {
    titulo,
    modulo,
    descripcion: descripcion || null,
    orden,
    vimeo_url: vimeo_url || null,
    activo: input.activo === true,
    acceso_gratuito: input.acceso_gratuito === true,
    ...(typeof input.solo_farmaci === 'boolean' ? { solo_farmaci: input.solo_farmaci } : {}),
  }
}
