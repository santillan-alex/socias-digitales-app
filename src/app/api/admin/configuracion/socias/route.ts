import { NextResponse } from 'next/server'
import { autorizarAdmin } from '@/lib/admin-auth'
import { validarOfertaSocias } from '@/lib/socias-offer'
import { ConflictoOfertaSocias, guardarOfertaSocias, leerOfertaSocias, revisionOfertaSocias } from '@/lib/socias-offer-store'

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
export async function GET() {
  const auth = await autorizarAdmin()
  if (auth.error) return auth.error
  try { return NextResponse.json(await leerOfertaSocias(), { headers }) }
  catch { return NextResponse.json({ error: 'No pudimos cargar la propuesta. Volvé a intentar.' }, { status: 503, headers }) }
}
export async function PUT(request: Request) {
  const auth = await autorizarAdmin(request, 8000)
  if (auth.error) return auth.error
  let oferta, revision
  try {
    const raw = await request.text()
    if (raw.length > 8000) return NextResponse.json({ error: 'La propuesta es demasiado larga.' }, { status: 413, headers })
    const input = JSON.parse(raw)
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['oferta', 'revision'].includes(key))) throw new Error('Revisá la propuesta.')
    oferta = validarOfertaSocias(input.oferta)
    revision = revisionOfertaSocias(input.revision)
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Revisá la propuesta.' }, { status: 400, headers }) }
  try { return NextResponse.json(await guardarOfertaSocias(oferta, revision, auth.user.id), { headers }) }
  catch (error) { return NextResponse.json({ error: error instanceof ConflictoOfertaSocias ? error.message : 'No pudimos guardar. Recargá para comprobar el estado antes de reintentar.' }, { status: error instanceof ConflictoOfertaSocias ? 409 : 503, headers }) }
}
