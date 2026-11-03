import { unstable_rethrow } from 'next/navigation'
import { esIdAfiliadas } from '@/lib/affiliate-hub'
import { autorizarAfiliadas, ErrorAfiliadas, HEADERS_AFILIADAS, leerJsonAfiliadas, origenSolicitudAfiliadas } from '@/lib/affiliate-hub-server'
import { ErrorArchivoAfiliadas, iniciarArchivoAfiliadas, leerArchivoAfiliadas, operarArchivoAfiliadas } from '@/lib/affiliate-files-server'

export const maxDuration = 60
const respuesta = (data: unknown, status = 200) => Response.json(data, { status, headers: HEADERS_AFILIADAS })
function fallo(error: unknown) { unstable_rethrow(error); return respuesta({ error: error instanceof ErrorAfiliadas || error instanceof ErrorArchivoAfiliadas ? error.message : 'No pudimos comprobar el archivo. Conservá el formulario e intentá nuevamente.' }, error instanceof ErrorAfiliadas || error instanceof ErrorArchivoAfiliadas ? error.status : 503) }
export async function GET(request: Request) {
  try {
    const auth = await autorizarAfiliadas(true)
    if ('error' in auth) return respuesta({ error: auth.error.mensaje }, auth.error.status)
    const p = new URL(request.url).searchParams, recursoId = p.get('recursoId'), archivoId = p.get('archivoId')
    if ([...p.keys()].some(k => !['recursoId', 'archivoId'].includes(k)) || p.getAll('recursoId').length !== 1 || p.getAll('archivoId').length !== 1 || !esIdAfiliadas(recursoId) || !esIdAfiliadas(archivoId)) throw new ErrorArchivoAfiliadas(400, 'Archivo no válido.')
    const archivo = await leerArchivoAfiliadas(recursoId.toLowerCase(), archivoId.toLowerCase())
    return archivo ? respuesta({ archivo }) : respuesta({ error: 'El archivo todavía no está disponible.' }, 404)
  } catch (error) { return fallo(error) }
}
export async function POST(request: Request) {
  try {
    if (!origenSolicitudAfiliadas(request)) throw new ErrorArchivoAfiliadas(403, 'Solicitud no válida.')
    if (new URL(request.url).search) throw new ErrorArchivoAfiliadas(400, 'Solicitud no válida.')
    const auth = await autorizarAfiliadas(true)
    if ('error' in auth) return respuesta({ error: auth.error.mensaje }, auth.error.status)
    const input = await leerJsonAfiliadas(request)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ErrorArchivoAfiliadas(400, 'Solicitud no válida.')
    const x = input as Record<string, unknown>, campos: Record<string, string[]> = { iniciar: ['action', 'recursoId', 'nombre', 'bytes'], firmar: ['action', 'token', 'numero'], estado: ['action', 'token'], completar: ['action', 'token'], cancelar: ['action', 'token'] }
    if (typeof x.action !== 'string' || !Object.hasOwn(campos, x.action) || Object.keys(x).length !== campos[x.action].length || !Object.keys(x).every(k => campos[x.action as string].includes(k))) throw new ErrorArchivoAfiliadas(400, 'Solicitud no válida.')
    if (x.action === 'iniciar') return respuesta(await iniciarArchivoAfiliadas(auth, { recursoId: x.recursoId, nombre: x.nombre, bytes: x.bytes }))
    return respuesta(await operarArchivoAfiliadas(auth, { action: x.action as 'firmar' | 'estado' | 'completar' | 'cancelar', token: x.token, ...(x.action === 'firmar' ? { numero: x.numero } : {}) }))
  } catch (error) { return fallo(error) }
}
