import { NextResponse } from 'next/server'
import { autorizarAfiliadas, ErrorAfiliadas, guardarRecursoAfiliadas, HEADERS_AFILIADAS, leerJsonAfiliadas, leerRecursosAfiliadas, origenSolicitudAfiliadas, validarGuardadoAfiliadas } from '@/lib/affiliate-hub-server'

export async function GET(request: Request) {
  const auth = await autorizarAfiliadas(true)
  if ('error' in auth) return NextResponse.json({ error: auth.error.mensaje }, { status: auth.error.status, headers: HEADERS_AFILIADAS })
  if (new URL(request.url).search) return NextResponse.json({ error: 'Consulta no válida.' }, { status: 400, headers: HEADERS_AFILIADAS })
  const catalogo = await leerRecursosAfiliadas(auth)
  return NextResponse.json(catalogo, { status: catalogo.estado === 'lista' ? 200 : 503, headers: HEADERS_AFILIADAS })
}
export async function POST(request: Request) {
  if (!origenSolicitudAfiliadas(request)) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 403, headers: HEADERS_AFILIADAS })
  const auth = await autorizarAfiliadas(true)
  if ('error' in auth) return NextResponse.json({ error: auth.error.mensaje }, { status: auth.error.status, headers: HEADERS_AFILIADAS })
  try { return NextResponse.json({ recurso: await guardarRecursoAfiliadas(auth, validarGuardadoAfiliadas(await leerJsonAfiliadas(request))) }, { headers: HEADERS_AFILIADAS }) }
  catch (error) {
    const conocido = error instanceof ErrorAfiliadas
    if (!conocido) console.error('affiliate_resource_create_failed')
    return NextResponse.json({ error: conocido ? error.message : 'No pudimos confirmar el guardado. Reintentá el mismo envío.' }, { status: conocido ? error.status : 503, headers: HEADERS_AFILIADAS })
  }
}
