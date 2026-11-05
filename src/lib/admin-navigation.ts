import { ADMIN_SECTIONS } from './admin-sections'

export interface AdminNavigationData { nombre: string; solicitudesPendientes: number | null }
export type AdminNavigationSection = typeof ADMIN_SECTIONS[number]
export const ADMIN_NAVIGATION_GROUPS = [
  { id: 'personas', nombre: 'Alumnas y accesos', rutas: ['/admin/alumnas', '/admin/socias', '/admin/afiliadas', '/admin/desafio', '/admin/encuesta', '/admin/invitar', '/admin/equipo'] },
  { id: 'formacion', nombre: 'Formación y comunidad', rutas: ['/admin/classroom', '/admin/agenda', '/admin/lanzamiento', '/admin/comunidad', '/admin/notificaciones'] },
  { id: 'negocio', nombre: 'Negocio y herramientas', rutas: ['/admin/recursos', '/admin/productos', '/admin/resultados', '/admin/metricas', '/admin/checklist'] },
] as const
export function seccionAdminActiva(pathname: string): AdminNavigationSection['href'] | null {
  const ruta = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  return ADMIN_SECTIONS.find(s => ruta === s.href || s.href !== '/admin' && ruta.startsWith(`${s.href}/`))?.href ?? null
}
export function seccionesGrupoAdmin(rutas: readonly string[]): AdminNavigationSection[] {
  return rutas.map(ruta => ADMIN_SECTIONS.find(s => s.href === ruta)).filter((s): s is AdminNavigationSection => Boolean(s))
}
