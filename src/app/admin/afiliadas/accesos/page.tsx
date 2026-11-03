import { redirect } from 'next/navigation'
import { autorizarRecursosCrm } from '@/lib/resource-crm-server'
import { leerCuentasAfiliadas } from '@/lib/affiliate-access-server'
import AfiliadasAccesos from './AfiliadasAccesos'
export default async function AccesosAfiliadasPage() {
  const auth = await autorizarRecursosCrm()
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login')
    if (auth.error.status === 403) redirect('/inicio')
    return <main className="mx-auto max-w-3xl p-5"><h1 className="text-3xl">Accesos de Afiliadas</h1><p role="alert" className="mt-4">{auth.error.mensaje}</p><a href="/admin/afiliadas/accesos" className="mt-5 inline-flex min-h-11 items-center underline">Reintentar</a></main>
  }
  return <AfiliadasAccesos inicial={await leerCuentasAfiliadas()} />
}
