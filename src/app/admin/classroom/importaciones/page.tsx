import { redirect } from 'next/navigation'
import { autorizarAdmin } from '@/lib/admin-auth'
import { PROGRAMAS_INICIALES, ubicacionClase } from '@/lib/class-management'
import ClassImportsAdmin from './ClassImportsAdmin'

export default async function ClassImportsPage() {
  const auth = await autorizarAdmin()
  if (auth.error) redirect(auth.error.status === 401 ? '/login?next=%2Fadmin%2Fclassroom%2Fimportaciones' : '/inicio')
  const { data } = await auth.supabase.from('clases').select('modulo').limit(1000)
  const programas = [...new Set([...PROGRAMAS_INICIALES, ...(data ?? []).map(clase => ubicacionClase(clase.modulo).programa)])]
  return <ClassImportsAdmin programas={programas} />
}
