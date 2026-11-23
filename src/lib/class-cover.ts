export const MAX_PORTADA_ENTRADA = 2_000_000
export const MAX_PORTADA_BYTES = 300_000
export const PORTADA_ANCHO = 1280
export const PORTADA_ALTO = 720
export const PORTADA_MIME = 'image/webp'
export const TIPOS_PORTADA = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export type TipoPortada = keyof typeof TIPOS_PORTADA

export function esTipoPortada(tipo: string): tipo is TipoPortada {
  return Object.hasOwn(TIPOS_PORTADA, tipo)
}
