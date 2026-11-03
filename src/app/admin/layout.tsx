import { redirect } from 'next/navigation'
import AdminShellFrame from '@/components/AdminShellFrame'
import { leerNavegacionAdmin } from '@/lib/admin-navigation-server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lectura = await leerNavegacionAdmin()
  if (lectura.estado === 'error') {
    if (lectura.status === 401) redirect('/login')
    if (lectura.status === 403) redirect('/inicio')
    return <main className="min-h-screen bg-[#F4EFEA] px-5 py-12"><section className="mx-auto max-w-xl rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h1 className="text-3xl">No pudimos abrir el panel.</h1><p role="alert" className="mt-4 text-sm leading-6">{lectura.mensaje}</p><a href="/admin" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Reintentar</a></section></main>
  }
  return <AdminShellFrame datos={lectura.datos}>{children}</AdminShellFrame>
}
