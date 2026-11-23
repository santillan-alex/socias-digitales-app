import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function autorizarAdmin(request?: Request, maximoBytes = 24_000) {
  if (request) {
    const origin = request.headers.get('origin')
    if (!origin || origin !== new URL(request.url).origin)
      return {
        error: NextResponse.json(
          { error: 'Solicitud no válida.' },
          { status: 403 },
        ),
      }
    if (Number(request.headers.get('content-length') || 0) > maximoBytes)
      return {
        error: NextResponse.json(
          { error: 'Solicitud demasiado grande.' },
          { status: 413 },
        ),
      }
  }
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user)
    return {
      error: NextResponse.json(
        { error: 'Iniciá sesión nuevamente.' },
        { status: 401 },
      ),
    }
  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()
  if (perfilError || perfil?.rol !== 'admin')
    return {
      error: NextResponse.json(
        { error: 'Solo administradores.' },
        { status: 403 },
      ),
    }
  return { supabase, user }
}
