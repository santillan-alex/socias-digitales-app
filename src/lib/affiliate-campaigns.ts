import { filtrarRecursosAfiliadas, TIPOS_RECURSO_AFILIADA, type RecursoAfiliada, type TipoRecursoAfiliada } from './affiliate-hub'

export interface OpcionCampanaAfiliada { clave: string; nombre: string; cantidad: number }
export interface GrupoCampanaAfiliada extends OpcionCampanaAfiliada {
  recursos: RecursoAfiliada[]
  tipos: { tipo: TipoRecursoAfiliada; nombre: string; cantidad: number }[]
}
export function nombreCampanaAfiliada(nombre: string | null): string { return (nombre ?? '').trim().replace(/\s+/g, ' ').normalize('NFC') }
// Prefijos reservados evitan confundir una campaña llamada “Todas” con el filtro.
// Solo agrupa la presentación; nunca modifica los textos guardados en el recurso.
export function claveCampanaAfiliada(nombre: string | null): string {
  const etiqueta = nombreCampanaAfiliada(nombre)
  return etiqueta ? `campana:${etiqueta.toLocaleLowerCase('es-AR')}` : 'sin-campana'
}
function ordenar(recursos: readonly RecursoAfiliada[]): RecursoAfiliada[] {
  return filtrarRecursosAfiliadas(recursos, { busqueda: '', tipo: 'todos', campana: 'todas' })
}
export function agruparCampanasAfiliadas(recursos: readonly RecursoAfiliada[]): GrupoCampanaAfiliada[] {
  const grupos = new Map<string, GrupoCampanaAfiliada>()
  for (const recurso of recursos) {
    const clave = claveCampanaAfiliada(recurso.campana)
    const grupo = grupos.get(clave) ?? { clave, nombre: nombreCampanaAfiliada(recurso.campana) || 'Sin campaña', cantidad: 0, recursos: [], tipos: [] }
    grupo.recursos.push(recurso); grupo.cantidad++; grupos.set(clave, grupo)
  }
  return [...grupos.values()].map(grupo => ({ ...grupo, recursos: ordenar(grupo.recursos), tipos: TIPOS_RECURSO_AFILIADA.map(t => ({ tipo: t.id, nombre: t.nombre, cantidad: grupo.recursos.filter(r => r.tipo === t.id).length })).filter(t => t.cantidad > 0) }))
    .sort((a, b) => Number(b.recursos.some(r => r.destacado)) - Number(a.recursos.some(r => r.destacado)) || Number(a.clave === 'sin-campana') - Number(b.clave === 'sin-campana') || a.nombre.localeCompare(b.nombre, 'es-AR'))
}
export function opcionesCampanasAfiliadas(recursos: readonly RecursoAfiliada[]): OpcionCampanaAfiliada[] {
  return agruparCampanasAfiliadas(recursos).map(({ clave, nombre, cantidad }) => ({ clave, nombre, cantidad }))
}
export function separarAvisosDestacadosAfiliadas(recursos: readonly RecursoAfiliada[]) {
  const ordenados = ordenar(recursos)
  return { avisos: ordenados.filter(r => r.tipo === 'aviso' && r.destacado), recursos: ordenados.filter(r => r.tipo !== 'aviso' || !r.destacado) }
}
