import 'server-only'
import type { createClient } from './supabase/server'
import { puedeVerClasesPrivadas } from './class-access'
import { leerCampusAprendizaje } from './learning-campus-server'
import { planEstudioDesdeCampus, type PlanEstudio } from './study-planner'

// Precondición: el llamador verificó getUser y permisoMiDia para esta misma
// usuaria de sesión. No aceptar aquí un userId elegido desde el navegador.
// Este lector no habilita Mi día, no crea tareas ni obtiene URLs de videos.
export async function leerPlanEstudio(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<PlanEstudio> {
  if (!userId) return { estado: 'error', opciones: [] }
  try {
    const { data: perfil, error } = await supabase.from('perfiles')
      .select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada')
      .eq('id', userId).maybeSingle()
    if (error || !perfil || perfil.rol === 'admin' || !puedeVerClasesPrivadas(perfil)) return { estado: 'error', opciones: [] }
    return planEstudioDesdeCampus(await leerCampusAprendizaje(supabase, userId, perfil))
  } catch {
    console.error('study_planner_read_failed')
    return { estado: 'error', opciones: [] }
  }
}
