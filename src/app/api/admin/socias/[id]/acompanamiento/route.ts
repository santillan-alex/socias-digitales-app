import { UUID_METRICA } from '@/lib/metrics'
import { ejecutarSeguimiento, ErrorSeguimiento, guardarPeriodoSocia, leerJsonSeguimiento, responderSeguimiento } from '@/lib/socia-followup-server'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return ejecutarSeguimiento(request, true, async auth => {
    const { id } = await context.params
    if (!UUID_METRICA.test(id) || new URL(request.url).search) throw new ErrorSeguimiento(400, 'Socia no válida.')
    return responderSeguimiento({ ok: true, periodo: await guardarPeriodoSocia(auth, id.toLowerCase(), await leerJsonSeguimiento(request)) })
  })
}
