import { unstable_rethrow } from 'next/navigation'
import { esIdAfiliadas } from '@/lib/affiliate-hub'
import { analizarArchivoAfiliadasUrl } from '@/lib/affiliate-files'
import { autorizarAfiliadas, HEADERS_AFILIADAS } from '@/lib/affiliate-hub-server'
import { claveArchivoAfiliadas, ErrorArchivoAfiliadas, leerArchivoAfiliadas } from '@/lib/affiliate-files-server'
import { firmarDescargaPrivada } from '@/lib/r2-upload'

export async function GET(request: Request, context: { params: Promise<{ id: string; archivoId: string }> }) {
  const navegacion = (request.headers.get('accept') ?? '').split(',').some(tipo => tipo.split(';')[0].trim().toLowerCase() === 'text/html')
  const fallar = (error: string, status: number) => {
    const destino = status === 401 ? '/login?next=%2Fafiliadas' : status === 503 ? '/afiliadas?descarga=reintentar' : status === 403 || status === 404 ? '/afiliadas?descarga=no-disponible' : null
    if (navegacion && destino) return new Response(null, { status: 303, headers: { ...HEADERS_AFILIADAS, Location: destino } })
    return Response.json({ error }, { status, headers: HEADERS_AFILIADAS })
  }
  try {
    const { id, archivoId } = await context.params
    if (!esIdAfiliadas(id) || !esIdAfiliadas(archivoId) || new URL(request.url).search) return fallar('Archivo no encontrado.', 404)
    const recursoId = id.toLowerCase(), archivo = archivoId.toLowerCase(), auth = await autorizarAfiliadas()
    if ('error' in auth) return fallar(auth.error.mensaje, auth.error.status)
    const recurso = await auth.supabase.from('recursos_afiliadas').select('id,tipo,url,estado').eq('id', recursoId).maybeSingle()
    if (recurso.error) return fallar('No pudimos comprobar este recurso.', 503)
    const ref = analizarArchivoAfiliadasUrl(recurso.data?.url)
    if (!recurso.data || recurso.data.id !== recursoId || !ref || ref.recursoId !== recursoId || ref.archivoId !== archivo || !['video', 'archivo'].includes(recurso.data.tipo) || !auth.admin && recurso.data.estado !== 'publicado') return fallar('Este archivo ya no está disponible.', 404)
    const info = await leerArchivoAfiliadas(recursoId, archivo)
    if (!info || recurso.data.tipo !== (info.extension === 'mp4' ? 'video' : 'archivo')) return fallar('Este archivo ya no está disponible.', 404)
    const encoded = encodeURIComponent(info.nombre).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    const disposition = `attachment; filename="recurso.${info.extension}"; filename*=UTF-8''${encoded}`
    return new Response(null, { status: 307, headers: { ...HEADERS_AFILIADAS, Location: firmarDescargaPrivada(claveArchivoAfiliadas(recursoId, archivo, info.extension), disposition, 60) } })
  } catch (error) { unstable_rethrow(error); return fallar(error instanceof ErrorArchivoAfiliadas ? error.message : 'No pudimos abrir el archivo. Volvé a intentar desde Afiliadas.', error instanceof ErrorArchivoAfiliadas ? error.status : 503) }
}
