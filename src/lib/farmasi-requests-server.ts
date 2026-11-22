import 'server-only'

import type { SolicitudesFarmasi } from '@/app/admin/invitar/FarmasiSolicitudes'
import { esUuid } from './class-management'
import { autorizarAdmin } from './admin-auth'
import { createAdminClient } from './supabase/admin'

type Admin = Extract<Awaited<ReturnType<typeof autorizarAdmin>>, { user: unknown }>
const LIMITE_SOLICITUDES = 50

export async function solicitudesFarmasi(auth: Admin, pagina: number): Promise<SolicitudesFarmasi> {
  const desde = (pagina - 1) * LIMITE_SOLICITUDES
  try {
    const { data, error } = await auth.supabase
      .from('solicitudes_socias_farmasi')
      .select('usuaria_id,solicitada_at,perfil:perfiles!inner(nombre,estado)')
      .order('solicitada_at').order('usuaria_id').range(desde, desde + LIMITE_SOLICITUDES)
    if (error || !data) return null
    if (!data.length) return { filas: [], hayMas: false, pagina }
    const lote = data.slice(0, LIMITE_SOLICITUDES)
    if (lote.some(fila => !esUuid(fila.usuaria_id) || !Number.isFinite(Date.parse(fila.solicitada_at)))) return null
    // Fetch only the identities actually in this limited queue. Do not list the whole Auth directory.
    const admin = createAdminClient()
    const filas = []
    for (let i = 0; i < lote.length; i += 10) {
      const parte = await Promise.all(lote.slice(i, i + 10).map(async fila => {
        const perfil = Array.isArray(fila.perfil) ? fila.perfil[0] : fila.perfil
        const { data: identidad, error: errorIdentidad } = await admin.auth.admin.getUserById(fila.usuaria_id)
        const usuaria = !errorIdentidad && identidad?.user?.id === fila.usuaria_id ? identidad.user : null
        return { id: fila.usuaria_id, nombre: perfil?.nombre || 'Alumna',
          email: usuaria?.email || 'Correo no disponible', fecha: fila.solicitada_at,
          activa: perfil?.estado === 'activa' && Boolean(usuaria?.email_confirmed_at && usuaria.email && !usuaria.is_anonymous) }
      }))
      filas.push(...parte)
    }
    return { hayMas: data.length > LIMITE_SOLICITUDES, filas, pagina }
  } catch {
    return null
  }
}
