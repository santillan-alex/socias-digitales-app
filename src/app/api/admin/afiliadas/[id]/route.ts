import { NextResponse } from 'next/server'
import { esIdAfiliadas } from '@/lib/affiliate-hub'
import { autorizarAfiliadas, ErrorAfiliadas, guardarRecursoAfiliadas, HEADERS_AFILIADAS, leerJsonAfiliadas, origenSolicitudAfiliadas, validarGuardadoAfiliadas } from '@/lib/affiliate-hub-server'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!origenSolicitudAfiliadas(request)) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 403, headers: HEADERS_AFILIADAS })
  const auth = await autorizarAfiliadas(true)
  if ('error' in auth) return NextResponse.json({ error: auth.error.mensaje }, { status: auth.error.status, headers: HEADERS_AFILIADAS })
  const { id } = await context.params
  if (!esIdAfiliadas(id)) return NextResponse.json({ error: 'Recurso no disponible.' }, { status: 404, headers: HEADERS_AFILIADAS })
  try { return NextResponse.json({ recurso: await guardarRecursoAfiliadas(auth, validarGuardadoAfiliadas(await leerJsonAfiliadas(request), id), true) }, { headers: HEADERS_AFILIADAS }) }
  catch (error) {
    const conocido = error instanceof ErrorAfiliadas
    if (!conocido) console.error('affiliate_resource_update_failed')
    return NextResponse.json({ error: conocido ? error.message : 'No pudimos confirmar el guardado. Reintentá el mismo envío.' }, { status: conocido ? error.status : 503, headers: HEADERS_AFILIADAS })
  }
}
