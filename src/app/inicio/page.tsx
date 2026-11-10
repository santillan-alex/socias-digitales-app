import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProximaClase from './ProximaClase'
import ArrowIcon from '@/components/ArrowIcon'
import StudentShellFrame from '@/components/StudentShellFrame'
import LockedModules from '@/components/LockedModules'
import FreeStart from '@/components/FreeStart'
import { leerCatalogoClases } from '@/lib/class-catalog'
import { leerAvisosSinLeer } from '@/lib/unread-notices'
import { UnreadNoticeLink } from '@/components/UnreadNotices'
import { permisoResultados } from '@/lib/results-server'
import { permisoMetricas } from '@/lib/metrics-server'
import { permisoMiDia } from '@/lib/my-day-server'
import { puedeVerLogros } from '@/lib/achievements'
import { leerAgenda } from '@/lib/agenda-store'
import { hitoParaAlumna } from '@/lib/agenda-management'
import type { HitoAgenda } from '@/lib/agenda'
import { accesoInicio } from '@/lib/home-access'
import CampusFormation from './CampusFormation'
import { HomeCampusLoading } from '@/components/HomeCampus'
import { fechaArgentina } from '@/lib/metrics'
import { puedeUsarComunidad } from '@/lib/community'
import PersonalCalendar from './PersonalCalendar'
import { HomeCalendarLoading } from '@/components/HomeCalendar'
import { leerAccesoAfiliadas } from '@/lib/affiliate-access-server'

async function leerHoraServidor() {
  return Date.now()
}

