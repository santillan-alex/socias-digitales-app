import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClassroomAdmin from './ClassroomAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { CUENTAS_PRUEBA_IDS, FILTRO_CUENTAS_PRUEBA } from '@/lib/test-accounts'
import { esListaSubmodulosFarmasi } from '@/lib/farmasi-submodules'

export default async function ClassroomAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') redirect('/perfil')

  const admin = createAdminClient()
  const [{ data: clases, error: clasesError }, { data: alumnas, error: alumnasError },
    { data: estadisticas, error: progresoError }, { data: submodulos, error: submodulosError }] = await Promise.all([
    supabase.from('clases').select('*').order('orden'),
    supabase.from('perfiles').select('id, nombre, plan').neq('rol', 'admin').not('id', 'in', FILTRO_CUENTAS_PRUEBA).order('nombre'),
    admin.rpc('estadisticas_progreso_clases', { p_excluir: [...CUENTAS_PRUEBA_IDS] }),
    admin.from('farmasi_submodulos').select('id,nombre,orden').order('orden').order('id').limit(201),
  ])

  const listaSubmodulos = !submodulosError && esListaSubmodulosFarmasi(submodulos) ? submodulos : null
  return <ClassroomAdmin clases={clases ?? []} alumnas={alumnas ?? []} errorCarga={Boolean(clasesError || alumnasError)}
    estadisticas={estadisticas ?? []} errorProgreso={Boolean(progresoError)}
    submodulos={listaSubmodulos ?? []} errorSubmodulos={!listaSubmodulos} />
}
