import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeVerLogros } from '@/lib/achievements'
import { leerLogros } from '@/lib/achievements-server'
import { fechaArgentina } from '@/lib/metrics'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Iniciá sesión para ver tus avances.' }, { status: 401, headers })
    const { data: perfil, error } = await supabase.from('perfiles').select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id', user.id).maybeSingle()
    if (error || !perfil) return NextResponse.json({ error: 'No pudimos comprobar tu acceso.' }, { status: 503, headers })
    if (!puedeVerLogros(perfil)) return NextResponse.json({ error: 'Mis logros está disponible para alumnas con Socias activo.' }, { status: 403, headers })
    return NextResponse.json(await leerLogros(supabase, user.id, perfil, fechaArgentina()), { headers })
  } catch { return NextResponse.json({ error: 'No pudimos actualizar los avances. Intentá nuevamente.' }, { status: 503, headers }) }
}
