import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { agruparClasesFarmasi, type GrupoClasesFarmasi } from './farmasi-class-groups'

type ClaseFarmasiVisible = { id: string; activo: boolean; solo_farmaci?: boolean; puede_ver: boolean; tiene_video_privado: boolean }

// The caller supplies only classes already selected by the authenticated
// Farmasi RLS query. The privileged lookup returns labels, never media.
export async function leerGruposFarmasi(clases: ClaseFarmasiVisible[]): Promise<GrupoClasesFarmasi[]> {
  const permitidas = new Set(clases.filter(c => c.activo && c.solo_farmaci && c.puede_ver && c.tiene_video_privado).map(c => c.id))
  if (!permitidas.size) return []
  try {
    const admin = createAdminClient()
    const ids = [...permitidas]
    const lotes = []
    const plazo = AbortSignal.timeout(2500)
    for (let i = 0; i < ids.length; i += 100) {
      lotes.push(admin.from('clases')
        .select('id,farmasi_submodulos(id,nombre,orden)')
        .eq('activo', true).eq('solo_farmaci', true).not('video_key', 'is', null)
        .in('id', ids.slice(i, i + 100)).abortSignal(plazo)
        .returns<{ id: string; farmasi_submodulos: { id: string; nombre: string; orden: number } | null }[]>())
    }
    const resultados = await Promise.all(lotes)
    if (resultados.some(r => r.error)) return []
    return agruparClasesFarmasi(resultados.flatMap(r => r.data ?? []), permitidas)
  } catch {
    return []
  }
}
