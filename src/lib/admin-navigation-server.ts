import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import { FILTRO_CUENTAS_PRUEBA } from './test-accounts'
import type { AdminNavigationData } from './admin-navigation'

export type LecturaNavegacionAdmin = { estado: 'lista'; datos: AdminNavigationData } | { estado: 'error'; status: 401 | 403 | 503; mensaje: string }
// La navegación refleja la sesión propia. Las páginas y APIs mantienen sus guardas.
export async function leerNavegacionAdmin(): Promise<LecturaNavegacionAdmin> {
  try {
    const supabase = await createClient(), { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { estado: 'error', status: 401, mensaje: 'Iniciá sesión para entrar al panel.' }
    const perfil = await supabase.from('perfiles').select('id,nombre,rol').eq('id', user.id).maybeSingle()
    if (perfil.error || !perfil.data || perfil.data.id !== user.id) return { estado: 'error', status: 503, mensaje: 'No pudimos comprobar tu acceso al panel.' }
    if (perfil.data.rol !== 'admin') return { estado: 'error', status: 403, mensaje: 'Este panel está reservado al equipo de Flor.' }
    let solicitudesPendientes: number | null = null
    try {
      const pendientes = await supabase.from('perfiles').select('id', { count: 'exact', head: true })
        .not('id', 'in', FILTRO_CUENTAS_PRUEBA).neq('rol', 'admin').eq('tipo_usuario', 'desafio')
        .eq('desafio_socias_estado', 'pendiente').eq('desafio_socias_habilitada', false)
      if (!pendientes.error && Number.isSafeInteger(pendientes.count) && Number(pendientes.count) >= 0) solicitudesPendientes = pendientes.count
    } catch (cause) { unstable_rethrow(cause) }
    const nombre = typeof perfil.data.nombre === 'string' && perfil.data.nombre.trim() ? perfil.data.nombre.trim().split(/\s+/)[0] : 'Administradora'
    return { estado: 'lista', datos: { nombre, solicitudesPendientes } }
  } catch (cause) { unstable_rethrow(cause); return { estado: 'error', status: 503, mensaje: 'No pudimos comprobar tu acceso al panel.' } }
}
