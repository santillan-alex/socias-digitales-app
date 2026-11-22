import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const json = (data: object, status = 200) => NextResponse.json(data, {
  status, headers: { 'Cache-Control': 'private, no-store' },
})

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'Solicitud no válida.' }, 403)
  // The account is derived exclusively from the authenticated session; the body is never read.
  if (new URL(request.url).search)
    return json({ error: 'Solicitud no válida.' }, 400)
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user || user.is_anonymous)
      return json({ error: 'Ingresá con tu cuenta para solicitar el acceso.' }, 401)
    if (!user.email_confirmed_at)
      return json({ error: 'Confirmá tu correo antes de solicitar el acceso.' }, 403)
    const { data, error: errorSolicitud } = await createAdminClient().rpc('solicitar_socias_farmasi', { p_usuaria_id: user.id })
    if (errorSolicitud)
      return json({ error: 'No pudimos registrar tu solicitud. Intentá nuevamente.' }, 503)
    if (data === 'pendiente' || data === 'habilitada') return json({ estado: data })
    if (data === 'no_elegible')
      return json({ error: 'Necesitás una cuenta activa para solicitar el acceso.' }, 409)
    return json({ error: 'No pudimos registrar tu solicitud. Intentá nuevamente.' }, 503)
  } catch {
    return json({ error: 'No pudimos registrar tu solicitud. Intentá nuevamente.' }, 503)
  }
}
