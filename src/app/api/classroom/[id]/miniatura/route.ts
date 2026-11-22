import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeVerClase } from '@/lib/class-access'
import { esUuid } from '@/lib/class-management'
import { claveMiniatura, revisionMiniatura, MAX_MINIATURA_BYTES } from '@/lib/class-poster'
import { pedirR2 } from '@/lib/r2-upload'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  const { id } = await context.params
  if (!esUuid(id)) return new NextResponse(null, { status: 404, headers })
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new NextResponse(null, { status: 401, headers })
  const [{ data: perfil }, { data: clase }] = await Promise.all([
    supabase.from('perfiles').select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id', user.id).maybeSingle(),
    supabase.from('clases').select('video_key,activo,acceso_gratuito,solo_farmaci').eq('id', id).maybeSingle(),
  ])
  if (!clase || !puedeVerClase(perfil, clase)) return new NextResponse(null, { status: 403, headers })
  if (!clase.video_key) return new NextResponse(null, { status: 204, headers })
  try {
    const response = await pedirR2('GET', claveMiniatura(id, clase.video_key))
    if (response.status === 404) return perfil?.rol === 'admin'
      ? NextResponse.json({ pendiente: true, revision: revisionMiniatura(clase.video_key) }, { headers })
      : new NextResponse(null, { status: 204, headers })
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_MINIATURA_BYTES) throw new Error('miniatura')
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_MINIATURA_BYTES) throw new Error('miniatura')
    return new NextResponse(bytes, { headers: { ...headers, 'Content-Type': 'image/jpeg' } })
  } catch {
    return new NextResponse(null, { status: 503, headers })
  }
}
