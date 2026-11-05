import { unstable_rethrow } from 'next/navigation'
import { autorizarDirectorioAlumnas, HEADERS_DIRECTORIO_ALUMNAS, leerDirectorioAlumnas } from '@/lib/admin-student-directory-server'

export async function GET(request: Request) {
  const responder = (datos: unknown, status = 200) => Response.json(datos, { status, headers: HEADERS_DIRECTORIO_ALUMNAS })
  try {
    const auth = await autorizarDirectorioAlumnas()
    if ('error' in auth) return responder({ estado: 'error', mensaje: auth.error.mensaje }, auth.error.status)
    if (new URL(request.url).search) return responder({ estado: 'error', mensaje: 'Este listado no acepta filtros ni identidades por URL.' }, 400)
    const directorio = await leerDirectorioAlumnas(auth)
    return responder(directorio, directorio.estado === 'error' ? 503 : 200)
  } catch (error) { unstable_rethrow(error); return responder({ estado: 'error', mensaje: 'No pudimos comprobar el listado. Volvé a intentar.' }, 503) }
}
