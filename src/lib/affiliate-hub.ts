export const TIPOS_RECURSO_AFILIADA = [
  { id: 'aviso', nombre: 'Avisos de Flor' },
  { id: 'copy', nombre: 'Copies para vender' },
  { id: 'video', nombre: 'Videos para anuncios' },
  { id: 'archivo', nombre: 'Archivos y guías' },
  { id: 'enlace', nombre: 'Enlaces útiles' },
] as const
export const ESTADOS_RECURSO_AFILIADA = ['borrador', 'publicado', 'archivado'] as const
export type TipoRecursoAfiliada = typeof TIPOS_RECURSO_AFILIADA[number]['id']
export type EstadoRecursoAfiliada = typeof ESTADOS_RECURSO_AFILIADA[number]
export interface DatosRecursoAfiliada {
  titulo: string; cuerpo: string; tipo: TipoRecursoAfiliada; campana: string | null
  url: string | null; estado: EstadoRecursoAfiliada; destacado: boolean
}
export interface RecursoAfiliada extends DatosRecursoAfiliada {
  id: string; version: number; creado_en: string; actualizado_en: string
}
export type CatalogoAfiliadas = { estado: 'lista'; recursos: RecursoAfiliada[]; limitado: boolean }
  | { estado: 'error'; mensaje: string }
export interface EntradaRecursoAfiliada { id: string; datos: DatosRecursoAfiliada; version?: number }
const CAMPOS = ['titulo', 'cuerpo', 'tipo', 'campana', 'url', 'estado', 'destacado'] as const
export const esIdAfiliadas = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
function objeto(x: unknown): x is Record<string, unknown> { return Boolean(x && typeof x === 'object' && !Array.isArray(x)) }
function claves(x: Record<string, unknown>, fields: readonly string[]) { return Object.keys(x).length === fields.length && Object.keys(x).every(k => fields.includes(k)) }
function texto(x: unknown, max: number, vacio = false, multilinea = false): string {
  if (typeof x !== 'string' || x.length > max || (multilinea ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(x)) throw new Error('Revisá los textos y su extensión.')
  const value = x.replace(/\r\n?/g, '\n').trim().normalize('NFC')
  if (!vacio && !value) throw new Error('Completá los campos obligatorios.')
  return value
}
export function enlaceAfiliadas(value: unknown): string | null {
  if (value === null || value === '') return null
  const input = texto(value, 2000)
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Usá un enlace completo que empiece con https://.') }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /\s/.test(input)) throw new Error('Usá un enlace HTTPS sin espacios, contraseñas ni credenciales.')
  return input.replace(/^https:/i, 'https:')
}
export function validarDatosRecursoAfiliada(value: unknown): DatosRecursoAfiliada {
  if (!objeto(value) || !claves(value, CAMPOS)) throw new Error('El recurso contiene campos no permitidos.')
  const titulo = texto(value.titulo, 140), cuerpo = texto(value.cuerpo, 12000, true, true)
  if (!TIPOS_RECURSO_AFILIADA.some(t => t.id === value.tipo) || !ESTADOS_RECURSO_AFILIADA.includes(value.estado as EstadoRecursoAfiliada) || typeof value.destacado !== 'boolean') throw new Error('Elegí un tipo, un estado y un destacado válidos.')
  const tipo = value.tipo as TipoRecursoAfiliada, url = enlaceAfiliadas(value.url)
  if (['video', 'archivo', 'enlace'].includes(tipo) && !url) throw new Error('Agregá el enlace de este recurso. Los archivos y videos se abren en su destino externo.')
  if (['aviso', 'copy'].includes(tipo) && !cuerpo) throw new Error('Escribí el mensaje o el copy antes de guardar.')
  return { titulo, cuerpo, tipo, campana: value.campana === null || value.campana === '' ? null : texto(value.campana, 120), url, estado: value.estado as EstadoRecursoAfiliada, destacado: value.destacado }
}
export function validarEntradaAfiliada(value: unknown, editar = false): EntradaRecursoAfiliada {
  if (!objeto(value) || !claves(value, editar ? ['id', 'version', 'recurso'] : ['id', 'recurso']) || !esIdAfiliadas(value.id)) throw new Error('El envío no es válido. Conservá el formulario y revisá el recurso.')
  if (editar && (!Number.isSafeInteger(value.version) || Number(value.version) < 1 || Number(value.version) >= 1_000_000_000)) throw new Error('La versión no es válida. Abrí la última versión del recurso.')
  return { id: value.id, datos: validarDatosRecursoAfiliada(value.recurso), ...(editar ? { version: value.version as number } : {}) }
}
export function esRecursoAfiliada(value: unknown): value is RecursoAfiliada {
  if (!objeto(value) || !esIdAfiliadas(value.id) || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || Number(value.version) > 1_000_000_000 ||
    !['creado_en', 'actualizado_en'].every(k => typeof value[k] === 'string' && Number.isFinite(Date.parse(value[k] as string)))) return false
  try { const datos = validarDatosRecursoAfiliada(Object.fromEntries(CAMPOS.map(c => [c, value[c]]))); return CAMPOS.every(k => datos[k] === value[k]) } catch { return false }
}
export function esCatalogoAfiliadas(value: unknown, admin = false): value is Extract<CatalogoAfiliadas, { estado: 'lista' }> {
  return objeto(value) && value.estado === 'lista' && typeof value.limitado === 'boolean' && Array.isArray(value.recursos) && value.recursos.length <= 200 &&
    value.recursos.every(r => esRecursoAfiliada(r) && (admin || r.estado === 'publicado')) && new Set(value.recursos.map(r => r.id)).size === value.recursos.length
}
export function recursoCoincideAfiliada(recurso: RecursoAfiliada, datos: DatosRecursoAfiliada) { return CAMPOS.every(k => recurso[k] === datos[k]) }
const normalizar = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
export function filtrarRecursosAfiliadas(recursos: readonly RecursoAfiliada[], filtros: { busqueda: string; tipo: string; campana: string; estado?: string }) {
  const palabras = normalizar(filtros.busqueda.trim()).split(/\s+/).filter(Boolean)
  return recursos.filter(r => (filtros.tipo === 'todos' || r.tipo === filtros.tipo) && (filtros.campana === 'todas' || r.campana === filtros.campana)
    && (!filtros.estado || filtros.estado === 'todos' || r.estado === filtros.estado)
    && palabras.every(p => normalizar([r.titulo, r.cuerpo, r.campana ?? ''].join(' ')).includes(p)))
    .sort((a, b) => Number(b.destacado) - Number(a.destacado) || Date.parse(b.creado_en) - Date.parse(a.creado_en) || a.id.localeCompare(b.id))
}
export function campanasAfiliadas(recursos: readonly RecursoAfiliada[]): string[] { return [...new Set(recursos.map(r => r.campana).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, 'es-AR')) }
export function fechaRecursoAfiliada(value: string) { return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Cordoba', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) }
