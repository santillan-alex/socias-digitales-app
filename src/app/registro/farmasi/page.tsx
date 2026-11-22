import { createClient } from '@/lib/supabase/server'
import RegistroPage from '../page'
import SolicitarFarmasi from './SolicitarFarmasi'

export const metadata = { title: 'Socias Farmasi | Socias Digitales Academy' }

export default async function RegistroFarmasiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return <RegistroPage />
  if (!user.email_confirmed_at) return <SolicitarFarmasi inicial="sin_confirmar" />

  const { data: perfil, error } = await supabase.from('perfiles')
    .select('rol,estado,socias_farmaci_habilitada').eq('id', user.id).maybeSingle()
  if (error) return <SolicitarFarmasi inicial="error" />
  if (perfil?.rol === 'admin') return <SolicitarFarmasi inicial="admin" />
  if (perfil?.estado !== 'activa') return <SolicitarFarmasi inicial="inactiva" />
  if (perfil.socias_farmaci_habilitada) return <SolicitarFarmasi inicial="habilitada" />

  const solicitud = await supabase.from('solicitudes_socias_farmasi')
    .select('usuaria_id').eq('usuaria_id', user.id).maybeSingle()
    .then(resultado => ({ pendiente: Boolean(resultado.data), error: Boolean(resultado.error) }))
  return <SolicitarFarmasi inicial={solicitud.error ? 'error' : solicitud.pendiente ? 'pendiente' : 'lista'} />
}
