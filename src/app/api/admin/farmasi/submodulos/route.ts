import { NextResponse } from 'next/server'
import { autorizarAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { esListaSubmodulosFarmasi, validarAccionSubmoduloFarmasi } from '@/lib/farmasi-submodules'

const json = (data: object, status = 200) => NextResponse.json(data, {
  status, headers: { 'Cache-Control': 'private, no-store' },
})

export async function POST(request: Request) {
  try {
    const auth = await autorizarAdmin(request)
    if (auth.error) return auth.error
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return json({ error: 'Usá una solicitud JSON válida.' }, 415)
    let input: unknown
    try {
      const cuerpo = await request.text()
      if (cuerpo.length > 1024) return json({ error: 'Solicitud demasiado grande.' }, 413)
      input = JSON.parse(cuerpo)
    } catch {
      return json({ error: 'Solicitud no válida.' }, 400)
    }
    const datos = validarAccionSubmoduloFarmasi(input)
    if (!datos) return json({ error: 'Revisá el nombre o el orden del submódulo.' }, 400)
    const { data, error } = await createAdminClient().rpc('gestionar_farmasi_submodulos', {
      p_accion: datos.accion,
      p_nombre: datos.accion === 'crear' ? datos.nombre : null,
      p_id: datos.accion === 'mover' ? datos.id : null,
      p_direccion: datos.accion === 'mover' ? datos.direccion : null,
    })
    if (error?.code === '23505') return json({ error: 'Ya hay un submódulo con ese nombre.' }, 409)
    if (error?.code === 'P0002') return json({ error: 'No encontramos ese submódulo. Actualizá esta página.' }, 404)
    if (error?.code === '54000') return json({ error: 'Llegaste al límite de submódulos.' }, 409)
    if (error || !esListaSubmodulosFarmasi(data))
      return json({ error: 'No pudimos confirmar el cambio. Actualizá la página antes de reintentar.' }, 503)
    return json({ submodulos: data })
  } catch {
    return json({ error: 'No pudimos confirmar el cambio. Actualizá la página antes de reintentar.' }, 503)
  }
}
