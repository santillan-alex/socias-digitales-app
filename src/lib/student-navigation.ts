import type { HitoAgenda } from './agenda'
import type { ResumenAvisos } from './unread-notices'

// Solo describe la navegación ya autorizada por el servidor. Estos indicadores
// no sustituyen las comprobaciones de cada página o API.
export interface StudentNavigationData {
  nombre: string
  formacion: boolean
  comunidad: boolean
  afiliadas?: boolean
  farmasi?: boolean
  conocerSocias?: boolean
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
  id: 'inicio' | 'estrategia' | 'programa' | 'farmasi' | 'conocer-socias' | 'perfil' | 'comunidad' | 'notificaciones' | 'afiliadas' | 'mi-dia' | 'metricas' | 'resultados' | 'logros'
  nombre: string
  href: string
  icono: 'inicio' | 'lanzamiento' | 'clases' | 'perfil' | 'comunidad' | 'notificaciones' | 'checklist' | 'resultados' | 'logros' | 'productos'
  rutas: readonly string[]
  espacio?: 'farmasi' | 'general'
}

const principales: readonly StudentNavigationItem[] = [
  { id: 'inicio', nombre: 'Inicio', href: '/inicio', icono: 'inicio', rutas: ['/inicio'] },
  { id: 'estrategia', nombre: 'Estrategia', href: '/lanzamiento', icono: 'lanzamiento', rutas: ['/lanzamiento'] },
  { id: 'programa', nombre: 'Programa', href: '/clases', icono: 'clases', rutas: ['/clases', '/classroom'], espacio: 'general' },
  { id: 'farmasi', nombre: 'Socias Farmasi', href: '/classroom?espacio=farmasi', icono: 'clases', rutas: ['/classroom'], espacio: 'farmasi' },
  { id: 'afiliadas', nombre: 'Afiliadas', href: '/afiliadas', icono: 'productos', rutas: ['/afiliadas'] },
  { id: 'perfil', nombre: 'Mi perfil', href: '/perfil', icono: 'perfil', rutas: ['/perfil', '/cuenta'] },
  { id: 'comunidad', nombre: 'Comunidad', href: '/comunidad', icono: 'comunidad', rutas: ['/comunidad'] },
  { id: 'notificaciones', nombre: 'Notificaciones', href: '/notificaciones', icono: 'notificaciones', rutas: ['/notificaciones'] },
  { id: 'conocer-socias', nombre: 'Conocer Socias', href: '/socias', icono: 'logros', rutas: ['/socias'] },
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
    if (seccion.id === 'programa' && (datos.afiliadas || datos.farmasi) && !datos.formacion) return false
    if (seccion.id === 'farmasi') return datos.farmasi === true
    if (seccion.id === 'conocer-socias') return datos.conocerSocias === true
    if (seccion.id === 'afiliadas') return datos.afiliadas === true
    if (seccion.id === 'comunidad') return datos.comunidad
    return true
  })
}

export function herramientasEstudiante(datos: StudentNavigationData): readonly StudentNavigationItem[] {
  return herramientas.filter(seccion => datos.herramientas[seccion.permiso])
}

// Los accesos restantes continúan en Menú. La barra conserva objetivos táctiles
// de celular sin asumir permisos ni añadir una segunda consulta de perfil.
export function seccionesMovilesEstudiante(datos: StudentNavigationData): readonly StudentNavigationItem[] {
  const secciones = seccionesPrincipalesEstudiante(datos)
  const porId = (id: StudentNavigationItem['id']) => secciones.find(item => item.id === id)
  const estudio = porId('programa') ?? porId('farmasi') ?? porId('afiliadas')
  const farmasi = porId('farmasi')
  const afiliadas = porId('afiliadas')
  const miDia = herramientasEstudiante(datos).find(item => item.id === 'mi-dia')
  const adicional = farmasi && farmasi.id !== estudio?.id ? farmasi
    : !datos.formacion && afiliadas && afiliadas.id !== estudio?.id ? afiliadas : miDia
  return [porId('inicio'), estudio, adicional, porId('notificaciones'), porId('perfil')]
    .filter((item): item is StudentNavigationItem => Boolean(item))
}

export function activoSeccionEstudiante(pathname: string, seccion: Pick<StudentNavigationItem, 'rutas' | 'espacio'>, search?: string): boolean {
  const ruta = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  if (!seccion.rutas.some(base => ruta === base || ruta.startsWith(`${base}/`))) return false
  const espacios = new URLSearchParams((search ?? pathname.split('?')[1] ?? '').split('#')[0]).getAll('espacio')
  // Coincide con la página: un parámetro repetido no selecciona el aula Farmasi.
  const esFarmasi = espacios.length === 1 && espacios[0] === 'farmasi'
  if (seccion.espacio === 'farmasi') return ruta === '/classroom' && esFarmasi
  if (seccion.espacio === 'general' && ruta === '/classroom') return !esFarmasi
  return true
}
