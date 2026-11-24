import type { ClaseCatalogo } from './class-access'
import { ordenarClases, esUuid } from './class-management'
import { claseParaContinuar, resumenPrograma, type ProgresoClase } from './class-progress'
import { soloClasesFarmasi } from './farmasi-registration'

export interface ResumenInicioFarmasi {
  clases: number
  completadas: number | null
  enCurso: number | null
  porcentaje: number | null
  proxima: { id: string; titulo: string; desde: number | null } | null
}

// Resume únicamente la proyección autorizada del catálogo. No concede acceso
// ni proyecta enlaces de reproducción, claves o datos de otras alumnas.
export function resumirInicioFarmasi(catalogo: ClaseCatalogo[], progreso: ProgresoClase[] | null): ResumenInicioFarmasi {
  const unicas = new Map(soloClasesFarmasi(catalogo).filter(clase => Boolean(clase.tiene_video_privado || clase.vimeo_url)).map(clase => [clase.id, clase]))
  const clases = ordenarClases([...unicas.values()])
  if (progreso === null) return { clases: clases.length, completadas: null, enCurso: null, porcentaje: null, proxima: null }

  const ultimos = new Map<string, ProgresoClase>()
  for (const item of progreso) {
    if (!unicas.has(item.clase_id)) continue
    const anterior = ultimos.get(item.clase_id)
    if (!anterior || item.actualizado_en > anterior.actualizado_en) ultimos.set(item.clase_id, item)
  }
  const propios = [...ultimos.values()]
  const resumen = resumenPrograma(clases.map(clase => clase.id), propios)
  const continuar = claseParaContinuar(clases, propios)
  const siguiente = clases.find(clase => !ultimos.get(clase.id)?.completada)
  const elegida = continuar?.clase ?? siguiente
  return {
    clases: clases.length, completadas: resumen.completas,
    enCurso: propios.filter(item => !item.completada && Number.isFinite(item.posicion_seg) && item.posicion_seg > 0).length,
    porcentaje: clases.length ? resumen.porcentaje : null,
    proxima: elegida && esUuid(elegida.id) ? { id: elegida.id, titulo: elegida.titulo, desde: continuar ? continuar.progreso.posicion_seg : null } : null,
  }
}
