import { unstable_rethrow } from 'next/navigation'
import { leerCatalogoClases } from '@/lib/class-catalog'
import { leerProgresoClases } from '@/lib/class-progress-server'
import { tieneAccesoFarmaci, type PerfilClases } from '@/lib/class-access'
import { leerOfertaSocias } from '@/lib/socias-offer-store'
import { resumirInicioFarmasi } from '@/lib/farmasi-home'
import FarmasiHomeSummary from '@/components/FarmasiHomeSummary'

type Props = { supabase: Parameters<typeof leerProgresoClases>[0]; usuariaId: string; perfil: PerfilClases }

// El cliente de sesión permanece en servidor; la vista recibe solo el resumen
// de clases/progreso autorizados y la propuesta comercial publicada.
export default async function FarmasiHome({ supabase, usuariaId, perfil }: Props) {
  if (perfil.rol === 'admin' || !tieneAccesoFarmaci(perfil)) return null
  const [catalogo, progreso, oferta] = await Promise.allSettled([
    leerCatalogoClases(perfil), leerProgresoClases(supabase, usuariaId), leerOfertaSocias(),
  ])
  for (const result of [catalogo, progreso, oferta]) if (result.status === 'rejected') unstable_rethrow(result.reason)
  if (catalogo.status === 'rejected') console.error('farmasi_home_catalog_read_failed')
  if (progreso.status === 'rejected') console.error('farmasi_home_progress_read_failed')
  const resumen = catalogo.status === 'fulfilled' ? resumirInicioFarmasi(catalogo.value, progreso.status === 'fulfilled' ? progreso.value : null) : null
  return <FarmasiHomeSummary resumen={resumen} ofertaSocias={oferta.status === 'fulfilled' ? oferta.value.oferta : undefined} />
}