export default async function InicioPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = props?.searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil, error: errorPerfil } = await supabase
    .from('perfiles')
    .select('nombre, avatar_url, rol, tipo_usuario, estado, desafio_socias_habilitada, desafio_socias_estado')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil?.rol === 'admin') redirect('/admin')
  if (errorPerfil || !perfil) return <main className="min-h-screen bg-[#F4EFEA] px-5 py-12"><section className="mx-auto max-w-xl rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h1 className="font-serif text-3xl">No pudimos comprobar tu acceso.</h1><p role="alert" className="mt-4 text-sm leading-6">Volvé a intentarlo. Tu cuenta y tus avances no se modificaron.</p><a href="/inicio" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Reintentar</a></section></main>
  const [accesoResultados,accesoMetricas,accesoMiDia,accesoAfiliadas] = await Promise.all([permisoResultados(supabase,user.id),permisoMetricas(supabase,user.id),permisoMiDia(supabase,user.id),leerAccesoAfiliadas(supabase,user.id,perfil)])
  const resumenAvisos = await leerAvisosSinLeer(supabase, user.id)
  const nombre = perfil?.nombre?.trim().split(' ')[0] || user.user_metadata?.nombre || 'Socia'

  const acceso = accesoInicio(perfil)
  const tipoUsuario = acceso.nivel
  const habilitada = acceso.formacion
  const soloAfiliada = accesoAfiliadas.habilitada && !habilitada
  const esDesafio = tipoUsuario === 'desafio'
  const mostrarClase = acceso.formacion
  const { data: accesoEstrategia, error: errorEstrategia } = await supabase.from('accesos_estrategia').select('habilitada').eq('usuaria_id', user.id).maybeSingle()
  // El guardado heredado de Estrategia aún exige Desafío en RLS. No anunciar
  // un módulo habilitado para una Socia que todavía no puede persistirlo.
  const estrategiaHabilitada = habilitada && Boolean(perfil.desafio_socias_habilitada && accesoEstrategia?.habilitada)
  const ahoraInicial = await leerHoraServidor()
  const mesCalendario = (await searchParams)?.mes
  const esGratuito = acceso.gratuito
  const clasesGratuitas = esGratuito && !soloAfiliada && perfil ? await leerCatalogoClases(perfil) : []
  const accesoCerrado = perfil?.desafio_socias_estado === 'rechazada' || perfil?.desafio_socias_estado === 'bloqueada'
  let hitos: HitoAgenda[] = [], errorAgenda = false
  if (mostrarClase && perfil) {
    try { hitos = hitoParaAlumna((await leerAgenda()).hito, perfil) }
    catch { errorAgenda = true; console.error('agenda_read_failed') }
  }
  return (
    <StudentShellFrame datos={{ nombre, formacion: mostrarClase, comunidad: puedeUsarComunidad(perfil), afiliadas: accesoAfiliadas.habilitada,
      herramientas: { resultados: accesoResultados.permitido && !accesoResultados.error, metricas: accesoMetricas.permitido && !accesoMetricas.error, miDia: accesoMiDia.permitido && !accesoMiDia.error, logros: puedeVerLogros(perfil) },
      ahoraInicial, hitos, errorAgenda, avisos: resumenAvisos }}>

        <main className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#294A38]">{soloAfiliada ? 'Afiliadas' : acceso.etiqueta}</p>
              <h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Hola, {nombre}.</h1>
            </div>
            <Link href="/perfil" className="inline-flex items-center gap-2 text-sm font-medium text-[#294A38]">Mi perfil <ArrowIcon diagonal /></Link>
          </div>

          {mostrarClase && <div className="mt-5"><ProximaClase ahoraInicial={ahoraInicial} variante="banner" /></div>}

          {accesoAfiliadas.habilitada && <section aria-label="Tu espacio de Afiliadas" className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-[24px] border border-[#EC9BB6] bg-[#F4CAD8] p-6"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Para acompañar tus ventas</p><h2 className="mt-2 text-2xl font-semibold">Tu espacio de Afiliadas</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#746A64]">Mensajes de Flor, textos listos para adaptar y materiales de cada campaña.</p></div><Link href="/afiliadas" prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Entrar a Afiliadas <ArrowIcon /></Link></section>}
          {accesoAfiliadas.error && <p role="alert" className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4 text-sm text-[#746A64]">No pudimos comprobar el acceso a Afiliadas. <a href="/inicio" className="inline-flex min-h-11 items-center font-semibold text-[#294A38] underline">Actualizar</a></p>}

          {soloAfiliada ? null : acceso.suspendido ? <section className="mt-7 max-w-3xl rounded-[24px] border border-[#EC9BB6] bg-[#F4CAD8] p-6 sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#211c19]/55">Tu acceso</p><h2 className="mt-3 font-serif text-3xl font-semibold">Tu acceso al contenido pago está pausado.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#211c19]/70">Tus datos y avances siguen guardados. Si necesitás revisar tu acceso, comunicate con el equipo de Socias Digitales. Podés seguir entrando a tu perfil y tus avisos.</p><Link href="/perfil" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Ir a mi perfil <ArrowIcon /></Link></section> : esGratuito ? <FreeStart clases={clasesGratuitas} /> : !habilitada && esDesafio ? (
            <section className="mt-7 max-w-3xl rounded-[24px] bg-[#F4CAD8] p-6 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#211c19]/55">Inscripción recibida</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold">{accesoCerrado ? 'Tu acceso no está habilitado.' : 'Tu acceso está en revisión.'}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#211c19]/70">{accesoCerrado ? 'Contactá a la administradora del Desafío Socias para consultar tu inscripción.' : 'Cuando Flor habilite tu inscripción, vas a recibir el email de bienvenida para entrar a tus clases. Flor habilita Estrategia por separado.'}</p>
              <Link href="/perfil" className="mt-6 inline-flex rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#203a2c]">Revisar mi perfil&nbsp; →</Link>
            </section>
          ) : !habilitada ? (
            <section className="mt-7 max-w-3xl rounded-[24px] bg-[#F4CAD8] p-6 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#211c19]/55">{tipoUsuario === 'socia' ? 'Espacio de socia' : 'Bienvenida'}</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold">Tu cuenta está lista.</h2>
            </section>
          ) : (
            <>
              <Suspense fallback={<HomeCampusLoading />}><CampusFormation supabase={supabase} usuariaId={user.id} perfil={perfil} permisoMiDia={accesoMiDia} fecha={fechaArgentina(new Date(ahoraInicial))} /></Suspense>
              <Suspense fallback={<HomeCalendarLoading />}><PersonalCalendar supabase={supabase} usuariaId={user.id} perfil={perfil} permisoMiDia={accesoMiDia} hoy={fechaArgentina(new Date(ahoraInicial))} mes={mesCalendario} hitos={hitos} errorAgenda={errorAgenda} /></Suspense>
              <section aria-label="Otros espacios" className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Materiales', href: '/clases/materiales', note: 'Documentos y enlaces de tus clases', tone: 'bg-[#FFFDFA] border border-[#E7DDD5]' },
                  { label: 'Estrategia', href: '/lanzamiento', note: errorEstrategia ? 'Acceso sin comprobar' : estrategiaHabilitada ? 'Etapas y tareas' : 'Pendiente de habilitación', tone: 'bg-[#FFFDFA] border border-[#E7DDD5]' },
                  { label: 'Mi perfil', href: '/perfil', note: 'Tus datos y cuenta', tone: 'bg-[#F4EFEA] border border-[#EC9BB6]/60' },
                ].map(item => <Link key={item.href} href={item.href} prefetch={item.href === '/clases/materiales' ? false : undefined} className={`flex min-h-20 items-center justify-between gap-3 rounded-[20px] px-5 py-4 transition hover:border-[#EC9BB6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] ${item.tone}`}><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-[#746a64]">{item.note}</span></span><ArrowIcon diagonal /></Link>)}
              </section>
            </>
          )}
          {!habilitada && <UnreadNoticeLink variante="tarjeta" />}
          {!soloAfiliada && <LockedModules compacto={habilitada} erroresPermiso={[...(accesoResultados.error ? ['resultados' as const] : []), ...(accesoMetricas.error ? ['metricas' as const] : []), ...(accesoMiDia.error ? ['checklist' as const] : [])]} venta={esGratuito} resultadosHabilitados={accesoResultados.permitido} metricasHabilitadas={accesoMetricas.permitido} miDiaHabilitado={accesoMiDia.permitido} logrosHabilitados={puedeVerLogros(perfil)} comunidadHabilitada={puedeUsarComunidad(perfil)} />}
        </main>
    </StudentShellFrame>
  )
}
