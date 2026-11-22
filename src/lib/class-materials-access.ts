import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from './supabase/server'
import { puedeVerClase } from './class-access'
import { esUuid } from './class-management'

export const HEADERS_MATERIALES = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
export async function autorizarMateriales(id: string) {
  const fallo = (error: string, status: number) => ({ error: NextResponse.json({ error }, { status, headers: HEADERS_MATERIALES }) })
  if (!esUuid(id)) return fallo('Clase no encontrada.', 404)
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return fallo('Iniciá sesión para ver los materiales.', 401)
  const [perfil, clase] = await Promise.all([
    supabase.from('perfiles').select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id', user.id).maybeSingle(),
    supabase.from('clases').select('activo,acceso_gratuito,solo_farmaci').eq('id', id).maybeSingle(),
  ])
  if (perfil.error || clase.error) return fallo('No pudimos verificar tu acceso.', 503)
  if (!clase.data || !puedeVerClase(perfil.data, clase.data)) return fallo('No tenés acceso a los materiales de esta clase.', 403)
  return { admin: perfil.data?.rol === 'admin' }
}
