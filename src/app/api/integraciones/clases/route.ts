import { NextResponse } from 'next/server'
import { ErrorImportacionClase, leerJsonImportacion } from '@/lib/class-import'
import { autorizarConexionClases, procesarImportacionClase } from '@/lib/class-import-server'

export const runtime = 'nodejs'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
export async function POST(request: Request) {
  try {
    const auth = await autorizarConexionClases(request)
    const input = await leerJsonImportacion(request)
    return NextResponse.json(await procesarImportacionClase(auth, input), { headers })
  } catch (error) {
    if (error instanceof ErrorImportacionClase) return NextResponse.json({ error: error.message }, { status: error.status, headers })
    console.error('class_import_failed')
    return NextResponse.json({ error: 'No pudimos completar la importación. Reintentá el mismo archivo.' }, { status: 503, headers })
  }
}
