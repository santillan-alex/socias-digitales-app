import { puedeVerClase } from './class-access'
import { ubicacionClase } from './class-management'
import type { AlumnaSeguimiento, ClaseSeguimiento, ProgresoSeguimiento } from './admin-learning-progress'

export type EstadoAprendizaje = 'sin_registro' | 'en_curso' | 'completado' | 'sin_acceso'
export interface FilaAprendizaje {
  alumna: AlumnaSeguimiento
  disponibles: number
  iniciadas: number
  completadas: number
  ultima: string | null
  estado: EstadoAprendizaje
}
export const ESTADOS_APRENDIZAJE: Record<EstadoAprendizaje, string> = {
  sin_registro: 'Sin actividad registrada', en_curso: 'En curso', completado: 'Recorrido completado', sin_acceso: 'Sin acceso actual',
}
export function clasesDeRecorrido(clases: ClaseSeguimiento[], programa = '', claseId = '') {
  return clases.filter(c => (!programa || ubicacionClase(c.modulo).programa === programa) && (!claseId || c.id === claseId))
}
export function indiceAprendizaje(progreso: ProgresoSeguimiento[]) {
  const indice = new Map<string, Map<string, ProgresoSeguimiento>>()
  for (const p of progreso) {
    let clases = indice.get(p.alumna_id)
    if (!clases) { clases = new Map(); indice.set(p.alumna_id, clases) }
    clases.set(p.clase_id, p)
  }
  return indice
}
export function clasePermitida(alumna: AlumnaSeguimiento, clase: ClaseSeguimiento) {
  return puedeVerClase({ ...alumna, desafio_socias_habilitada: alumna.desafio_socias_habilitada === true }, { activo: true, acceso_gratuito: clase.acceso_gratuito })
}
export function filasAprendizaje(alumnas: AlumnaSeguimiento[], clases: ClaseSeguimiento[], indice: ReturnType<typeof indiceAprendizaje>): FilaAprendizaje[] {
  return alumnas.map(alumna => {
    const disponibles = clases.filter(c => clasePermitida(alumna, c))
    const registros = disponibles.flatMap(c => { const p = indice.get(alumna.id)?.get(c.id); return p ? [p] : [] })
    const completadas = registros.filter(p => p.completada).length
    const ultima = registros.reduce<string | null>((fecha, p) => !fecha || Date.parse(p.actualizado_en) > Date.parse(fecha) ? p.actualizado_en : fecha, null)
    return { alumna, disponibles: disponibles.length, iniciadas: registros.length, completadas, ultima,
      estado: !disponibles.length ? 'sin_acceso' : completadas === disponibles.length ? 'completado' : registros.length ? 'en_curso' : 'sin_registro' }
  })
}
const normalizar = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim()
export function filtrarAprendizaje(filas: FilaAprendizaje[], filtros: { busqueda: string; tipo: string; acceso: string; actividad: string }) {
  const consulta = normalizar(filtros.busqueda)
  return filas.filter(f => (!consulta || normalizar(f.alumna.nombre ?? 'Sin nombre').includes(consulta)) &&
    (!filtros.tipo || (f.alumna.tipo_usuario ?? 'sin_tipo') === filtros.tipo) &&
    (filtros.acceso !== 'con_acceso' || f.disponibles > 0) && (filtros.acceso !== 'sin_acceso' || f.disponibles === 0) &&
    (!filtros.actividad || f.estado === filtros.actividad))
}
export function resumenAprendizaje(filas: FilaAprendizaje[]) {
  const conAcceso = filas.filter(f => f.disponibles > 0)
  return { conAcceso: conAcceso.length, conActividad: conAcceso.filter(f => f.iniciadas > 0).length,
    completaron: conAcceso.filter(f => f.estado === 'completado').length, sinRegistro: conAcceso.filter(f => f.estado === 'sin_registro').length }
}
export function resumenClaseAprendizaje(clase: ClaseSeguimiento, alumnas: AlumnaSeguimiento[], indice: ReturnType<typeof indiceAprendizaje>) {
  const filas = filasAprendizaje(alumnas, [clase], indice)
  const resumen = resumenAprendizaje(filas)
  return { ...resumen, porcentaje: resumen.conAcceso ? Math.round(resumen.completaron / resumen.conAcceso * 100) : null }
}
