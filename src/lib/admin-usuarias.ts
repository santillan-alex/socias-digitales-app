export const TIPOS_ACCESO = [
  { id: 'gratuito', etiqueta: 'Gratuitas' },
  { id: 'desafio', etiqueta: 'Desafío Socias' },
  { id: 'socia', etiqueta: 'Socias' },
] as const

export type TipoAcceso = typeof TIPOS_ACCESO[number]['id']
type Usuaria = { id?: string; tipo_usuario?: string | null; rol?: string | null; estado?: string | null; nombre?: string | null; pais?: string | null; email?: string | null }

export function tipoAcceso(usuaria: Usuaria): TipoAcceso {
  if (usuaria.tipo_usuario === 'desafio' || usuaria.tipo_usuario === 'socia' || usuaria.tipo_usuario === 'gratuito') return usuaria.tipo_usuario
  return ['afiliada', 'afiliada_lanzamiento'].includes(usuaria.rol ?? '') ? 'socia' : 'gratuito'
}

export function contarTipos(usuarias: readonly Usuaria[]): Record<TipoAcceso, number> {
  const cantidades = { gratuito: 0, desafio: 0, socia: 0 }
  for (const usuaria of usuarias) if (usuaria.rol !== 'admin' && !esCuentaPrueba(usuaria.id)) cantidades[tipoAcceso(usuaria)]++
  return cantidades
}

export function filtrarUsuarias<T extends Usuaria>(usuarias: readonly T[], filtros: { busqueda: string; estado: string; tipo: TipoAcceso | 'todas' }): T[] {
  const consulta = filtros.busqueda.trim().toLocaleLowerCase('es-AR')
  return usuarias.filter(usuaria => usuaria.rol !== 'admin' && !esCuentaPrueba(usuaria.id)
    && (filtros.estado === 'todas' || usuaria.estado === filtros.estado)
    && (filtros.tipo === 'todas' || tipoAcceso(usuaria) === filtros.tipo)
    && (!consulta || [usuaria.nombre, usuaria.pais, usuaria.email].some(valor => valor?.toLocaleLowerCase('es-AR').includes(consulta))))
}
import { esCuentaPrueba } from './test-accounts'

// Los permisos Farmasi son adicionales al plan base, no un nuevo tipo persistido.
export const TIPOS_ACCESO_PANEL = [
  ...TIPOS_ACCESO,
  { id: 'farmasi', etiqueta: 'Socias Farmasi' },
  { id: 'farmasi_pendiente', etiqueta: 'Farmasi pendientes' },
] as const
export type TipoFiltroAcceso = typeof TIPOS_ACCESO_PANEL[number]['id']
type UsuariaPanel = Usuaria & { socias_farmaci_habilitada?: boolean | null; socias_farmasi_pendiente?: boolean | null }

export function estadoFarmasiPanel(usuaria: UsuariaPanel): 'habilitada' | 'pendiente' | 'sin_acceso' | 'sin_comprobar' {
  if (usuaria.socias_farmaci_habilitada === true) return 'habilitada'
  if (usuaria.socias_farmaci_habilitada !== false) return 'sin_comprobar'
  if (usuaria.socias_farmasi_pendiente === true) return 'pendiente'
  if (usuaria.socias_farmasi_pendiente === false) return 'sin_acceso'
  return 'sin_comprobar'
}
function coincideTipoPanel(usuaria: UsuariaPanel, tipo: TipoFiltroAcceso) {
  const estadoFarmasi = estadoFarmasiPanel(usuaria)
  if (tipo === 'farmasi') return estadoFarmasi === 'habilitada'
  if (tipo === 'farmasi_pendiente') return estadoFarmasi === 'pendiente'
  if (tipo === 'gratuito') return tipoAcceso(usuaria) === 'gratuito' && estadoFarmasi === 'sin_acceso'
  return tipoAcceso(usuaria) === tipo
}
export function contarTiposPanel(usuarias: readonly UsuariaPanel[]): Record<TipoFiltroAcceso, number | null> {
  const filas = usuarias.filter(u => u.rol !== 'admin' && !esCuentaPrueba(u.id))
  const inciertas = filas.filter(u => estadoFarmasiPanel(u) === 'sin_comprobar')
  return {
    gratuito: inciertas.some(u => tipoAcceso(u) === 'gratuito') ? null : filas.filter(u => coincideTipoPanel(u, 'gratuito')).length,
    desafio: filas.filter(u => coincideTipoPanel(u, 'desafio')).length,
    socia: filas.filter(u => coincideTipoPanel(u, 'socia')).length,
    farmasi: inciertas.length ? null : filas.filter(u => coincideTipoPanel(u, 'farmasi')).length,
    farmasi_pendiente: inciertas.length ? null : filas.filter(u => coincideTipoPanel(u, 'farmasi_pendiente')).length,
  }
}
export function filtrarUsuariasPanel<T extends UsuariaPanel>(usuarias: readonly T[], filtros: { busqueda: string; estado: string; tipo: TipoFiltroAcceso | 'todas' }): T[] {
  const filas = filtrarUsuarias(usuarias, { ...filtros, tipo: 'todas' })
  return filtros.tipo === 'todas' ? filas : filas.filter(u => coincideTipoPanel(u, filtros.tipo as TipoFiltroAcceso))
}
