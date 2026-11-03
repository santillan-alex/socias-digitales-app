import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { createClient } from './supabase/server'
import { esUuid } from './class-management'
import { esCuentaPrueba } from './test-accounts'
import { ErrorRecursosCrm, autorizarRecursosCrm, ejecutarCrm, leerJsonCrm, responderCrm } from './resource-crm-server'
import { esAccesoAfiliadas, type AccesoAfiliadas, type ListaAccesosAfiliadas } from './affiliate-access-client'
export type { AccesoAfiliadas, CuentaAfiliada, ListaAccesosAfiliadas } from './affiliate-access-client'

type Cliente = Awaited<ReturnType<typeof createClient>>
const CAMPOS = 'usuaria_id,habilitada,version,actualizada_en'

// Solo presentación: el llamador ya verificó Auth y su perfil propio. La API
// y RLS del espacio vuelven a comprobar el acceso en cada lectura.
export async function leerAccesoAfiliadas(supabase: Cliente, userId: string, perfil: { rol?: string | null; estado?: string | null } | null): Promise<{ habilitada: boolean; error: boolean }> {
  if (!perfil || perfil.rol === 'admin' || perfil.estado !== 'activa') return { habilitada: false, error: false }
  try {
    const { data, error } = await supabase.from('accesos_afiliadas').select(CAMPOS).eq('usuaria_id', userId).maybeSingle()
    if (error || data && (!esAccesoAfiliadas(data) || data.usuaria_id !== userId)) return { habilitada: false, error: true }
    return { habilitada: data?.habilitada === true, error: false }
  } catch (cause) { unstable_rethrow(cause); return { habilitada: false, error: true } }
}

export async function leerCuentasAfiliadas(): Promise<ListaAccesosAfiliadas> {
  const auth = await autorizarRecursosCrm()
  if ('error' in auth) return { estado: 'error', mensaje: auth.error.mensaje }
  try {
    const perfiles = await auth.supabase.from('perfiles').select('id,nombre,rol,tipo_usuario,estado').neq('rol', 'admin').order('created_at', { ascending: false }).order('id').limit(501)
    if (perfiles.error || !Array.isArray(perfiles.data)) throw new Error('profiles_unavailable')
    const filas = perfiles.data.slice(0, 500)
    const ids = filas.map(p => p.id)
    const tandas: string[][] = []
    for (let i = 0; i < ids.length; i += 100) tandas.push(ids.slice(i, i + 100))
    const partes = await Promise.all(tandas.map(tanda => auth.supabase.from('accesos_afiliadas').select(CAMPOS).in('usuaria_id', tanda)))
    const permisos = { data: partes.flatMap(p => p.data ?? []), error: partes.some(p => p.error) }
    if (permisos.error || !Array.isArray(permisos.data) || permisos.data.some(p => !esAccesoAfiliadas(p) || !ids.includes(p.usuaria_id))) throw new Error('access_unavailable')
    const porId = new Map(permisos.data.map(p => [p.usuaria_id, p as AccesoAfiliadas]))
    if (porId.size !== permisos.data.length) throw new Error('duplicate_access')
    return { estado: 'lista', cuentas: filas.map(p => ({ id: p.id, nombre: p.nombre || 'Sin nombre', tipo: p.tipo_usuario, estado: p.estado, prueba: esCuentaPrueba(p.id), acceso: porId.get(p.id) ?? null })), limitado: perfiles.data.length > 500 }
  } catch (cause) { unstable_rethrow(cause); return { estado: 'error', mensaje: 'No pudimos comprobar las cuentas y sus permisos. Reintentá; no se muestran cifras parciales.' } }
}

export async function cambiarAccesoAfiliadas(request: Request, id: string) {
  return ejecutarCrm(request, true, async auth => {
    if (!esUuid(id) || new URL(request.url).search) throw new ErrorRecursosCrm(400, 'Cuenta no válida.')
    const raw = await leerJsonCrm(request)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ErrorRecursosCrm(400, 'Revisá la solicitud de acceso.')
    const x = raw as Record<string, unknown>
    if (Object.keys(x).sort().join(',') !== 'habilitada,version' || typeof x.habilitada !== 'boolean' || !(x.version === null || Number.isSafeInteger(x.version) && Number(x.version) > 0 && Number(x.version) < 1_000_000_000)) throw new ErrorRecursosCrm(400, 'Revisá el permiso y la versión de la cuenta.')
    const perfil = await auth.supabase.from('perfiles').select('id,rol,estado').eq('id', id).maybeSingle()
    if (perfil.error) throw new ErrorRecursosCrm(503, 'No pudimos comprobar la cuenta.')
    if (!perfil.data || perfil.data.rol === 'admin') throw new ErrorRecursosCrm(404, 'Cuenta no disponible para Afiliadas.')
    if (x.habilitada && perfil.data.estado !== 'activa') throw new ErrorRecursosCrm(409, 'Primero revisá el estado de la cuenta; no está activa.')
    const leer = () => auth.supabase.from('accesos_afiliadas').select(CAMPOS).eq('usuaria_id', id).maybeSingle()
    const versionEsperada = x.version === null ? 1 : Number(x.version) + 1
    const coincide = (row: unknown) => esAccesoAfiliadas(row) && row.usuaria_id === id && row.habilitada === x.habilitada && row.version === versionEsperada
    const anterior = await leer()
    if (anterior.error) throw new ErrorRecursosCrm(503, 'No pudimos comprobar el permiso actual.')
    if (coincide(anterior.data)) return responderCrm({ ok: true, acceso: anterior.data })
    if (x.version === null ? anterior.data !== null : !esAccesoAfiliadas(anterior.data) || anterior.data.version !== x.version) throw new ErrorRecursosCrm(409, 'El permiso cambió. Actualizá la lista antes de modificarlo.')
    const cambio = x.version === null ? auth.supabase.from('accesos_afiliadas').insert({ usuaria_id: id, habilitada: x.habilitada }) : auth.supabase.from('accesos_afiliadas').update({ habilitada: x.habilitada }).eq('usuaria_id', id).eq('version', x.version)
    const guardado = await cambio.select(CAMPOS).maybeSingle()
    if (!guardado.error && coincide(guardado.data)) return responderCrm({ ok: true, acceso: guardado.data })
    const confirmada = await leer()
    if (!confirmada.error && coincide(confirmada.data)) return responderCrm({ ok: true, acceso: confirmada.data })
    if (guardado.error?.code === '42501') throw new ErrorRecursosCrm(403, 'Tu permiso cambió. Volvé a ingresar al panel.')
    if (guardado.error?.code === '23505' || !guardado.error || confirmada.data && esAccesoAfiliadas(confirmada.data) && confirmada.data.version !== x.version) throw new ErrorRecursosCrm(409, 'Otra persona cambió este acceso. Actualizá la lista.')
    throw new ErrorRecursosCrm(503, 'No pudimos confirmar el guardado. Reintentá el mismo envío para comprobarlo.')
  })
}
