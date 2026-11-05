import { redirect } from 'next/navigation'
import { autorizarSeguimientoFormacion, leerSeguimientoFormacion } from '@/lib/admin-learning-progress-server'
import { esUuid } from '@/lib/class-management'
import AvancesFormacion from './AvancesFormacion'

export const metadata = { title: 'Avances de las alumnas' }

export default async function AvancesPage({ searchParams }: { searchParams?: Promise<{ clase?: string | string[] }> } = {}) {
  const auth = await autorizarSeguimientoFormacion()
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login?next=%2Fadmin%2Flanzamiento')
    if (auth.error.status === 403) redirect('/inicio')
    return <AvancesFormacion inicial={{ estado: 'error', mensaje: auth.error.mensaje }} />
  }
  const consulta = await searchParams
  const clase = typeof consulta?.clase === 'string' && esUuid(consulta.clase) ? consulta.clase.toLowerCase() : ''
  return <AvancesFormacion inicial={await leerSeguimientoFormacion(auth)} claseInicial={clase} />
}
