import type { ClaseCatalogo } from './class-access'

export interface MuestraSocias { id: string; titulo: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Solo muestras reproducibles del catálogo autorizado. El reproductor vuelve
// a comprobar el permiso vigente; este enlace nunca habilita contenido.
export function seleccionarMuestraSocias(clases: readonly ClaseCatalogo[]): MuestraSocias | null {
  const clase = clases.find(item => uuid.test(item.id) && item.activo === true &&
    item.acceso_gratuito === true && item.solo_farmaci !== true && item.puede_ver === true &&
    Boolean(item.tiene_video_privado || item.vimeo_url) && item.titulo.trim())
  return clase ? { id: clase.id, titulo: clase.titulo } : null
}

export function rutaMuestraSocias(muestra?: MuestraSocias | null): string | null {
  return muestra && uuid.test(muestra.id) ? `/classroom?clase=${muestra.id.toLowerCase()}` : null
}
