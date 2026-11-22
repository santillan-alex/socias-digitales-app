import { NextResponse } from 'next/server'
import { autorizarAdmin } from '@/lib/admin-auth'
import { esUuid } from '@/lib/class-management'
import { createAdminClient } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }
const json = (data: object, status = 200) => NextResponse.json(data, { status, headers })

async function leerCuenta(perfilId: string) {
  return await createAdminClient().from('perfiles')
    .select('id,rol,estado,socias_farmaci_habilitada').eq('id', perfilId).maybeSingle()
}

export async function GET(request: Request) {
  try {
    const auth = await autorizarAdmin()
    if (auth.error) return auth.error
    const perfilId = new URL(request.url).searchParams.get('perfilId')?.toLowerCase()
    if (!esUuid(perfilId)) return json({ error: 'Elegí una alumna válida.' }, 400)
    const { data, error } = await leerCuenta(perfilId)
    if (error) return json({ error: 'No pudimos comprobar el acceso.' }, 503)
    if (!data || data.rol === 'admin') return json({ error: 'No encontramos esa alumna.' }, 404)
    return json({ habilitada: data.socias_farmaci_habilitada === true, elegible: data.estado === 'activa' })
  } catch {
    return json({ error: 'No pudimos comprobar el acceso.' }, 503)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await autorizarAdmin(request)
    if (auth.error) return auth.error
    let body: unknown
    try { const texto = await request.text(); if (texto.length > 1024) return json({ error: 'Solicitud demasiado grande.' }, 413); body = JSON.parse(texto) } catch { return json({ error: 'Solicitud no válida.' }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2) return json({ error: 'Solicitud no válida.' }, 400)
    const { perfilId: entradaId, habilitada } = body as Record<string, unknown>
    if (!esUuid(entradaId) || typeof habilitada !== 'boolean') return json({ error: 'Solicitud no válida.' }, 400)
    const perfilId = entradaId.toLowerCase()
    const { data: cuenta, error } = await leerCuenta(perfilId)
    if (error) return json({ error: 'No pudimos comprobar la cuenta.' }, 503)
    if (!cuenta || cuenta.rol === 'admin') return json({ error: 'No encontramos esa alumna.' }, 404)
    if (habilitada && cuenta.estado !== 'activa') return json({ error: 'Solo podés habilitar a alumnas con cuenta activa.' }, 409)
    if (cuenta.socias_farmaci_habilitada === habilitada) return json({ habilitada, elegible: cuenta.estado === 'activa' })
    let mutacion = createAdminClient().from('perfiles').update({
      socias_farmaci_habilitada: habilitada,
      socias_farmaci_habilitada_at: new Date().toISOString(),
      socias_farmaci_habilitada_por: auth.user.id,
    }).eq('id', perfilId).eq('socias_farmaci_habilitada', cuenta.socias_farmaci_habilitada)
      .or('rol.neq.admin,rol.is.null')
    if (habilitada) mutacion = mutacion.eq('estado', 'activa')
    const { data, error: errorGuardar } = await mutacion
      .select('id,estado,socias_farmaci_habilitada,socias_farmaci_habilitada_por').maybeSingle()
    if (errorGuardar || !data || data.id !== perfilId || data.socias_farmaci_habilitada !== habilitada || data.socias_farmaci_habilitada_por !== auth.user.id)
      return json({ error: 'No pudimos confirmar el cambio. Revisá el acceso actual antes de volver a intentar.' }, 409)
    return json({ habilitada, elegible: data.estado === 'activa' })
  } catch {
    return json({ error: 'No pudimos confirmar el cambio. Revisá el acceso antes de volver a intentar.' }, 503)
  }
}
