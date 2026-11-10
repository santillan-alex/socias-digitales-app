import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClassroomCliente from './ClassroomCliente'
import { leerCatalogoClases } from '@/lib/class-catalog'
import { leerProgresoClases } from '@/lib/class-progress-server'
import type { ProgresoClase } from '@/lib/class-progress'
import ClassroomRecovery from './ClassroomRecovery'
import { esUuid } from '@/lib/class-management'

export default async function ClassroomPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = props?.searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('nombre, avatar_url, rol, tipo_usuario, estado, plan, desafio_socias_habilitada')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil) return <ClassroomRecovery esAdmin={false} />
  let clasesParaVista: Awaited<ReturnType<typeof leerCatalogoClases>>
  try { clasesParaVista = await leerCatalogoClases(perfil) }
  catch {
    console.error('class_catalog_read_failed')
    return <ClassroomRecovery esAdmin={perfil.rol === 'admin'} />
  }
  let progreso: ProgresoClase[] = []
  let errorProgreso = false
  if (perfil.rol !== 'admin') {
    try { progreso = await leerProgresoClases(supabase,user.id) }
    catch { errorProgreso = true }
  }

  const consulta = await searchParams
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
