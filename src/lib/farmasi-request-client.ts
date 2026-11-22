import { RUTA_AULA_FARMASI, RUTA_FARMASI } from './farmasi-registration'

export async function registrarSolicitudFarmasi(): Promise<'pendiente' | 'habilitada'> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const respuesta = await fetch('/api/farmasi/solicitud', {
      method: 'POST', credentials: 'same-origin', signal: controller.signal,
    })
    const dato = await respuesta.json()
    if (!respuesta.ok || (dato?.estado !== 'pendiente' && dato?.estado !== 'habilitada'))
      throw new Error(typeof dato?.error === 'string' ? dato.error : 'No pudimos enviar la solicitud. Intentá de nuevo.')
    return dato.estado
  } finally {
    clearTimeout(timer)
  }
}

// Called only after successful auth from a form that describes the Farmasi intent.
// A rejected/offline request must never claim that Flor received it. The landing
// page independently checks persisted state and offers a manual retry if needed.
export async function continuarAutenticacionFarmasi() {
  try {
    return (await registrarSolicitudFarmasi()) === 'habilitada' ? RUTA_AULA_FARMASI : RUTA_FARMASI
  } catch {
    return RUTA_FARMASI
  }
}
