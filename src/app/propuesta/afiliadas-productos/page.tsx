import { redirect, unstable_rethrow } from 'next/navigation'
import { autorizarAfiliadas } from '@/lib/affiliate-hub-server'
import { esUuid } from '@/lib/class-management'
import CommerceStructurePreview from '@/components/affiliate-commerce/CommerceStructurePreview'
import type { CommercePreviewProduct } from '@/components/affiliate-commerce/commerce-preview'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Propuesta de Productos para Afiliadas', robots: { index: false, follow: false } }

function imagenSegura(valor: unknown) {
  if (typeof valor !== 'string' || !valor.trim()) return null
  try { const u = new URL(valor); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null }
  catch { return null }
}
function ErrorPropuesta() {
  return <main className="platform-design min-h-screen bg-[#F4EFEA] px-5 py-10"><section className="mx-auto max-w-xl rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h1 className="text-3xl">No pudimos cargar los productos.</h1><p role="alert" className="mt-4 text-sm leading-6">Volvé a intentarlo.</p><a href="/propuesta/afiliadas-productos" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Reintentar</a></section></main>
}

export default async function PropuestaProductosPage() {
  const auth = await autorizarAfiliadas(true)
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login?next=%2Fpropuesta%2Fafiliadas-productos')
    if (auth.error.status === 403) redirect('/inicio')
    return <ErrorPropuesta />
  }
  if (!auth.admin) redirect('/inicio')
  let productos: CommercePreviewProduct[] | null = null
  try {
    // Datos del catálogo real, solo para el equipo. Sin permisos, precios,
    // enlaces de compra, identidades ni cifras comerciales simuladas.
    const result = await auth.supabase.from('productos').select('id,nombre,descripcion,tipo,imagen_url', { count: 'exact' }).eq('tipo', 'fisico').order('orden').order('id').limit(200)
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count !== result.data.length) throw new Error('incomplete_catalog')
    productos = result.data.map(p => {
      if (!esUuid(p.id) || typeof p.nombre !== 'string' || !p.nombre.trim() || p.nombre.length > 200 || p.tipo !== 'fisico' || !(p.descripcion === null || typeof p.descripcion === 'string') || (p.descripcion?.length ?? 0) > 12000) throw new Error('invalid_catalog')
      return { id: p.id, nombre: p.nombre.trim(), categoria: 'Productos físicos', descripcion: p.descripcion?.trim() || '', imagenUrl: imagenSegura(p.imagen_url), variantes: [], detalles: [] }
    })
    if (new Set(productos.map(p => p.id)).size !== productos.length) throw new Error('duplicate_catalog')
  } catch (error) { unstable_rethrow(error); productos = null }
  return productos === null ? <ErrorPropuesta /> : <CommerceStructurePreview productos={productos} />
}
