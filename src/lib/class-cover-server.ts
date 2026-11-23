import 'server-only'
import { MAX_PORTADA_BYTES, PORTADA_ALTO, PORTADA_ANCHO, TIPOS_PORTADA, type TipoPortada } from './class-cover'

const MAX_PIXELES_ENTRADA = 16_000_000

export function clavePortadaClase(id: string) {
  return `portadas-clases/${id.toLowerCase()}.webp`
}

export class ImagenDemasiadoGrande extends Error {}

export async function leerImagenAcotada(input: Pick<Request, 'body' | 'headers'>, maximo: number) {
  if (Number(input.headers.get('content-length')) > maximo) {
    void input.body?.cancel().catch(() => {})
    throw new ImagenDemasiadoGrande()
  }
  const lector = input.body?.getReader()
  if (!lector) return new Uint8Array()
  const partes: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await lector.read()
      if (done) break
      total += value.byteLength
      if (total > maximo) {
        void lector.cancel().catch(() => {})
        throw new ImagenDemasiadoGrande()
      }
      partes.push(value)
    }
  } finally {
    lector.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let posicion = 0
  for (const parte of partes) { bytes.set(parte, posicion); posicion += parte.byteLength }
  return bytes
}

export function esWebpPortada(bytes: Uint8Array) {
  return bytes.length >= 20 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
}

export async function normalizarPortadaClase(bytes: Uint8Array, tipo: TipoPortada) {
  const { default: sharp } = await import('sharp')
  const imagen = sharp(Buffer.from(bytes), { failOn: 'warning', limitInputPixels: MAX_PIXELES_ENTRADA })
  const info = await imagen.metadata()
  if (info.format !== TIPOS_PORTADA[tipo] || !info.width || !info.height ||
    info.width * info.height > MAX_PIXELES_ENTRADA || (info.pages ?? 1) > 1)
    throw new Error('imagen_no_valida')

  // Rotar según EXIF, recortar al centro y quitar metadata al reencodificar.
  const base = imagen.rotate().resize(PORTADA_ANCHO, PORTADA_ALTO, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#F4EFEA' })
  for (const quality of [84, 72, 58, 44]) {
    const salida = await base.clone().webp({ quality, effort: 3 }).toBuffer()
    if (salida.byteLength <= MAX_PORTADA_BYTES) return Uint8Array.from(salida)
  }
  throw new ImagenDemasiadoGrande()
}
