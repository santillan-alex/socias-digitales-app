import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProductosAdmin from './ProductosAdmin'
import { cotizacionProducto } from '@/lib/product-money'

export default async function ProductosAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') redirect('/perfil')

  const [{ data: productos, error: errorProductos, count }, { data: config, error: errorConfig }] = await Promise.all([
    supabase.from('productos').select('*', { count: 'exact' }).order('orden').order('id').limit(1000),
    supabase.from('configuracion').select('clave,valor').eq('clave', 'cotizacion_dolar'),
  ])

  const cotizacion = errorConfig ? null : cotizacionProducto(config?.find(c => c.clave === 'cotizacion_dolar')?.valor)
  const errorCarga = Boolean(errorProductos || !Array.isArray(productos) || count === null || count !== productos?.length)

  return <ProductosAdmin productos={errorCarga ? [] : productos ?? []} cotizacion={cotizacion} errorCarga={errorCarga} />
}
