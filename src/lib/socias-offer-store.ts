import 'server-only'
import { pedirR2, r2Configurado } from './r2-upload'
import { OFERTA_SOCIAS_INICIAL, validarOfertaSocias, type OfertaSocias } from './socias-offer'

const CLAVE = 'plataforma/oferta-socias-v1.json'
const LIMITE = 8000
export interface OfertaSociasGuardada { oferta: OfertaSocias; revision: string | null; actualizado: string | null }
export class ConflictoOfertaSocias extends Error {}

export function revisionOfertaSocias(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^"[\x21\x23-\x7e]{1,200}"$/.test(value) || value.includes(',')) throw new ConflictoOfertaSocias('Recargá la propuesta antes de guardar.')
  return value
}

export async function leerOfertaSocias(): Promise<OfertaSociasGuardada> {
  if (!r2Configurado()) throw new Error('No pudimos comprobar la propuesta de Socias Digitales.')
  const response = await pedirR2('GET', CLAVE, {}, '', undefined, undefined, { sinCompresion: true, timeoutMs: 2500 })
  if (response.status === 404) return { oferta: { ...OFERTA_SOCIAS_INICIAL }, revision: null, actualizado: null }
  if (!response.ok || Number(response.headers.get('content-length') || 0) > LIMITE) throw new Error('No pudimos leer la propuesta de Socias Digitales.')
  const raw = await response.text()
  if (raw.length > LIMITE) throw new Error('La propuesta necesita revisión.')
  const x = JSON.parse(raw)
  if (x.version !== 1 || typeof x.actualizado !== 'string' || !Number.isFinite(Date.parse(x.actualizado))) throw new Error('La propuesta necesita revisión.')
  let etag = response.headers.get('etag')
  if (etag?.startsWith('W/')) {
    const head = await pedirR2('HEAD', CLAVE, {}, '', undefined, undefined, { sinCompresion: true, timeoutMs: 2500 })
    const strong = head.headers.get('etag')
    if (!head.ok || !strong || strong.startsWith('W/') || strong !== etag.slice(2)) throw new Error('La propuesta cambió. Volvé a cargarla.')
    etag = strong
  }
  if (!etag) throw new Error('No pudimos comprobar la versión de la propuesta.')
  return { oferta: validarOfertaSocias(x.oferta), revision: revisionOfertaSocias(etag), actualizado: x.actualizado }
}

export async function guardarOfertaSocias(oferta: OfertaSocias, revision: string | null, administradora: string): Promise<OfertaSociasGuardada> {
  const validada = validarOfertaSocias(oferta)
  const condicion = revisionOfertaSocias(revision)
  const body = JSON.stringify({ version: 1, oferta: validada, actualizado: new Date().toISOString(), administradora })
  const response = await pedirR2('PUT', CLAVE, {}, body, 'application/json', condicion ? { 'If-Match': condicion } : { 'If-None-Match': '*' })
  if ([409, 412].includes(response.status)) throw new ConflictoOfertaSocias('Otra administradora cambió la propuesta. Recargá para revisar la última versión; tus cambios siguen en el formulario.')
  if (!response.ok) throw new Error('No pudimos guardar la propuesta. Recargá para comprobar el estado.')
  const guardada = await leerOfertaSocias()
  if (JSON.stringify(guardada.oferta) !== JSON.stringify(validada)) throw new ConflictoOfertaSocias('La propuesta cambió mientras guardabas. Recargá para comprobar el estado.')
  return guardada
}
