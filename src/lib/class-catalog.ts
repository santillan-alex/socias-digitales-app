import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { claseParaCatalogo, incluirClaseEnCatalogo, tieneAccesoFarmaci, type PerfilClases } from '@/lib/class-access'
import { revisionMiniatura } from '@/lib/class-poster'

const CAMPOS = 'id,titulo,descripcion,orden,modulo,activo,acceso_gratuito,solo_farmaci,plan,video_key,vimeo_url' as const

// La vista ordinaria conserva tarjetas de clases bloqueadas. Las exclusivas de
// Farmaci se leen con RLS en la sesión de la alumna, nunca con service_role.
export async function leerCatalogoClases(perfil: PerfilClases) {
  const esAdmin = perfil.rol === 'admin'
  let consulta = createAdminClient().from('clases').select(CAMPOS).eq('activo', true)
  if (!esAdmin) consulta = consulta.eq('solo_farmaci', false)
  const { data, error } = await consulta.order('orden')
  if (error) throw new Error('No pudimos cargar las clases. Volvé a intentar.')

  let clases = data ?? []
  if (!esAdmin && tieneAccesoFarmaci(perfil)) {
    const supabase = await createClient()
    const exclusivas = await supabase.from('clases').select(CAMPOS).eq('activo', true).eq('solo_farmaci', true).order('orden')
    if (exclusivas.error) throw new Error('No pudimos cargar las clases. Volvé a intentar.')
    clases = clases.concat(exclusivas.data ?? [])
  }
  return clases.filter(clase => incluirClaseEnCatalogo(perfil, clase)).map(clase => {
    const catalogo = claseParaCatalogo(clase, perfil)
    return { ...catalogo, miniatura_revision: catalogo.puede_ver && clase.video_key ? revisionMiniatura(clase.video_key) : '' }
  })
}
