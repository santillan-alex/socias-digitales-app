export interface OfertaSocias {
  precioTexto: string | null
  accionUrl: string | null
}

export const OFERTA_SOCIAS_INICIAL: OfertaSocias = { precioTexto: null, accionUrl: null }

export function validarOfertaSocias(input: unknown): OfertaSocias {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Revisá la propuesta de Socias Digitales.')
  const x = input as Record<string, unknown>
  if (Object.keys(x).some(key => !['precioTexto', 'accionUrl'].includes(key))) throw new Error('Revisá los campos de la propuesta.')
  const campo = (valor: unknown, maximo: number) => {
    if (valor === null || valor === '') return null
    if (typeof valor !== 'string' || valor.length > maximo || /[\u0000-\u001f\u007f]/.test(valor)) throw new Error('Revisá el precio y el enlace de inscripción.')
    return valor.trim() || null
  }
  const precioTexto = campo(x.precioTexto, 120)
  const accionUrl = campo(x.accionUrl, 1500)
  if (accionUrl) {
    let url: URL
    try { url = new URL(accionUrl) } catch { throw new Error('El enlace de inscripción debe comenzar con https://.') }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error('Usá un enlace HTTPS de inscripción o contacto, sin contraseñas.')
  }
  return { precioTexto, accionUrl }
}
