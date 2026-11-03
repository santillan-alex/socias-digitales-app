import { NextResponse } from 'next/server'
import { autorizarAfiliadas, HEADERS_AFILIADAS, leerRecursosAfiliadas } from '@/lib/affiliate-hub-server'

export async function GET(request: Request) {
  const auth = await autorizarAfiliadas()
  if ('error' in auth) return NextResponse.json({ error: auth.error.mensaje }, { status: auth.error.status, headers: HEADERS_AFILIADAS })
  if (auth.admin) return NextResponse.json({ error: 'Usá la gestión de Afiliadas del panel de Flor.' }, { status: 403, headers: HEADERS_AFILIADAS })
  if (new URL(request.url).search) return NextResponse.json({ error: 'Consulta no válida.' }, { status: 400, headers: HEADERS_AFILIADAS })
  const catalogo = await leerRecursosAfiliadas(auth)
  return NextResponse.json(catalogo, { status: catalogo.estado === 'lista' ? 200 : 503, headers: HEADERS_AFILIADAS })
}
