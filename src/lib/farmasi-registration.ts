export const RUTA_FARMASI = '/registro/farmasi'
export const DESTINO_INGRESO_FARMASI = '/login?next=%2Fregistro%2Ffarmasi'
export const FLUJO_FARMASI = 'farmasi'

export function destinoConfirmacion(flujo: string | null) {
  if (flujo === 'recovery' || flujo === 'invite') return '/crear-contrasena'
  return flujo === FLUJO_FARMASI ? RUTA_FARMASI : '/'
}

export function paginaSolicitudesFarmasi(valor: string | string[] | undefined) {
  return typeof valor === 'string' && /^[1-9][0-9]{0,3}$/.test(valor) ? Number(valor) : 1
}
