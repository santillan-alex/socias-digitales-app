import { esIdAfiliadas } from './affiliate-hub'
import { esCuentaPrueba } from './test-accounts'

export const LIMITE_DIRECTORIO_ALUMNAS = 5000
export type TipoDirectorioAlumna = 'gratuito' | 'desafio' | 'socia'
export type EstadoDirectorioAlumna = 'activa' | 'pausada' | 'cancelada'
export type EstadoDesafioDirectorio = 'no_aplica' | 'pendiente' | 'habilitada' | 'rechazada' | 'bloqueada'
export interface CuentaDirectorioAlumna {
  id: string; nombre: string | null; email: string | null; email_confirmado: boolean | null; cuenta_encontrada: boolean | null
  whatsapp: string | null; pais: string | null; estado: EstadoDirectorioAlumna | null; tipo_usuario: TipoDirectorioAlumna | null
  desafio_socias_habilitada: boolean | null; desafio_socias_estado: EstadoDesafioDirectorio | null
  created_at: string | null; ultimo_acceso: string | null; afiliadas_habilitada: boolean | null
}
export type DirectorioAlumnas = { estado: 'lista'; cuentas: CuentaDirectorioAlumna[]; limitado: boolean; errorIdentidades: boolean; errorAfiliadas: boolean }
  | { estado: 'error'; mensaje: string }
