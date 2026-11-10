import { redirect } from 'next/navigation'
import { autorizarAfiliadas } from '@/lib/affiliate-hub-server'
import { leerCatalogoAdminProductosAfiliadas } from '@/lib/affiliate-products-server'
import ProductosAfiliadasAdmin from './ProductosAfiliadasAdmin'
export const dynamic='force-dynamic'
export default async function ProductosAfiliadasAdminPage() {
  const auth=await autorizarAfiliadas(true)
  if('error'in auth) {
    if(auth.error.status===401) redirect('/login?next=%2Fadmin%2Fafiliadas%2Fproductos')
    if(auth.error.status===403) redirect('/inicio')
    return <main className="p-5"><h1 className="text-4xl">Productos</h1><p role="alert" className="mt-5">{auth.error.mensaje}</p><a href="/admin/afiliadas/productos" className="mt-4 inline-flex min-h-11 items-center underline">Reintentar</a></main>
  }
  return <ProductosAfiliadasAdmin inicial={await leerCatalogoAdminProductosAfiliadas(auth)}/>
}
