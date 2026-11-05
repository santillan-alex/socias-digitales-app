import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FILTRO_CUENTAS_PRUEBA } from '@/lib/test-accounts'
import AdminLanzamientoCliente from '../AdminLanzamientoCliente'

export const metadata = { title: 'Datos comerciales anteriores' }
export default async function HistoricoLanzamientoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle()
  if (perfil?.rol !== 'admin') redirect('/inicio')
  const [{ data: metricas, error: errorMetricas, count: cantidadMetricas }, { data: afiliadas, error: errorAfiliadas, count: cantidadAfiliadas }] = await Promise.all([
    supabase.from('metricas_lanzamiento').select('*, perfiles(nombre, email, instagram, pais, telefono, created_at)', { count: 'exact' }).not('alumna_id', 'in', FILTRO_CUENTAS_PRUEBA).order('actualizado_en', { ascending: false }).limit(1000),
    supabase.from('perfiles').select('id, nombre, email, instagram, pais, telefono, created_at', { count: 'exact' }).eq('rol', 'afiliada_lanzamiento').not('id', 'in', FILTRO_CUENTAS_PRUEBA).order('created_at', { ascending: false }).limit(1000),
  ])
  return <div><aside className="m-4 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5 text-sm leading-6 sm:m-8"><h1 className="text-xl font-semibold">Datos comerciales anteriores</h1><p className="mt-2">Conservamos el registro del lanzamiento anterior. Esta vista no representa el seguimiento de clases ni a todas las Socias o Afiliadas actuales.</p><Link href="/admin/lanzamiento" className="mt-3 inline-flex min-h-11 items-center font-semibold text-[#294A38] underline underline-offset-4">Volver a Avances de las alumnas</Link></aside>{errorMetricas || errorAfiliadas || cantidadMetricas === null || cantidadMetricas !== metricas?.length || cantidadAfiliadas === null || cantidadAfiliadas !== afiliadas?.length ? <p role="alert" className="m-4 rounded-2xl border border-[#EC9BB6] p-5 sm:m-8">No pudimos comprobar los registros anteriores. Volvé a cargar esta página para reintentar.</p> : <AdminLanzamientoCliente metricas={metricas ?? []} afiliadas={afiliadas ?? []} />}</div>
}
