import { NextResponse } from 'next/server'
import { autorizarAdmin } from '@/lib/admin-auth'
import { clavePortadaClase, ImagenDemasiadoGrande, leerImagenAcotada, normalizarPortadaClase } from '@/lib/class-cover-server'
import { esTipoPortada, MAX_PORTADA_ENTRADA, PORTADA_MIME } from '@/lib/class-cover'
import { esUuid } from '@/lib/class-management'
import { pedirR2 } from '@/lib/r2-upload'

export const runtime = 'nodejs'
type Contexto = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
const error = (mensaje: string, status: number) => NextResponse.json({ error: mensaje }, { status, headers })

async function claseAdministrada(request: Request, contexto: Contexto, maximo: number) {
  const auth = await autorizarAdmin(request, maximo)
  if (auth.error) {
    for (const [name, value] of Object.entries(headers)) auth.error.headers.set(name, value)
    return { error: auth.error }
  }
  const { id } = await contexto.params
  if (!esUuid(id)) return { error: error('No encontramos esa clase.', 404) }
  const { data, error: fallo } = await auth.supabase.from('clases').select('id').eq('id', id.toLowerCase()).maybeSingle()
  if (fallo) return { error: error('No pudimos verificar la clase. Intentá de nuevo.', 503) }
  if (!data || data.id !== id.toLowerCase()) return { error: error('No encontramos esa clase.', 404) }
  return { clave: clavePortadaClase(data.id) }
}

export async function POST(request: Request, contexto: Contexto) {
  try {
    const clase = await claseAdministrada(request, contexto, MAX_PORTADA_ENTRADA)
    if (clase.error) return clase.error
    const tipo = request.headers.get('content-type') ?? ''
    if (!esTipoPortada(tipo)) return error('Elegí una imagen JPG, PNG o WebP.', 415)
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = await normalizarPortadaClase(await leerImagenAcotada(request, MAX_PORTADA_ENTRADA), tipo)
    } catch (causa) {
      if (causa instanceof ImagenDemasiadoGrande) return error('No pudimos procesar el tamaño de la imagen. Elegí una versión más liviana (máximo 2 MB).', 413)
      return error('La imagen no es válida. Elegí un JPG, PNG o WebP estático.', 400)
    }
    const respuesta = await pedirR2('PUT', clase.clave, {}, bytes, PORTADA_MIME, undefined, { timeoutMs: 8_000 })
    if (!respuesta.ok) throw new Error('portada')
    return NextResponse.json({ ok: true }, { headers })
  } catch {
    return error('No pudimos guardar la portada. El video no se modificó; podés reintentar.', 502)
  }
}

export async function DELETE(request: Request, contexto: Contexto) {
  try {
    const clase = await claseAdministrada(request, contexto, 0)
    if (clase.error) return clase.error
    const respuesta = await pedirR2('DELETE', clase.clave, {}, '', undefined, undefined, { timeoutMs: 8_000 })
    if (!respuesta.ok && respuesta.status !== 404) throw new Error('portada')
    return new NextResponse(null, { status: 204, headers })
  } catch {
    return error('No pudimos quitar la portada. El video no se modificó; podés reintentar.', 502)
  }
}
