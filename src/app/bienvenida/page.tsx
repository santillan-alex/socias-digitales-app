import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { destinoTrasBienvenida } from '@/lib/farmasi-registration'
import BienvenidaCliente from './BienvenidaCliente'

export default async function BienvenidaPage({ searchParams }: { searchParams?: Promise<{ despues?: string | string[] }> }) {
  const destino = destinoTrasBienvenida((await searchParams)?.despues)
  const supabase = await createClient()
  const { data:{user} } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fbienvenida')
  const [{data:perfil,error:perfilError},{data:estado,error:estadoError}] = await Promise.all([
    supabase.from('perfiles').select('nombre,whatsapp,telefono,fecha_nacimiento,ocupacion,titulo_profesional,es_mama,ingresos_actuales,pais,provincia,avatar_url,rol').eq('id',user.id).maybeSingle(),
    supabase.from('bienvenida_perfiles').select('paso,completado_at').eq('usuaria_id',user.id).maybeSingle(),
  ])
  if (perfil?.rol === 'admin') redirect('/admin')
  if (estado?.completado_at) redirect(destino)
  if (perfilError || estadoError || !perfil) return <main className="min-h-screen bg-[#FAF7F3] p-8 text-[#171413]">No pudimos cargar tu perfil. Actualizá la página para volver a intentar.</main>
  return <BienvenidaCliente destino={destino} userId={user.id} datosIniciales={{...perfil,whatsapp:perfil.whatsapp ?? perfil.telefono}} pasoInicial={estado?.paso ?? 0} />
}
