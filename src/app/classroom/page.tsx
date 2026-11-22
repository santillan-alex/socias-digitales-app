import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClassroomCliente from './ClassroomCliente'
import { leerCatalogoClases } from '@/lib/class-catalog'
import { leerProgresoClases } from '@/lib/class-progress-server'
import type { ProgresoClase } from '@/lib/class-progress'
import ClassroomRecovery from './ClassroomRecovery'
import { tieneAccesoFarmaci } from '@/lib/class-access'
import { FLUJO_FARMASI, RUTA_FARMASI, soloClasesFarmasi } from '@/lib/farmasi-registration'
import { esUuid } from '@/lib/class-management'
import { leerGruposFarmasi } from '@/lib/farmasi-class-groups-server'

export default async function ClassroomPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const consulta = await props?.searchParams
  const espacioFarmasi = consulta?.espacio === FLUJO_FARMASI
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('nombre, avatar_url, rol, tipo_usuario, estado, plan, desafio_socias_habilitada,socias_farmaci_habilitada')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil) return <ClassroomRecovery esAdmin={false} />
  if (espacioFarmasi && !tieneAccesoFarmaci(perfil)) redirect(RUTA_FARMASI)
  let clasesParaVista: Awaited<ReturnType<typeof leerCatalogoClases>>
  try {
    const catalogo = await leerCatalogoClases(perfil)
    clasesParaVista = espacioFarmasi ? soloClasesFarmasi(catalogo) : catalogo
  }
  catch {
    console.error('class_catalog_read_failed')
    return <ClassroomRecovery esAdmin={perfil.rol === 'admin'} />
  }
  const submodulosFarmasi = espacioFarmasi ? leerGruposFarmasi(clasesParaVista) : undefined
  let progreso: ProgresoClase[] = []
  let errorProgreso = false
  if (perfil.rol !== 'admin') {
    try { progreso = await leerProgresoClases(supabase,user.id) }
    catch { errorProgreso = true }
  }

  if (espacioFarmasi) {
    const idsFarmasi = new Set(clasesParaVista.map(clase => clase.id))
    progreso = progreso.filter(avance => idsFarmasi.has(avance.clase_id))
  }
  const solicitada = consulta?.clase
  const idSolicitado = typeof solicitada === 'string' && esUuid(solicitada) ? solicitada.toLowerCase() : null
  // El parámetro selecciona del catálogo autorizado: nunca consulta otra clase
  // ni incorpora un permiso, una URL privada o contenido oculto.
  const claseInicial = idSolicitado ? clasesParaVista.find(clase => clase.id.toLowerCase() === idSolicitado && clase.activo && clase.puede_ver === true && (clase.tiene_video_privado || clase.vimeo_url)) : null
  const avisoClaseInicial = solicitada !== undefined && !claseInicial
    ? 'Este enlace de clase no está disponible para tu cuenta. Podés seguir explorando las clases de tu biblioteca.'
    : null

  return (
    <ClassroomCliente
      espacioFarmasi={espacioFarmasi}
      submodulosFarmasi={await submodulosFarmasi}
      clases={clasesParaVista}
      esAdmin={perfil?.rol === 'admin'}
      perfil={perfil}
      progresoInicial={progreso}
      errorProgreso={errorProgreso}
      claseInicialId={claseInicial?.id ?? null}
      avisoClaseInicial={avisoClaseInicial}
    />
  )
}
