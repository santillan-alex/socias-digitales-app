import { UUID_METRICA } from '@/lib/metrics'
import { ejecutarSeguimiento, ErrorSeguimiento, leerDetalleSeguimiento, responderSeguimiento } from '@/lib/socia-followup-server'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return ejecutarSeguimiento(request, false, async auth => {
    const { id } = await context.params
    if (!UUID_METRICA.test(id) || new URL(request.url).search) throw new ErrorSeguimiento(400, 'Socia no válida.')
    return responderSeguimiento(await leerDetalleSeguimiento(auth, id.toLowerCase()))
  })
}
