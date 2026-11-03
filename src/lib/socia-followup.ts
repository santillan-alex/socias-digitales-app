import { UUID_METRICA } from './metrics'

export const ESTADOS_ACOMPANAMIENTO = {
  sin_fecha: 'Fecha por confirmar', vigente: 'Vigente', por_vencer: 'Renueva en 30 días', vencido: 'Acompañamiento vencido', por_iniciar: 'Por iniciar',
} as const
export type EstadoAcompanamiento = keyof typeof ESTADOS_ACOMPANAMIENTO
export const ESTADOS_COBRO = { pendiente: 'Pendiente', pagado: 'Pagado', anulado: 'Anulado' } as const
export interface PeriodoSocia { usuaria_id: string; inicio: string; fin: string; version: number; actualizado_en: string }
export interface DatosCobroSocia {
  concepto: string; vencimiento: string; monto: number | null; moneda: 'ARS' | 'USD' | null
  estado: keyof typeof ESTADOS_COBRO; pagado_en: string | null; nota: string | null
}
export interface CobroSocia extends DatosCobroSocia { id: string; socia_id: string; version: number; creado_en: string; actualizado_en: string }
export interface SociaSeguimiento {
  id: string; nombre: string | null; whatsapp: string | null; estado: string | null; alta: string | null
  acompanamiento: PeriodoSocia | null; cobros: CobroSocia[]; prueba: boolean
}
export interface CambioSeguimiento {
  id: string; entidad: 'acompanamiento' | 'cobro'; registro_id: string; creado_en: string
  anterior: { inicio?: string; fin?: string; estado?: string; concepto?: string } | null
  nuevo: { inicio?: string; fin?: string; estado?: string; concepto?: string }
}
export interface DetalleSeguimiento { socia: SociaSeguimiento; historial: CambioSeguimiento[]; historialLimitado: boolean; cobrosLimitados: boolean; hoy: string }
export type ListaSeguimiento = { estado: 'lista'; socias: SociaSeguimiento[]; hoy: string; limitado: boolean; incluyePrueba: boolean }
  | { estado: 'error'; mensaje: string; hoy: string }

export function fechaSeguimientoValida(x: unknown): x is string {
  return typeof x === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(`${x}T12:00:00Z`)) && new Date(`${x}T12:00:00Z`).toISOString().slice(0, 10) === x
}
function exigirFecha(x: unknown): asserts x is string { if (!fechaSeguimientoValida(x)) throw new Error('Elegí una fecha válida.') }
function objeto(x: unknown): x is Record<string, unknown> { return Boolean(x && typeof x === 'object' && !Array.isArray(x)) }
function claves(x: Record<string, unknown>, permitidas: string[]) { return Object.keys(x).length === permitidas.length && Object.keys(x).every(k => permitidas.includes(k)) }
function uuid(x: unknown): x is string { return typeof x === 'string' && UUID_METRICA.test(x) }
function version(x: unknown, editable = false): x is number { return Number.isSafeInteger(x) && Number(x) >= 1 && Number(x) <= (editable ? 1e9 - 1 : 1e9) }
function sello(x: unknown): x is string { return typeof x === 'string' && x.length <= 64 && /^20\d{2}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x)) }
function texto(x: unknown, max: number, requerido = false): string | null {
  if (!requerido && (x === '' || x === null)) return null
  if (typeof x !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x)) throw new Error('Revisá los textos del registro.')
  const valor = x.normalize('NFC').trim()
  if (valor.length > max || requerido && !valor) throw new Error(`Usá un texto de ${requerido ? '1 a ' : 'hasta '}${max} caracteres.`)
  return valor || null
}

