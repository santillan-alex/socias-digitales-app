import { unstable_rethrow } from 'next/navigation'
import { autorizarSeguimientoFormacion, HEADERS_SEGUIMIENTO_FORMACION, leerSeguimientoFormacion } from '@/lib/admin-learning-progress-server'

export async function GET(request: Request) {
  const responder = (datos: unknown, status = 200) => Response.json(datos, { status, headers: HEADERS_SEGUIMIENTO_FORMACION })
  try {
    const auth = await autorizarSeguimientoFormacion()
    if ('error' in auth) return responder({ estado: 'error', mensaje: auth.error.mensaje }, auth.error.status)
    if (new URL(request.url).search) return responder({ estado: 'error', mensaje: 'El seguimiento no acepta filtros ni identidades por URL.' }, 400)
    const resultado = await leerSeguimientoFormacion(auth)
    return responder(resultado, resultado.estado === 'error' ? 503 : 200)
  } catch (error) { unstable_rethrow(error); return responder({ estado: 'error', mensaje: 'No pudimos comprobar los avances. Volvé a intentar.' }, 503) }
}
