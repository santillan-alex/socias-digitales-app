import type { HitoAgenda } from './agenda'

export const AUDIENCIAS_AGENDA = ['desafio', 'socia'] as const
export type AudienciaAgenda = typeof AUDIENCIAS_AGENDA[number]
export interface HitoEditable extends HitoAgenda {
  publicado: boolean
  audiencias: AudienciaAgenda[]
}

export function fechaArgentinaHito(dia: unknown, hora: unknown): string {
  if (typeof dia !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(dia) ||
      typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
    throw new Error('Revisá la fecha y la hora de Argentina.')
  const fecha = `${dia}T${hora}:00-03:00`
  const ms = Date.parse(fecha)
  if (!Number.isFinite(ms) || new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 16) !== `${dia}T${hora}`)
    throw new Error('Elegí una fecha válida.')
  return fecha
}

export function validarHito(valor: unknown): HitoEditable {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Revisá el encuentro.')
  const x = valor as Record<string, unknown>
  if (Object.keys(x).some(k => !['titulo', 'dia', 'hora', 'enlace', 'publicado', 'audiencias'].includes(k)))
    throw new Error('El encuentro contiene campos no permitidos.')
  if (typeof x.titulo !== 'string' || !x.titulo.trim() || x.titulo.length > 120)
    throw new Error('Escribí un título de hasta 120 caracteres.')
  if (typeof x.enlace !== 'string' || x.enlace.length > 2000) throw new Error('Revisá el enlace.')
  const enlace = x.enlace.trim()
  if (enlace) {
    let url: URL
    try { url = new URL(enlace) } catch { throw new Error('Usá un enlace completo que empiece con https://.') }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.'))
      throw new Error('Usá un enlace HTTPS sin credenciales.')
  }
  if (typeof x.publicado !== 'boolean' || !Array.isArray(x.audiencias) || !x.audiencias.length ||
      x.audiencias.some(a => !AUDIENCIAS_AGENDA.includes(a)) || new Set(x.audiencias).size !== x.audiencias.length)
    throw new Error('Elegí Desafío Socias, Socias o ambas audiencias.')
  return {
    id: 'proximo-encuentro', titulo: x.titulo.trim().normalize('NFC'),
    fecha: fechaArgentinaHito(x.dia, x.hora), enlace: enlace || null,
    accion: 'Entrar a la clase', publicado: x.publicado,
    audiencias: x.audiencias as AudienciaAgenda[],
  }
}

export const HITO_INICIAL: HitoEditable = {
  id: 'proximo-encuentro', titulo: 'Clase 2 · Elegí nicho y producto ganador',
  fecha: '2026-10-15T19:30:00-03:00', enlace: null, accion: 'Entrar a la clase',
  publicado: true, audiencias: ['desafio', 'socia'],
}

export function hitoParaAlumna(hito: HitoEditable, perfil: {
  rol?: string; tipo_usuario?: string; estado?: string; desafio_socias_habilitada?: boolean
}): HitoAgenda[] {
  if (!hito.publicado || perfil.rol === 'admin' || perfil.estado !== 'activa') return []
  // Afiliadas es un acceso independiente: un rol anterior no habilita encuentros de Socias.
  const esSocia = perfil.tipo_usuario === 'socia'
  const permitido = (hito.audiencias.includes('socia') && esSocia) ||
    (hito.audiencias.includes('desafio') && perfil.desafio_socias_habilitada === true)
  if (!permitido) return []
  // Solo se serializan los campos visibles; nunca auditoría o borradores.
  return [{ id: hito.id, titulo: hito.titulo, fecha: hito.fecha, enlace: hito.enlace, accion: hito.accion }]
}
