import Link from 'next/link'
import { redirect } from 'next/navigation'
import { autorizarAfiliadas } from '@/lib/affiliate-hub-server'
import { leerVentaAfiliadas } from '@/lib/affiliate-products-server'
import ProductosAfiliadasCliente from './ProductosAfiliadasCliente'
export const dynamic='force-dynamic'
export default async function ProductosAfiliadasPage() {
  const auth=await autorizarAfiliadas()
  if('error'in auth) {
    if(auth.error.status===401) redirect('/login?next=%2Fafiliadas%2Fproductos')
    return <main className="mx-auto max-w-2xl p-5 py-10"><h1 className="text-4xl">Productos</h1><p role={auth.error.status===503?'alert':undefined} className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-5">{auth.error.mensaje}</p><Link href="/inicio" className="mt-4 inline-flex min-h-11 items-center text-[#294A38] underline">Ir a mi inicio</Link></main>
  }
  if(auth.admin) redirect('/admin/afiliadas/productos')
  return <ProductosAfiliadasCliente inicial={await leerVentaAfiliadas(auth)}/>
}
