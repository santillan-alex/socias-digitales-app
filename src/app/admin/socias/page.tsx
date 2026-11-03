import { redirect } from 'next/navigation'
import { autorizarSeguimiento, leerSeguimiento } from '@/lib/socia-followup-server'
import SociasSeguimiento from './SociasSeguimiento'

export default async function SeguimientoSociasPage() {
  const auth = await autorizarSeguimiento()
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login?next=%2Fadmin%2Fsocias')
    if (auth.error.status === 403) redirect('/inicio')
    return <main className="mx-auto max-w-4xl p-5"><h1 className="text-3xl">Seguimiento de Socias</h1><p role="alert" className="mt-4">{auth.error.mensaje}</p><a href="/admin/socias" className="mt-4 inline-flex min-h-11 items-center underline">Reintentar</a></main>
  }
  return <SociasSeguimiento inicial={await leerSeguimiento(auth)} />
}
