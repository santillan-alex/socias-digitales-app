import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'
import AdminRecovery from './AdminRecovery'
import { FILTRO_CUENTAS_PRUEBA, esCuentaPrueba } from '@/lib/test-accounts'
import { createAdminClient, isAdminSupabaseConfigured } from '@/lib/supabase/admin'
import { identidadesDeCuentas, type IdentidadCuenta } from '@/lib/admin-team'
import { leerSolicitudesFarmasi } from '@/lib/admin-student-directory-server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil, error: errorPerfil } = await Promise.resolve(supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()).catch(() => ({ data: null, error: new Error('profile_read_failed') }))

  if (errorPerfil) return <AdminRecovery />
  if (perfil?.rol !== 'admin') redirect('/perfil')

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()

  const lecturas = await Promise.all([
    supabase.from('perfiles').select('*').not('id', 'in', FILTRO_CUENTAS_PRUEBA).order('created_at', { ascending: false }),
    supabase.from('pagos').select('monto').or(`alumna_id.is.null,alumna_id.not.in.${FILTRO_CUENTAS_PRUEBA}`).gte('fecha', inicioMes).eq('estado', 'completado'),
    supabase.from('pagos').select('monto').or(`alumna_id.is.null,alumna_id.not.in.${FILTRO_CUENTAS_PRUEBA}`).eq('estado', 'completado'),
    supabase.from('ventas_afiliadas').select('*').not('afiliada_id', 'in', FILTRO_CUENTAS_PRUEBA).gte('fecha', inicioMes),
  ]).catch(() => null)
  if (!lecturas || lecturas.some(lectura => lectura.error || !Array.isArray(lectura.data))) return <AdminRecovery />
  const [{ data: perfiles }, { data: pagosDelMes }, { data: todosLosPagos }, { data: ventasAfiliadas }] = lecturas

  // Administración no es un tipo de alumna ni forma parte de estos indicadores.
  const alumnas = perfiles?.filter(perfil => perfil.rol !== 'admin' && !esCuentaPrueba(perfil.id)) ?? []

  // Only read requests for the students already returned to this verified admin.
  // A failure is unknown, never proof that a particular student has no request.
  const solicitudesFarmasi = await leerSolicitudesFarmasi({ supabase, userId: user.id, admin: true }, alumnas.map(alumna => alumna.id))
  const stats = {
    fechaReferencia: hoy.getTime(),
    totalAlumnas: alumnas?.length ?? 0,
    activas: alumnas?.filter(a => a.estado === 'activa').length ?? 0,
    nuevasHoy: alumnas?.filter(a => a.created_at >= inicioHoy).length ?? 0,
    nuevasMes: alumnas?.filter(a => a.created_at >= inicioMes).length ?? 0,
    canceladas: alumnas?.filter(a => a.estado === 'cancelada').length ?? 0,
    pausadas: alumnas?.filter(a => a.estado === 'pausada').length ?? 0,
    mrr: pagosDelMes?.reduce((acc, p) => acc + Number(p.monto), 0) ?? 0,
    facturacionHistorica: todosLosPagos?.reduce((acc, p) => acc + Number(p.monto), 0) ?? 0,
    afiliadasActivas: alumnas?.filter(a => a.rol === 'afiliada').length ?? 0,
    ventasMes: ventasAfiliadas?.length ?? 0,
    comisionesMes: ventasAfiliadas?.reduce((acc, v) => acc + Number(v.comision), 0) ?? 0,
    solicitudesFarmasiPendientes: solicitudesFarmasi ? alumnas.filter(a => a.socias_farmaci_habilitada !== true && solicitudesFarmasi.has(a.id)).length : null,
    solicitudesDesafioPendientes: alumnas?.filter(a => a.rol !== 'admin' && a.tipo_usuario === 'desafio' && a.desafio_socias_estado === 'pendiente' && !a.desafio_socias_habilitada).length ?? 0,
  }

  const retencion = stats.totalAlumnas > 0
    ? Math.round((stats.activas / stats.totalAlumnas) * 100)
    : 0

  // Solo cuentas presentes en la lista ya autorizada, sin administradoras ni
  // pruebas. Una falla del directorio no convierte cuentas en no confirmadas.
  let identidades: Map<string, IdentidadCuenta> | null = null
  let errorDirectorio = false
  if (alumnas.length) {
    try {
      if (!isAdminSupabaseConfigured()) throw new Error('directory_unavailable')
      identidades = await identidadesDeCuentas(createAdminClient(), alumnas.map(alumna => alumna.id))
    } catch { errorDirectorio = true; console.error('admin_student_directory_read_failed') }
  }
  const alumnasConCuenta = alumnas.map(alumna => ({
    ...alumna,
    socias_farmaci_habilitada: typeof alumna.socias_farmaci_habilitada === 'boolean' ? alumna.socias_farmaci_habilitada : null,
    socias_farmasi_pendiente: solicitudesFarmasi ? solicitudesFarmasi.has(alumna.id) : null,
    email: identidades?.get(alumna.id)?.email ?? null,
    email_confirmado: identidades?.get(alumna.id)?.email_confirmado ?? null,
    cuenta_encontrada: identidades?.get(alumna.id)?.cuenta_encontrada ?? null,
  }))
  return <AdminDashboard alumnas={alumnasConCuenta} stats={{ ...stats, retencion }} errorDirectorio={errorDirectorio} />
}
