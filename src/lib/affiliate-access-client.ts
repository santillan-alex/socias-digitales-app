import { esUuid } from './class-management'
export interface AccesoAfiliadas { usuaria_id: string; habilitada: boolean; version: number; actualizada_en: string }
export interface CuentaAfiliada { id: string; nombre: string; tipo: string; estado: string; prueba: boolean; acceso: AccesoAfiliadas | null }
export type ListaAccesosAfiliadas = { estado: 'lista'; cuentas: CuentaAfiliada[]; limitado: boolean } | { estado: 'error'; mensaje: string }
export function esAccesoAfiliadas(value: unknown): value is AccesoAfiliadas {
  if (!value || typeof value !== 'object') return false
  const x = value as AccesoAfiliadas
  return esUuid(x.usuaria_id) && typeof x.habilitada === 'boolean' && Number.isSafeInteger(x.version) && x.version > 0 && x.version <= 1_000_000_000 && typeof x.actualizada_en === 'string' && Number.isFinite(Date.parse(x.actualizada_en))
}
// Una lectura más reciente del servidor prevalece sobre un guardado local.
export function aplicarAccesoConfirmado(cuenta: CuentaAfiliada, confirmado?: AccesoAfiliadas | null): CuentaAfiliada {
  return confirmado && confirmado.usuaria_id === cuenta.id && confirmado.version > (cuenta.acceso?.version ?? 0)
    ? { ...cuenta, acceso: confirmado } : cuenta
}
