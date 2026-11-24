import { NextResponse } from 'next/server'
import { autorizarAdmin } from '@/lib/admin-auth'
import { ErrorImportacionClase, leerJsonImportacion, MAX_IMPORT_BODY_BYTES } from '@/lib/class-import'
import { crearConexionClases, listarImportacionesClases, revocarConexionClases } from '@/lib/class-import-server'

export const runtime = 'nodejs'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
function errorResponse(error: unknown) {
  if (error instanceof ErrorImportacionClase) return NextResponse.json({ error: error.message }, { status: error.status, headers })
  console.error('class_import_admin_failed')
  return NextResponse.json({ error: 'No pudimos comprobar las importaciones. Actualizá antes de reintentar.' }, { status: 503, headers })
}
export async function GET() {
  const auth = await autorizarAdmin()
  if (auth.error) return auth.error
  try { return NextResponse.json(await listarImportacionesClases(), { headers }) } catch (error) { return errorResponse(error) }
}
export async function POST(request: Request) {
  const auth = await autorizarAdmin(request, MAX_IMPORT_BODY_BYTES)
  if (auth.error) return auth.error
  try {
    const input = await leerJsonImportacion(request)
    if (input.action === 'crear') return NextResponse.json(await crearConexionClases(input, auth.user.id), { status: 201, headers })
    if (input.action === 'revocar') return NextResponse.json(await revocarConexionClases(input.id), { headers })
    throw new ErrorImportacionClase(400, 'Acción no válida.')
  } catch (error) { return errorResponse(error) }
}
