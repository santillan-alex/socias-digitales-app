import { ejecutarSeguimiento, ErrorSeguimiento, leerSeguimiento, responderSeguimiento } from '@/lib/socia-followup-server'

export async function GET(request: Request) {
  return ejecutarSeguimiento(request, false, async auth => {
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(k => k !== 'prueba') || params.getAll('prueba').length > 1 || params.has('prueba') && params.get('prueba') !== '1') throw new ErrorSeguimiento(400, 'Filtros no válidos.')
    const lista = await leerSeguimiento(auth, params.get('prueba') === '1')
    return responderSeguimiento(lista, lista.estado === 'error' ? 503 : 200)
  })
}
