import { UUID_METRICA } from '@/lib/metrics'
import { ejecutarSeguimiento, ErrorSeguimiento, guardarCobroSocia, leerJsonSeguimiento, responderSeguimiento } from '@/lib/socia-followup-server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return ejecutarSeguimiento(request, true, async auth => {
    const { id } = await context.params
    if (!UUID_METRICA.test(id) || new URL(request.url).search) throw new ErrorSeguimiento(400, 'Socia no válida.')
    return responderSeguimiento({ ok: true, cobro: await guardarCobroSocia(auth, id.toLowerCase(), await leerJsonSeguimiento(request), false) })
  })
}
