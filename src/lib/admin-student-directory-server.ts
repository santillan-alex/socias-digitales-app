import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import { createAdminClient, isAdminSupabaseConfigured } from './supabase/admin'
import { identidadesDeCuentas, type IdentidadCuenta } from './admin-team'
import { esIdAfiliadas } from './affiliate-hub'
import { esCuentaPrueba, FILTRO_CUENTAS_PRUEBA } from './test-accounts'
import { esCuentaDirectorioAlumna, esDirectorioAlumnas, fechaDirectorioValida, LIMITE_DIRECTORIO_ALUMNAS,
  type CuentaDirectorioAlumna, type DirectorioAlumnas, type EstadoDesafioDirectorio, type EstadoDirectorioAlumna, type TipoDirectorioAlumna } from './admin-student-directory'

export interface SesionDirectorioAlumnas { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; admin: true }
export const HEADERS_DIRECTORIO_ALUMNAS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
const CAMPOS = 'id,nombre,whatsapp,pais,estado,tipo_usuario,rol,desafio_socias_habilitada,desafio_socias_estado,created_at'
const TAMANO_PAGINA = 500, MAX_PAGINAS = 100, TAMANO_LOTE_ACCESOS = 100
type PerfilLeido = Omit<CuentaDirectorioAlumna, 'email' | 'email_confirmado' | 'cuenta_encontrada' | 'ultimo_acceso' | 'afiliadas_habilitada'>
async function aTiempo<T>(promesa: PromiseLike<T>, timeoutMs = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([Promise.resolve(promesa), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('directory_timeout')), timeoutMs) })]).finally(() => clearTimeout(timer))
}
export async function autorizarDirectorioAlumnas(): Promise<SesionDirectorioAlumnas | { error: { status: number; mensaje: string } }> {
  try {
    const supabase = await createClient(), { data: { user }, error } = await aTiempo(supabase.auth.getUser())
    if (error || !user) return { error: { status: 401, mensaje: 'Iniciá sesión para entrar al panel.' } }
    if (!esIdAfiliadas(user.id)) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } }
    const perfil = await aTiempo(supabase.from('perfiles').select('id,rol').eq('id', user.id).maybeSingle())
    if (perfil.error || !perfil.data || perfil.data.id !== user.id) return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } }
    if (perfil.data.rol !== 'admin') return { error: { status: 403, mensaje: 'Este directorio está reservado al equipo de Flor.' } }
    return { supabase, userId: user.id, admin: true }
  } catch (error) { unstable_rethrow(error); return { error: { status: 503, mensaje: 'No pudimos comprobar tu acceso.' } } }
}
function objeto(x: unknown): x is Record<string, unknown> { return Boolean(x && typeof x === 'object' && !Array.isArray(x)) }
function texto(x: unknown, max: number) {
  if (x === null) return null
  if (typeof x !== 'string' || x.length > max || /[\u0000-\u001f\u007f]/.test(x)) throw new Error('invalid_profile')
  return x.trim().normalize('NFC') || null
}
function fecha(x: unknown): string | null { if (x === null) return null; if (!fechaDirectorioValida(x)) throw new Error('invalid_date'); return x }
function perfilDto(raw: unknown): PerfilLeido | null {
  if (!objeto(raw) || !esIdAfiliadas(raw.id) || !(raw.rol === null || typeof raw.rol === 'string')) throw new Error('invalid_profile')
  if (raw.rol === 'admin' || esCuentaPrueba(raw.id)) return null
  if (!(raw.desafio_socias_habilitada === null || typeof raw.desafio_socias_habilitada === 'boolean') || !(raw.tipo_usuario === null || typeof raw.tipo_usuario === 'string') || !(raw.estado === null || typeof raw.estado === 'string') || !(raw.desafio_socias_estado === null || typeof raw.desafio_socias_estado === 'string')) throw new Error('invalid_profile')
  return {
    id: raw.id, nombre: texto(raw.nombre, 240), whatsapp: texto(raw.whatsapp, 80), pais: texto(raw.pais, 120), created_at: fecha(raw.created_at),
    tipo_usuario: ['gratuito', 'desafio', 'socia'].includes(String(raw.tipo_usuario)) ? raw.tipo_usuario as TipoDirectorioAlumna : null,
    estado: ['activa', 'pausada', 'cancelada'].includes(String(raw.estado)) ? raw.estado as EstadoDirectorioAlumna : null,
    desafio_socias_habilitada: raw.desafio_socias_habilitada as boolean | null,
    desafio_socias_estado: ['no_aplica', 'pendiente', 'habilitada', 'rechazada', 'bloqueada'].includes(String(raw.desafio_socias_estado)) ? raw.desafio_socias_estado as EstadoDesafioDirectorio : null,
  }
}
async function leerPerfiles(auth: SesionDirectorioAlumnas) {
  const perfiles: PerfilLeido[] = [], ids = new Set<string>(); let offset = 0, cantidad: number | null = null
  for (let pagina = 0; pagina < MAX_PAGINAS && offset < LIMITE_DIRECTORIO_ALUMNAS; pagina++) {
    const fin = Math.min(offset + TAMANO_PAGINA, LIMITE_DIRECTORIO_ALUMNAS) - 1
    const result = await aTiempo(auth.supabase.from('perfiles').select(CAMPOS, { count: 'exact' }).or('rol.neq.admin,rol.is.null').not('id', 'in', FILTRO_CUENTAS_PRUEBA).order('id').range(offset, fin))
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || Number(result.count) < 0 || result.data.length > fin - offset + 1) throw new Error('profile_read_failed')
    if (cantidad !== null && result.count !== cantidad || offset + result.data.length > Number(result.count)) throw new Error('profile_snapshot_changed')
    cantidad = Number(result.count)
    for (const raw of result.data) {
      const perfil = perfilDto(raw)
      if (!perfil) continue
      if (ids.has(perfil.id)) throw new Error('duplicate_profile')
      ids.add(perfil.id); perfiles.push(perfil)
    }
    offset += result.data.length
    if (offset >= cantidad) return { perfiles, limitado: cantidad > LIMITE_DIRECTORIO_ALUMNAS || perfiles.length !== cantidad }
    if (!result.data.length) throw new Error('incomplete_profile_page')
  }
  return { perfiles, limitado: true }
}
async function leerHabilitaciones(auth: SesionDirectorioAlumnas, ids: string[]) {
  const lotes: string[][] = [], permisos = new Map<string, boolean>()
  for (let i = 0; i < ids.length; i += TAMANO_LOTE_ACCESOS) lotes.push(ids.slice(i, i + TAMANO_LOTE_ACCESOS))
  try {
    for (let i = 0; i < lotes.length; i += 4) {
      const partes = await Promise.all(lotes.slice(i, i + 4).map(async lote => {
        const result = await aTiempo(auth.supabase.from('accesos_afiliadas').select('usuaria_id,habilitada', { count: 'exact' }).in('usuaria_id', lote).range(0, lote.length - 1))
        if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count !== result.data.length || result.data.length > lote.length) throw new Error('grant_read_failed')
        for (const row of result.data) if (!objeto(row) || typeof row.usuaria_id !== 'string' || !lote.includes(row.usuaria_id) || typeof row.habilitada !== 'boolean') throw new Error('invalid_grant')
        return result.data as { usuaria_id: string; habilitada: boolean }[]
      }))
      for (const row of partes.flat()) { if (permisos.has(row.usuaria_id)) throw new Error('duplicate_grant'); permisos.set(row.usuaria_id, row.habilitada) }
    }
    return permisos
  } catch (error) { unstable_rethrow(error); return null }
}
async function leerIdentidades(ids: string[]) {
  try {
    if (!isAdminSupabaseConfigured()) throw new Error('directory_unconfigured')
    const identidades = await identidadesDeCuentas(createAdminClient(), ids)
    if (!(identidades instanceof Map) || identidades.size !== ids.length || [...identidades.keys()].some(id => !ids.includes(id))) throw new Error('invalid_identities')
    return identidades
  } catch (error) { unstable_rethrow(error); return null }
}
function conIdentidad(perfil: PerfilLeido, identidad: IdentidadCuenta | null): CuentaDirectorioAlumna {
  if (identidad && (!(identidad.email === null || typeof identidad.email === 'string') || !(identidad.email_confirmado === null || typeof identidad.email_confirmado === 'boolean') || typeof identidad.cuenta_encontrada !== 'boolean')) throw new Error('invalid_identity')
  const row = { ...perfil, email: identidad?.email ?? null, email_confirmado: identidad?.email_confirmado ?? null, cuenta_encontrada: identidad?.cuenta_encontrada ?? null, ultimo_acceso: identidad?.ultimo_acceso ?? null, afiliadas_habilitada: null }
  if (!esCuentaDirectorioAlumna(row)) throw new Error('invalid_identity')
  return row
}
export async function leerDirectorioAlumnas(auth: SesionDirectorioAlumnas): Promise<DirectorioAlumnas> {
  try {
    if (auth.admin !== true || !esIdAfiliadas(auth.userId)) throw new Error('invalid_admin_session')
    const { perfiles, limitado } = await leerPerfiles(auth), ids = perfiles.map(p => p.id)
    if (!ids.length) return { estado: 'lista', cuentas: [], limitado, errorIdentidades: false, errorAfiliadas: false }
    const [grants, identidades] = await Promise.all([leerHabilitaciones(auth, ids), leerIdentidades(ids)])
    let conCuentas: CuentaDirectorioAlumna[], errorIdentidades = identidades === null
    try {
      conCuentas = perfiles.map(p => {
        const identidad = identidades?.get(p.id) ?? null
        if (identidades && (!identidad || typeof identidad.cuenta_encontrada !== 'boolean')) throw new Error('missing_identity')
        return conIdentidad(p, identidad)
      })
    } catch (error) { unstable_rethrow(error); errorIdentidades = true; conCuentas = perfiles.map(p => conIdentidad(p, null)) }
    const resultado: DirectorioAlumnas = { estado: 'lista', cuentas: conCuentas.map(c => ({ ...c, afiliadas_habilitada: grants ? grants.get(c.id) ?? false : null })), limitado, errorIdentidades, errorAfiliadas: grants === null }
    if (!esDirectorioAlumnas(resultado)) throw new Error('invalid_directory')
    return resultado
  } catch (error) { unstable_rethrow(error); return { estado: 'error', mensaje: 'No pudimos comprobar el listado de alumnas. Volvé a intentar; no se muestran cifras incompletas como definitivas.' } }
}
