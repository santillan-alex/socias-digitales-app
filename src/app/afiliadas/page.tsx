import Link from 'next/link'
import { redirect } from 'next/navigation'
import { autorizarAfiliadas, leerRecursosAfiliadas } from '@/lib/affiliate-hub-server'
import AfiliadasCliente from './AfiliadasCliente'

export default async function AfiliadasPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = props?.searchParams
  const auth = await autorizarAfiliadas()
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login?next=%2Fafiliadas')
    return <main className="mx-auto max-w-2xl px-5 py-10"><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Afiliadas</p><h1 className="mt-3 text-4xl">Tu espacio para vender</h1><section className="mt-6 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><p role={auth.error.status === 503 ? 'alert' : undefined} className="text-sm leading-6">{auth.error.mensaje}</p><p className="mt-3 text-sm text-[#746A64]">Tus otros accesos y avances se mantienen. El equipo de Flor puede revisar tu habilitación.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/inicio" className="inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Ir a mi inicio</Link>{auth.error.status === 503 && <a href="/afiliadas" className="inline-flex min-h-11 items-center rounded-full border border-[#E7DDD5] px-5 py-3 text-sm font-semibold text-[#294A38]">Reintentar</a>}</div></section></main>
  }
  if (auth.admin) redirect('/admin/afiliadas')
  const [inicial, parametros] = await Promise.all([leerRecursosAfiliadas(auth), searchParams])
  const descarga = parametros?.descarga
  const avisoDescarga = descarga === 'reintentar' || descarga === 'no-disponible' ? descarga : undefined
  return <AfiliadasCliente inicial={inicial} avisoDescarga={avisoDescarga} />
}
