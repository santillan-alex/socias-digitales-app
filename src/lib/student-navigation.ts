import type { HitoAgenda } from './agenda'
import type { ResumenAvisos } from './unread-notices'

// Solo describe la navegación ya autorizada por el servidor. Estos indicadores
// no sustituyen las comprobaciones de cada página o API.
export interface StudentNavigationData {
  nombre: string
  formacion: boolean
  comunidad: boolean
  afiliadas?: boolean
  herramientas: {
    miDia: boolean
    metricas: boolean
    resultados: boolean
    logros: boolean
  }
  ahoraInicial: number
  hitos: HitoAgenda[]
  errorAgenda: boolean
  avisos: ResumenAvisos
}

export interface StudentNavigationItem {
  id: 'inicio' | 'estrategia' | 'programa' | 'perfil' | 'comunidad' | 'notificaciones' | 'afiliadas' | 'mi-dia' | 'metricas' | 'resultados' | 'logros'
  nombre: string
  href: string
  icono: 'inicio' | 'lanzamiento' | 'clases' | 'perfil' | 'comunidad' | 'notificaciones' | 'checklist' | 'resultados' | 'logros' | 'productos'
  rutas: readonly string[]
}

const principales: readonly StudentNavigationItem[] = [
  { id: 'inicio', nombre: 'Inicio', href: '/inicio', icono: 'inicio', rutas: ['/inicio'] },
  { id: 'estrategia', nombre: 'Estrategia', href: '/lanzamiento', icono: 'lanzamiento', rutas: ['/lanzamiento'] },
  { id: 'programa', nombre: 'Programa', href: '/clases', icono: 'clases', rutas: ['/clases', '/classroom'] },
  { id: 'afiliadas', nombre: 'Afiliadas', href: '/afiliadas', icono: 'productos', rutas: ['/afiliadas'] },
  { id: 'perfil', nombre: 'Mi perfil', href: '/perfil', icono: 'perfil', rutas: ['/perfil', '/cuenta'] },
  { id: 'comunidad', nombre: 'Comunidad', href: '/comunidad', icono: 'comunidad', rutas: ['/comunidad'] },
  { id: 'notificaciones', nombre: 'Notificaciones', href: '/notificaciones', icono: 'notificaciones', rutas: ['/notificaciones'] },
]

const herramientas: readonly (StudentNavigationItem & { permiso: keyof StudentNavigationData['herramientas'] })[] = [
  { id: 'mi-dia', nombre: 'Mi día', href: '/checklist', icono: 'checklist', rutas: ['/checklist'], permiso: 'miDia' },
  { id: 'metricas', nombre: 'Mis métricas', href: '/metricas', icono: 'resultados', rutas: ['/metricas'], permiso: 'metricas' },
  { id: 'resultados', nombre: 'Mis resultados', href: '/resultados', icono: 'resultados', rutas: ['/resultados'], permiso: 'resultados' },
  { id: 'logros', nombre: 'Mis logros', href: '/logros', icono: 'logros', rutas: ['/logros'], permiso: 'logros' },
]

export function seccionesPrincipalesEstudiante(datos: StudentNavigationData): readonly StudentNavigationItem[] {
  return principales.filter(seccion => {
    if (seccion.id === 'estrategia') return datos.formacion
    if (seccion.id === 'programa' && datos.afiliadas && !datos.formacion) return false
    if (seccion.id === 'afiliadas') return datos.afiliadas === true
    if (seccion.id === 'comunidad') return datos.comunidad
    return true
  })
}

export function herramientasEstudiante(datos: StudentNavigationData): readonly StudentNavigationItem[] {
  return herramientas.filter(seccion => datos.herramientas[seccion.permiso])
}

export function activoSeccionEstudiante(pathname: string, seccion: Pick<StudentNavigationItem, 'rutas'>): boolean {
  const ruta = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  return seccion.rutas.some(base => ruta === base || ruta.startsWith(`${base}/`))
}