// Seis meses de calendario, no 180 días. El último día se ajusta al mes destino.
export function finAcompanamiento(inicio: string): string {
  exigirFecha(inicio)
  const [anio, mes, dia] = inicio.split('-').map(Number)
  const destino = new Date(Date.UTC(anio, mes - 1 + 6, 1, 12))
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0, 12)).getUTCDate()
  destino.setUTCDate(Math.min(dia, ultimo))
  return destino.toISOString().slice(0, 10)
}
export function moverFechaSeguimiento(fecha: string, dias: number): string {
  exigirFecha(fecha)
  const date = new Date(`${fecha}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + dias)
  return date.toISOString().slice(0, 10)
}
export function diasAcompanamiento(fin: string, hoy: string): number {
  exigirFecha(fin); exigirFecha(hoy)
  return Math.round((Date.parse(`${fin}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000)
}
export function estadoAcompanamiento(periodo: PeriodoSocia | null, hoy: string): EstadoAcompanamiento {
  exigirFecha(hoy)
  if (!periodo) return 'sin_fecha'
  if (!esPeriodoSocia(periodo)) throw new Error('No pudimos comprobar el período de acompañamiento.')
  if (hoy < periodo.inicio) return 'por_iniciar'
  const dias = diasAcompanamiento(periodo.fin, hoy)
  return dias <= 0 ? 'vencido' : dias <= 30 ? 'por_vencer' : 'vigente'
}
export function fechaSeguimiento(fecha: string): string {
  exigirFecha(fecha)
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
}
export function importeCobro(cobro: Pick<CobroSocia, 'monto' | 'moneda'>): string {
  return cobro.monto === null || cobro.moneda === null ? 'Importe por definir' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: cobro.moneda, currencyDisplay: 'code' }).format(cobro.monto)
}
export function cobroVencido(cobro: CobroSocia, hoy: string) { exigirFecha(hoy); return cobro.estado === 'pendiente' && cobro.vencimiento < hoy }
export function esPeriodoSocia(x: unknown): x is PeriodoSocia {
  if (!objeto(x) || !uuid(x.usuaria_id) || !fechaSeguimientoValida(x.inicio) || !fechaSeguimientoValida(x.fin) || !version(x.version) || !sello(x.actualizado_en)) return false
  return finAcompanamiento(x.inicio) === x.fin
}
export function esCobroSocia(x: unknown): x is CobroSocia {
  if (!objeto(x) || !uuid(x.id) || !uuid(x.socia_id) || !version(x.version) || !sello(x.creado_en) || !sello(x.actualizado_en)) return false
  try { validarDatosCobro(x); return true } catch { return false }
}
export function esSociaSeguimiento(x: unknown): x is SociaSeguimiento {
  return objeto(x) && uuid(x.id) && (x.nombre === null || typeof x.nombre === 'string') && (x.whatsapp === null || typeof x.whatsapp === 'string')
    && (x.estado === null || typeof x.estado === 'string') && (x.alta === null || fechaSeguimientoValida(x.alta)) && typeof x.prueba === 'boolean'
    && (x.acompanamiento === null || esPeriodoSocia(x.acompanamiento) && x.acompanamiento.usuaria_id === x.id)
    && Array.isArray(x.cobros) && x.cobros.every(c => esCobroSocia(c) && c.socia_id === x.id) && new Set(x.cobros.map(c => (c as CobroSocia).id)).size === x.cobros.length
}
export function esListaSeguimiento(x: unknown): x is Extract<ListaSeguimiento, { estado: 'lista' }> {
  return objeto(x) && x.estado === 'lista' && fechaSeguimientoValida(x.hoy) && typeof x.limitado === 'boolean' && typeof x.incluyePrueba === 'boolean'
    && Array.isArray(x.socias) && x.socias.every(esSociaSeguimiento) && new Set(x.socias.map(s => (s as SociaSeguimiento).id)).size === x.socias.length
}
export function esCambioSeguimiento(x: unknown): x is CambioSeguimiento {
  if (!objeto(x) || !uuid(x.id) || !uuid(x.registro_id) || !sello(x.creado_en) || !(x.entidad === 'acompanamiento' || x.entidad === 'cobro')) return false
  const datos = (d: unknown) => {
    if (!objeto(d)) return false
    return x.entidad === 'acompanamiento' ? fechaSeguimientoValida(d.inicio) && fechaSeguimientoValida(d.fin) && finAcompanamiento(d.inicio) === d.fin
      : typeof d.concepto === 'string' && d.concepto.length >= 1 && d.concepto.length <= 160 && typeof d.estado === 'string' && Object.hasOwn(ESTADOS_COBRO, d.estado)
  }
  return (x.anterior === null || datos(x.anterior)) && datos(x.nuevo)
}
export function esDetalleSeguimiento(x: unknown): x is DetalleSeguimiento {
  return objeto(x) && esSociaSeguimiento(x.socia) && fechaSeguimientoValida(x.hoy) && typeof x.historialLimitado === 'boolean' && typeof x.cobrosLimitados === 'boolean'
    && Array.isArray(x.historial) && x.historial.every(esCambioSeguimiento) && new Set(x.historial.map(c => (c as CambioSeguimiento).id)).size === x.historial.length
}
export function validarPeriodoSocia(raw: unknown, hoy: string, alta: string | null = null) {
  if (!objeto(raw) || !claves(raw, ['inicio', 'version', 'confirmacion_pago']) || raw.confirmacion_pago !== true || !(raw.version === null || version(raw.version, true))) throw new Error('Confirmá que revisaste el pago y el alta antes de guardar el acompañamiento.')
  exigirFecha(raw.inicio); exigirFecha(hoy)
  if (raw.inicio > hoy) throw new Error('El inicio confirmado no puede ser futuro.')
  if (alta && (!fechaSeguimientoValida(alta) || raw.inicio < alta)) throw new Error('El acompañamiento comienza cuando el pago y el alta ya están confirmados. Revisá la fecha de inicio.')
  return { inicio: raw.inicio, fin: finAcompanamiento(raw.inicio), version: raw.version as number | null }
}
function validarDatosCobro(x: Record<string, unknown>, hoy?: string): DatosCobroSocia {
  const concepto = texto(x.concepto, 160, true)!, nota = texto(x.nota, 1200)
  exigirFecha(x.vencimiento)
  if (x.monto !== null && (typeof x.monto !== 'number' || !Number.isFinite(x.monto) || x.monto <= 0 || x.monto > 1e9 || Math.abs(x.monto * 100 - Math.round(x.monto * 100)) > .00001)) throw new Error('El importe debe ser mayor a cero, con hasta dos decimales, o quedar vacío.')
  if (!(x.moneda === null || x.moneda === 'ARS' || x.moneda === 'USD') || (x.monto === null) !== (x.moneda === null)) throw new Error('Completá importe y moneda juntos, o dejá ambos por definir.')
  if (!(typeof x.estado === 'string' && Object.hasOwn(ESTADOS_COBRO, x.estado))) throw new Error('Elegí un estado de pago válido.')
  if (x.estado === 'pagado') {
    exigirFecha(x.pagado_en)
    if (hoy && x.pagado_en > hoy) throw new Error('La fecha del pago confirmado no puede ser futura.')
  } else if (x.pagado_en !== null) throw new Error('Solo los pagos confirmados llevan una fecha de pago.')
  return { concepto, vencimiento: x.vencimiento, monto: x.monto as number | null, moneda: x.moneda as DatosCobroSocia['moneda'], estado: x.estado as DatosCobroSocia['estado'], pagado_en: x.pagado_en as string | null, nota }
}
export function validarCobroSocia(raw: unknown, hoy: string) {
  exigirFecha(hoy)
  if (!objeto(raw) || !claves(raw, ['id', 'version', 'concepto', 'vencimiento', 'monto', 'moneda', 'estado', 'pagado_en', 'nota']) || !uuid(raw.id) || !(raw.version === null || version(raw.version, true))) throw new Error('Registro de cobro no válido. Actualizá la ficha antes de editar.')
  return { id: raw.id, version: raw.version as number | null, datos: validarDatosCobro(raw, hoy) }
}
export function resumenSeguimiento(socias: readonly SociaSeguimiento[], hoy: string) {
  const reales = socias.filter(s => !s.prueba)
  const resumen = { socias: reales.length, vigentes: 0, por_vencer: 0, vencidas: 0, sin_fecha: 0, pendientes: 0, cobros_vencidos: 0 }
  for (const socia of reales) {
    const estado = estadoAcompanamiento(socia.acompanamiento, hoy)
    if (estado === 'vigente' || estado === 'por_vencer') resumen.vigentes++
    if (estado === 'por_vencer') resumen.por_vencer++
    if (estado === 'vencido') resumen.vencidas++
    if (estado === 'sin_fecha') resumen.sin_fecha++
    for (const cobro of socia.cobros) if (cobro.estado === 'pendiente') { resumen.pendientes++; if (cobroVencido(cobro, hoy)) resumen.cobros_vencidos++ }
  }
  return resumen
}
