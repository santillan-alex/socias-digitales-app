import { redirect } from 'next/navigation'
import { autorizarAdmin } from '@/lib/admin-auth'
import { solicitudesFarmasi } from '@/lib/farmasi-requests-server'
import { paginaSolicitudesFarmasi } from '@/lib/farmasi-registration'
import InvitarCliente from './InvitarCliente'

export default async function InvitarPage({ searchParams }: { searchParams: Promise<{ farmasiPagina?: string | string[] }> }) {
  const auth = await autorizarAdmin()
  if (auth.error) {
    if (auth.error.status === 401) redirect('/login?next=%2Fadmin%2Finvitar')
    return redirect('/perfil')
  }
  return <InvitarCliente solicitudes={await solicitudesFarmasi(auth, paginaSolicitudesFarmasi((await searchParams).farmasiPagina))} />
}
