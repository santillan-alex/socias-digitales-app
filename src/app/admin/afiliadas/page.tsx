import { redirect } from 'next/navigation'
import { autorizarAfiliadas, leerRecursosAfiliadas } from '@/lib/affiliate-hub-server'
import AfiliadasAdmin from './AfiliadasAdmin'

export default async function AfiliadasAdminPage() {
  const auth = await autorizarAfiliadas(true)
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login?next=%2Fadmin%2Fafiliadas')
    if (auth.error.status === 403) redirect('/inicio')
    return <main className="mx-auto max-w-3xl px-5 py-10"><h1 className="text-4xl">Afiliadas</h1><p role="alert" className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-5">{auth.error.mensaje}</p><a href="/admin/afiliadas" className="mt-4 inline-flex min-h-11 items-center underline">Reintentar</a></main>
  }
  return <AfiliadasAdmin inicial={await leerRecursosAfiliadas(auth)} />
}
