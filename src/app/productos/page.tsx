import { createClient } from '@/lib/supabase/server'
import ModuleLocked from '@/components/ModuleLocked'
import { esAdministradora } from '@/lib/module-guard'
import { redirect } from 'next/navigation'
import ProductosCliente from './ProductosCliente'
import { cotizacionProducto } from '@/lib/product-money'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!await esAdministradora(user.id)) return <ModuleLocked id="productos" />

  const [{ data: productos }, { data: misLinks }, { data: config, error: errorConfig }] = await Promise.all([
    supabase.from('productos').select('*').eq('activo', true).order('orden'),
    supabase.from('links_afiliadas').select('*').eq('afiliada_id', user.id),
    supabase.from('configuracion').select('clave,valor').eq('clave', 'cotizacion_dolar'),
  ])

  const cotizacion = errorConfig ? null : cotizacionProducto(config?.find(c => c.clave === 'cotizacion_dolar')?.valor)

  return <ProductosCliente productos={productos ?? []} misLinks={misLinks ?? []} userId={user.id} cotizacion={cotizacion} />
}
