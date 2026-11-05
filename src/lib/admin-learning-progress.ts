import { esIdAfiliadas } from './affiliate-hub'
import { esCuentaPrueba } from './test-accounts'

export const LIMITE_ALUMNAS_FORMACION = 5000
export const LIMITE_CLASES_FORMACION = 1000
export const LIMITE_PROGRESO_FORMACION = 50000

export interface ClaseSeguimiento { id: string; titulo: string; modulo: string; orden: number; acceso_gratuito: boolean }
export interface AlumnaSeguimiento {
  id: string; nombre: string | null
  tipo_usuario: 'gratuito' | 'desafio' | 'socia' | null
  estado: 'activa' | 'pausada' | 'cancelada' | null
  desafio_socias_habilitada: boolean | null
}
export interface ProgresoSeguimiento {
  alumna_id: string; clase_id: string; posicion_seg: number; duracion_seg: number
  completada: boolean; actualizado_en: string
}
export type SeguimientoFormacion = { estado: 'lista'; clases: ClaseSeguimiento[]; alumnas: AlumnaSeguimiento[]; progreso: ProgresoSeguimiento[] }
  | { estado: 'error'; mensaje: string }

const objeto = (x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x))
const claves = (x: Record<string, unknown>, esperadas: string[]) => Object.keys(x).length === esperadas.length && Object.keys(x).every(k => esperadas.includes(k))
const texto = (x: unknown, max: number): x is string => typeof x === 'string' && x.length > 0 && x.length <= max && x === x.trim() && !/[\u0000-\u001f\u007f]/.test(x)
const entero = (x: unknown, max: number): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= max
const id = (x: unknown): x is string => esIdAfiliadas(x) && x === x.toLowerCase()

export function esClaseSeguimiento(x: unknown): x is ClaseSeguimiento {
  return objeto(x) && claves(x, ['id', 'titulo', 'modulo', 'orden', 'acceso_gratuito']) && id(x.id)
    && texto(x.titulo, 180) && texto(x.modulo, 100) && entero(x.orden, 9999) && typeof x.acceso_gratuito === 'boolean'
}
export function esAlumnaSeguimiento(x: unknown): x is AlumnaSeguimiento {
  return objeto(x) && claves(x, ['id', 'nombre', 'tipo_usuario', 'estado', 'desafio_socias_habilitada']) && id(x.id) && !esCuentaPrueba(x.id)
    && (x.nombre === null || texto(x.nombre, 240))
    && (x.tipo_usuario === null || typeof x.tipo_usuario === 'string' && ['gratuito', 'desafio', 'socia'].includes(x.tipo_usuario))
    && (x.estado === null || typeof x.estado === 'string' && ['activa', 'pausada', 'cancelada'].includes(x.estado))
    && (x.desafio_socias_habilitada === null || typeof x.desafio_socias_habilitada === 'boolean')
}
export function esProgresoSeguimiento(x: unknown): x is ProgresoSeguimiento {
  if (!objeto(x) || !claves(x, ['alumna_id', 'clase_id', 'posicion_seg', 'duracion_seg', 'completada', 'actualizado_en']) || !id(x.alumna_id) || esCuentaPrueba(x.alumna_id) || !id(x.clase_id)) return false
  return entero(x.posicion_seg, 172800) && entero(x.duracion_seg, 172800) && x.posicion_seg <= x.duracion_seg && typeof x.completada === 'boolean'
    && typeof x.actualizado_en === 'string' && x.actualizado_en.length <= 64 && /^\d{4}-\d{2}-\d{2}T/.test(x.actualizado_en) && Number.isFinite(Date.parse(x.actualizado_en))
    && new Date(`${x.actualizado_en.slice(0, 10)}T12:00:00Z`).toISOString().slice(0, 10) === x.actualizado_en.slice(0, 10)
}
export function esSeguimientoFormacion(x: unknown): x is SeguimientoFormacion {
  if (!objeto(x)) return false
  if (x.estado === 'error') return claves(x, ['estado', 'mensaje']) && texto(x.mensaje, 400)
  if (x.estado !== 'lista' || !claves(x, ['estado', 'clases', 'alumnas', 'progreso']) || !Array.isArray(x.clases) || !Array.isArray(x.alumnas) || !Array.isArray(x.progreso)
    || x.clases.length > LIMITE_CLASES_FORMACION || x.alumnas.length > LIMITE_ALUMNAS_FORMACION || x.progreso.length > LIMITE_PROGRESO_FORMACION
    || !x.clases.every(esClaseSeguimiento) || !x.alumnas.every(esAlumnaSeguimiento) || !x.progreso.every(esProgresoSeguimiento)) return false
  const clases = new Set(x.clases.map(c => c.id)), alumnas = new Set(x.alumnas.map(a => a.id)), pares = new Set<string>()
  if (clases.size !== x.clases.length || alumnas.size !== x.alumnas.length) return false
  for (const p of x.progreso) {
    const par = `${p.alumna_id}:${p.clase_id}`
    if (!clases.has(p.clase_id) || !alumnas.has(p.alumna_id) || pares.has(par)) return false
    pares.add(par)
  }
  return true
}
