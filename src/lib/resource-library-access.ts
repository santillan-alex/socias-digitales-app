import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import type { PerfilClases } from './class-access'

type AccesoRecursos = { perfil: PerfilClases } | { error: { status: 401 | 403 | 503; mensaje: string } }

// No recibe identidad ni tipo de cuenta del navegador. El lector posterior
// limita el catálogo y cada apertura conserva la autorización por clase.
export async function autorizarBibliotecaRecursos(): Promise<AccesoRecursos> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: errorSesion } = await supabase.auth.getUser()
    if (errorSesion || !user) return { error: { status: 401, mensaje: 'Iniciá sesión para ver tus materiales.' } }
    const { data: perfil, error } = await supabase.from('perfiles')
      .select('id,rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id', user.id).maybeSingle()
    if (error || !perfil || perfil.id !== user.id) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso. Tus datos no se modificaron.' } }
    if (perfil.rol === 'admin') return { error: { status: 403, mensaje: 'Gestioná los materiales desde el panel de clases de Flor.' } }
    return { perfil }
  } catch (error) {
    // cookies() y las lecturas dinámicas tienen señales propias de Next.
    // No convertir la salida de prerender en un fallo de acceso de la alumna.
    unstable_rethrow(error)
    console.error('resource_library_access_failed')
    return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso. Volvé a intentar.' } }
  }
}
