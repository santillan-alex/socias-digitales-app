import { UUID_METRICA } from '@/lib/metrics'
import { ejecutarSeguimiento, ErrorSeguimiento, guardarCobroSocia, leerJsonSeguimiento, responderSeguimiento } from '@/lib/socia-followup-server'

export async function PATCH(request: Request, context: { params: Promise<{ id: string; cobroId: string }> }) {
  return ejecutarSeguimiento(request, true, async auth => {
    const { id, cobroId } = await context.params
    if (!UUID_METRICA.test(id) || !UUID_METRICA.test(cobroId) || new URL(request.url).search) throw new ErrorSeguimiento(400, 'Cobro no válido.')
    const raw = await leerJsonSeguimiento(request)
    if (!raw || typeof raw !== 'object' || !('id' in raw) || raw.id !== cobroId.toLowerCase()) throw new ErrorSeguimiento(400, 'La identidad del cobro no coincide.')
    return responderSeguimiento({ ok: true, cobro: await guardarCobroSocia(auth, id.toLowerCase(), raw, true) })
  })
}
