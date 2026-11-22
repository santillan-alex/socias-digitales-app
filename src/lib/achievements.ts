import { ubicacionClase } from './class-management'
import { fechaDiaValida, moverDia } from './my-day'
import type { ClaseCatalogo } from './class-access'
import type { ProgresoClase } from './class-progress'

export interface PerfilLogros { rol?: string; tipo_usuario?: string | null; estado?: string; desafio_socias_habilitada?: boolean; socias_farmaci_habilitada?: boolean }
export function puedeVerLogros(perfil: PerfilLogros | null) {
  return Boolean(perfil && perfil.rol !== 'admin' && perfil.estado === 'activa' &&
    (perfil.tipo_usuario === 'socia' || ['afiliada', 'afiliada_lanzamiento'].includes(perfil.rol ?? '')))
}
export type FuenteLogros<T> = { estado: 'lista'; datos: T } | { estado: 'bloqueada' | 'error' }
export interface DatosLogros {
  fecha: string
  desde: string
  clases: FuenteLogros<{ completadas: number; disponibles: number; programas: number }>
  metricas: FuenteLogros<{ analisis: number }>
  dia: FuenteLogros<{ tareas: number; dias: number; racha: number }>
}
export function resumenClasesLogros(clases: ClaseCatalogo[], progreso: ProgresoClase[]) {
  const publicadas = [...new Map(clases.filter(c => c.activo).map(c => [c.id, c])).values()]
  const disponibles = publicadas.filter(c => c.puede_ver && (c.tiene_video_privado || c.vimeo_url))
  const completas = new Set(progreso.filter(p => p.completada).map(p => p.clase_id))
  const programas = new Map<string, ClaseCatalogo[]>()
  for (const c of publicadas) {
    const nombre = ubicacionClase(c.modulo).programa
    programas.set(nombre, [...(programas.get(nombre) ?? []), c])
  }
  return {
    completadas: disponibles.filter(c => completas.has(c.id)).length,
    disponibles: disponibles.length,
    programas: [...programas.values()].filter(grupo => grupo.every(c => c.puede_ver && (c.tiene_video_privado || c.vimeo_url) && completas.has(c.id))).length,
  }
}
export function enteroLogros(value: unknown) {
  if (value === null || value === undefined || value === '') throw new Error('Recuento no disponible.')
  const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Recuento no válido.')
  return n
}
export function resumenDiasLogros(filas: { alumna_id: string; fecha: string; completadas: unknown; total: unknown }[], usuaria: string, hoy: string) {
  if (!fechaDiaValida(hoy)) throw new Error('Fecha no válida.')
  const desde = moverDia(hoy, -29), dias = new Map<string, number>()
  for (const fila of filas) {
    if (fila.alumna_id !== usuaria || !fechaDiaValida(fila.fecha) || fila.fecha < desde || fila.fecha > hoy) continue
    if (dias.has(fila.fecha)) throw new Error('Resumen duplicado.')
    const completadas = enteroLogros(fila.completadas), total = enteroLogros(fila.total)
    if (completadas > total) throw new Error('Resumen no válido.')
    dias.set(fila.fecha, completadas)
  }
  let racha = 0, fecha = (dias.get(hoy) ?? 0) > 0 ? hoy : moverDia(hoy, -1)
  while (fecha >= desde && (dias.get(fecha) ?? 0) > 0) { racha++; fecha = moverDia(fecha, -1) }
  return { tareas: enteroLogros([...dias.values()].reduce((s, n) => s + n, 0)), dias: [...dias.values()].filter(n => n > 0).length, racha }
}
export interface HitoLogro {
  id: string; titulo: string; descripcion: string; categoria: 'clases' | 'metricas' | 'dia'
  actual: number | null; meta: number; estado: 'alcanzado' | 'pendiente' | 'bloqueado' | 'error'; href: string; accion: string
}
export function hitosLogros(datos: DatosLogros): HitoLogro[] {
  const c = datos.clases, m = datos.metricas, d = datos.dia
  const hito = (id: string, titulo: string, descripcion: string, categoria: HitoLogro['categoria'], fuente: FuenteLogros<unknown>, actual: number | null, meta: number, href: string, accion: string): HitoLogro => ({
    id, titulo, descripcion, categoria, actual, meta, href, accion,
    estado: fuente.estado === 'error' ? 'error' : fuente.estado === 'bloqueada' ? 'bloqueado' : actual !== null && actual >= meta ? 'alcanzado' : 'pendiente',
  })
  return [
    hito('primera-clase', 'Tu primera clase', 'Marcá una clase como completada en tu biblioteca.', 'clases', c, c.estado === 'lista' ? c.datos.completadas : null, 1, '/classroom', 'Ir a mis clases'),
    hito('tres-clases', 'Seguís aprendiendo', 'Completá tres clases de los programas disponibles para vos.', 'clases', c, c.estado === 'lista' ? c.datos.completadas : null, 3, '/classroom', 'Seguir aprendiendo'),
    hito('programa', 'Un recorrido completo', 'Completá todas las clases y el material de apoyo de un programa publicado.', 'clases', c, c.estado === 'lista' ? c.datos.programas : null, 1, '/classroom', 'Ver mis programas'),
    hito('primer-analisis', 'Tu primer análisis', 'Guardá un análisis en Mis métricas para empezar a seguir tus números.', 'metricas', m, m.estado === 'lista' ? m.datos.analisis : null, 1, '/metricas', 'Ir a mis métricas'),
    hito('cinco-analisis', 'Tu negocio en seguimiento', 'Reuní cinco análisis guardados. Podés registrar distintas fechas o campañas.', 'metricas', m, m.estado === 'lista' ? m.datos.analisis : null, 5, '/metricas', 'Ver mis análisis'),
    hito('primera-tarea', 'Un paso concreto', 'Completá una tarea de Mi día en los últimos 30 días.', 'dia', d, d.estado === 'lista' ? d.datos.tareas : null, 1, '/checklist', 'Abrir Mi día'),
    hito('diez-tareas', 'De a un paso', 'Completá diez tareas de Mi día en los últimos 30 días.', 'dia', d, d.estado === 'lista' ? d.datos.tareas : null, 10, '/checklist', 'Ver mis tareas'),
    hito('tres-dias', 'Hacés lugar a tu proyecto', 'Completá al menos una tarea en tres días distintos de los últimos 30. No tienen que ser seguidos.', 'dia', d, d.estado === 'lista' ? d.datos.dias : null, 3, '/checklist', 'Organizar mi día'),
  ]
}
