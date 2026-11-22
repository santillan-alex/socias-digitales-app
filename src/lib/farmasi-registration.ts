export const RUTA_FARMASI = '/registro/farmasi'
export const DESTINO_INGRESO_FARMASI = '/login?next=%2Fregistro%2Ffarmasi'
export const FLUJO_FARMASI = 'farmasi'
export const RUTA_AULA_FARMASI = '/classroom?espacio=farmasi'
export const RUTA_BIENVENIDA_FARMASI = '/bienvenida?despues=farmasi'

export function destinoTrasBienvenida(marcador: string | string[] | undefined) {
  return marcador === FLUJO_FARMASI ? RUTA_AULA_FARMASI : '/inicio'
}

export function soloClasesFarmasi<T extends { activo: boolean; solo_farmaci?: boolean; puede_ver?: boolean }>(clases: T[]) {
  return clases.filter(clase => clase.activo && clase.solo_farmaci === true && clase.puede_ver === true)
}

export function destinoConfirmacion(flujo: string | null) {
  if (flujo === 'recovery' || flujo === 'invite') return '/crear-contrasena'
  return flujo === FLUJO_FARMASI ? RUTA_FARMASI : '/'
}

export function paginaSolicitudesFarmasi(valor: string | string[] | undefined) {
  return typeof valor === 'string' && /^[1-9][0-9]{0,3}$/.test(valor) ? Number(valor) : 1
}