export interface FiltrosDirectorioAlumnas { busqueda: string; tipo: 'todas' | TipoDirectorioAlumna | 'sin_tipo'; estado: 'todas' | EstadoDirectorioAlumna | 'sin_estado'; afiliadas: 'todas' | 'habilitadas' | 'sin_acceso' | 'sin_comprobar' }
const TIPOS = ['gratuito', 'desafio', 'socia']
const ESTADOS = ['activa', 'pausada', 'cancelada']
const DESAFIO = ['no_aplica', 'pendiente', 'habilitada', 'rechazada', 'bloqueada']
const CAMPOS = ['id', 'nombre', 'email', 'email_confirmado', 'cuenta_encontrada', 'whatsapp', 'pais', 'estado', 'tipo_usuario', 'desafio_socias_habilitada', 'desafio_socias_estado', 'created_at', 'ultimo_acceso', 'afiliadas_habilitada']
function objeto(x: unknown): x is Record<string, unknown> { return Boolean(x && typeof x === 'object' && !Array.isArray(x)) }
const nullableTexto = (x: unknown, max: number) => x === null || typeof x === 'string' && x.length <= max && !/[\u0000-\u001f\u007f]/.test(x)
const tri = (x: unknown) => x === null || typeof x === 'boolean'
export function fechaDirectorioValida(x: unknown): x is string {
  return typeof x === 'string' && x.length <= 64 && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x))
    && new Date(`${x.slice(0, 10)}T12:00:00Z`).toISOString().slice(0, 10) === x.slice(0, 10)
}
export function esCuentaDirectorioAlumna(x: unknown): x is CuentaDirectorioAlumna {
  if (!objeto(x) || Object.keys(x).length !== CAMPOS.length || !Object.keys(x).every(k => CAMPOS.includes(k)) || !esIdAfiliadas(x.id) || esCuentaPrueba(x.id)) return false
  if (!nullableTexto(x.nombre, 240) || !nullableTexto(x.email, 320) || !nullableTexto(x.whatsapp, 80) || !nullableTexto(x.pais, 120) || !tri(x.email_confirmado) || !tri(x.cuenta_encontrada) || !tri(x.afiliadas_habilitada) || !tri(x.desafio_socias_habilitada)) return false
  if (!(x.estado === null || typeof x.estado === 'string' && ESTADOS.includes(x.estado)) || !(x.tipo_usuario === null || typeof x.tipo_usuario === 'string' && TIPOS.includes(x.tipo_usuario)) || !(x.desafio_socias_estado === null || typeof x.desafio_socias_estado === 'string' && DESAFIO.includes(x.desafio_socias_estado))) return false
  if (!(x.created_at === null || fechaDirectorioValida(x.created_at)) || !(x.ultimo_acceso === null || fechaDirectorioValida(x.ultimo_acceso))) return false
  if (typeof x.email === 'string' && (x.email !== x.email.trim() || !/^[^\s@]+@[^\s@]+$/.test(x.email))) return false
  if (x.cuenta_encontrada !== true && (x.email !== null || x.email_confirmado !== null || x.ultimo_acceso !== null) || x.email === null && x.email_confirmado !== null) return false
  return true
}
export function esDirectorioAlumnas(x: unknown): x is DirectorioAlumnas {
  if (!objeto(x)) return false
  if (x.estado === 'error') return Object.keys(x).length === 2 && typeof x.mensaje === 'string' && x.mensaje.length > 0 && x.mensaje.length <= 400
  return x.estado === 'lista' && Object.keys(x).length === 5 && Object.keys(x).every(k => ['estado', 'cuentas', 'limitado', 'errorIdentidades', 'errorAfiliadas'].includes(k))
    && typeof x.limitado === 'boolean' && typeof x.errorIdentidades === 'boolean' && typeof x.errorAfiliadas === 'boolean' && Array.isArray(x.cuentas) && x.cuentas.length <= LIMITE_DIRECTORIO_ALUMNAS
    && x.cuentas.every(c => esCuentaDirectorioAlumna(c) && (x.errorIdentidades ? c.cuenta_encontrada === null : c.cuenta_encontrada !== null) && (x.errorAfiliadas ? c.afiliadas_habilitada === null : c.afiliadas_habilitada !== null))
    && new Set(x.cuentas.map(c => (c as CuentaDirectorioAlumna).id)).size === x.cuentas.length
}
function unicas(cuentas: readonly CuentaDirectorioAlumna[]) {
  const result = new Map<string, CuentaDirectorioAlumna>()
  for (const c of cuentas) if (!esCuentaPrueba(c.id) && !('rol' in c && c.rol === 'admin') && !result.has(c.id)) result.set(c.id, c)
  return [...result.values()]
}
export function resumirDirectorioAlumnas(directorio: DirectorioAlumnas) {
  if (directorio.estado !== 'lista' || directorio.limitado) return null
  const cuentas = unicas(directorio.cuentas), desconocidas = cuentas.filter(c => c.afiliadas_habilitada === null).length
  return {
    total: cuentas.length, socias: cuentas.filter(c => c.tipo_usuario === 'socia').length, desafio: cuentas.filter(c => c.tipo_usuario === 'desafio').length,
    gratuitas: cuentas.filter(c => c.tipo_usuario === 'gratuito').length, sin_tipo: cuentas.filter(c => c.tipo_usuario === null).length,
    activas: cuentas.filter(c => c.estado === 'activa').length, pausadas: cuentas.filter(c => c.estado === 'pausada').length, canceladas: cuentas.filter(c => c.estado === 'cancelada').length, sin_estado: cuentas.filter(c => c.estado === null).length,
    afiliadas: directorio.errorAfiliadas || desconocidas ? null : cuentas.filter(c => c.afiliadas_habilitada === true).length,
    afiliadas_activas: directorio.errorAfiliadas || desconocidas ? null : cuentas.filter(c => c.afiliadas_habilitada === true && c.estado === 'activa').length,
    afiliadas_sin_confirmar: desconocidas,
  }
}
const normalizar = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
export function filtrarDirectorioAlumnas(cuentas: readonly CuentaDirectorioAlumna[], filtros: FiltrosDirectorioAlumnas) {
  const consulta = normalizar(filtros.busqueda.trim()), telefono = consulta.replace(/[+\s().-]/g, '')
  return unicas(cuentas).filter(c => (filtros.tipo === 'todas' || filtros.tipo === 'sin_tipo' && c.tipo_usuario === null || filtros.tipo === c.tipo_usuario)
    && (filtros.estado === 'todas' || filtros.estado === 'sin_estado' && c.estado === null || filtros.estado === c.estado)
    && (filtros.afiliadas === 'todas' || filtros.afiliadas === 'habilitadas' && c.afiliadas_habilitada === true || filtros.afiliadas === 'sin_acceso' && c.afiliadas_habilitada === false || filtros.afiliadas === 'sin_comprobar' && c.afiliadas_habilitada === null)
    && (!consulta || normalizar([c.nombre, c.email, c.whatsapp, c.pais].filter(Boolean).join(' ')).includes(consulta) || /^\d{3,}$/.test(telefono) && (c.whatsapp ?? '').replace(/\D/g, '').includes(telefono)))
}
