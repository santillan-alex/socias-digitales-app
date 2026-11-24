'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ClassPlayer from './ClassPlayer'
import ClassroomProgram from './ClassroomProgram'
import { ubicacionClase, ordenarClases, esUuid } from '@/lib/class-management'
import { claseParaContinuar, tiempoClase, type ProgresoClase } from '@/lib/class-progress'
import { puedeVerClasesPrivadas } from '@/lib/class-access'
import { FILTROS_AVANCE_CLASES, claseDisponibleBiblioteca, filtrarBibliotecaClases, type FiltroAvanceClase } from '@/lib/class-library-filters'
import Link from 'next/link'
import { RUTA_AULA_FARMASI } from '@/lib/farmasi-registration'
import type { GrupoClasesFarmasi } from '@/lib/farmasi-class-groups'
import SociasUpgradePanel, { type OfertaSociasParaVista } from '@/components/SociasUpgradePanel'

export interface Clase {
  id: string
  titulo: string
  descripcion: string | null
  vimeo_url: string | null
  tiene_video_privado?: boolean
  orden: number
  plan: '27' | '97'
  modulo: string
  activo: boolean
  acceso_gratuito?: boolean
  solo_farmaci?: boolean
  puede_ver?: boolean
  miniatura_revision?: string
}

interface Perfil {
  nombre: string | null
  avatar_url: string | null
  rol: string
  plan: string | null
  desafio_socias_habilitada?: boolean
  tipo_usuario?: string | null
  estado?: string | null
}

interface Props {
  clases: Clase[]
  esAdmin: boolean
  perfil: Perfil | null
  espacioFarmasi?: boolean
  submodulosFarmasi?: GrupoClasesFarmasi[]
  ofertaSocias?: OfertaSociasParaVista
  progresoInicial?: ProgresoClase[]
  errorProgreso?: boolean
  claseInicialId?: string | null
  avisoClaseInicial?: string | null
}

function Icon({ name, className = 'h-5 w-5' }: { name: 'play' | 'arrow' | 'book' | 'lock'; className?: string }) {
  const props = { className, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const }
  if (name === 'play') return <svg {...props}><path d="m9 6 10 6-10 6V6Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5"/></svg>
  if (name === 'arrow') return <svg {...props}><path d="M5 12h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (name === 'lock') return <svg {...props}><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  return <svg {...props}><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v12H8.5A3.5 3.5 0 0 0 5 23V4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M5 4.5v15A3.5 3.5 0 0 1 8.5 16H19" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
}

export default function ClassroomCliente({ clases, esAdmin, perfil, espacioFarmasi = false, submodulosFarmasi, ofertaSocias, progresoInicial = [], errorProgreso = false, claseInicialId = null, avisoClaseInicial = null }: Props) {
  const [claseAbierta, setClaseAbierta] = useState<Clase | null>(null)
  const [videoSeguroUrl, setVideoSeguroUrl] = useState<string | null>(null)
  const [cargandoVideo, setCargandoVideo] = useState<string | null>(null)
  const [errorVideo, setErrorVideo] = useState('')
  const [progreso,setProgreso]=useState(progresoInicial)
  const [filtro,setFiltro]=useState('Todos')
  const [buscar,setBuscar]=useState('')
  const [avance,setAvance]=useState<FiltroAvanceClase>('todas')
  const aperturaEnCurso = useRef(false)
  const enlaceProcesado = useRef<string | null>(null)
  const montado = useRef(true)
  const onProgreso=useCallback((p:ProgresoClase)=>{setProgreso(prev=>[...prev.filter(v=>v.clase_id!==p.clase_id),p])},[])
  const onError=useCallback((mensaje:string)=>setErrorVideo(mensaje),[])

  const tieneAcceso = esAdmin || puedeVerClasesPrivadas(perfil)
  const tieneFarmaciVisible = !esAdmin && clases.some(c => c.solo_farmaci && c.puede_ver === true)
  const accesoPausado = !esAdmin && (perfil?.estado === 'pausada' || perfil?.estado === 'cancelada')
  const mostrarUpgrade = !esAdmin && perfil?.estado === 'activa' && perfil.tipo_usuario !== 'socia' &&
    (perfil.tipo_usuario === 'gratuito' || perfil.tipo_usuario === 'desafio' || espacioFarmasi || tieneFarmaciVisible)
  // La biblioteca personal reúne lo que ya puede reproducir la alumna. La
  // propuesta comercial tiene su propio espacio, sin mezclar tarjetas cerradas.
  // Este filtro no concede permisos: el reproductor vuelve a autorizarlos.
  const clasesBiblioteca = mostrarUpgrade ? clases.filter(clase => claseDisponibleBiblioteca(clase, tieneAcceso)) : clases
  const modulos = [...new Set(clasesBiblioteca.map(clase => ubicacionClase(clase.modulo).programa))].sort((a,b) => a === 'Bienvenida' ? -1 : b === 'Bienvenida' ? 1 : a.localeCompare(b, 'es'))
  const continuar = esAdmin || errorProgreso ? null : claseParaContinuar(clases,progreso)
  const programaInicial = continuar ? ubicacionClase(continuar.clase.modulo).programa : !esAdmin && !errorProgreso && progreso.length === 0 ? (espacioFarmasi ? modulos[0] ?? null : 'Bienvenida') : null
  const gruposVisibles = espacioFarmasi && submodulosFarmasi?.length ? submodulosFarmasi : undefined
  const grupoPorClase = new Map(gruposVisibles?.flatMap(grupo => grupo.claseIds.map(id => [id, grupo.id] as const)))
  const disponibles = ordenarClases(clases.filter(c => (c.puede_ver ?? tieneAcceso) && (c.tiene_video_privado || c.vimeo_url)))
  const grupoAbierto = claseAbierta ? grupoPorClase.get(claseAbierta.id) : undefined
  const siguientes = claseAbierta ? disponibles.filter(c => grupoAbierto
    ? grupoPorClase.get(c.id) === grupoAbierto
    : !grupoPorClase.has(c.id) && ubicacionClase(c.modulo).programa === ubicacionClase(claseAbierta.modulo).programa && ubicacionClase(c.modulo).seccion === ubicacionClase(claseAbierta.modulo).seccion) : []
  const siguiente = claseAbierta ? siguientes[siguientes.findIndex(c=>c.id===claseAbierta.id)+1] : undefined
  const avanceAplicado = esAdmin || errorProgreso ? 'todas' : avance
  const biblioteca = filtrarBibliotecaClases(clasesBiblioteca, progreso, { programa: espacioFarmasi ? 'Todos' : filtro, buscar, avance: avanceAplicado, tieneAcceso, errorProgreso })
  const idsVisibles = new Set(biblioteca.idsVisibles)
  const claseDelEnlace = claseInicialId && esUuid(claseInicialId)
    ? clases.find(clase => clase.id.toLowerCase() === claseInicialId.toLowerCase() && clase.activo && clase.puede_ver === true && (clase.tiene_video_privado || clase.vimeo_url))
    : undefined
  const avisoEnlace = avisoClaseInicial ?? (claseInicialId !== null && !claseDelEnlace ? 'Este enlace de clase no está disponible para tu cuenta. Podés seguir explorando las clases de tu biblioteca.' : null)

  function limpiarFiltros() {
    setFiltro('Todos')
    setBuscar('')
    setAvance('todas')
  }

  const abrirClase = useCallback(async (clase: Clase) => {
    if (!clase.activo || !(clase.puede_ver ?? tieneAcceso) || !(clase.tiene_video_privado || clase.vimeo_url) || aperturaEnCurso.current) return
    setErrorVideo('')
    setVideoSeguroUrl(null)
    if (clase.tiene_video_privado) {
      aperturaEnCurso.current = true
      setCargandoVideo(clase.id)
      try {
        const response = await fetch(`/api/classroom/${clase.id}/video`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No se pudo abrir la clase.')
        if (montado.current) {
          setVideoSeguroUrl(data.url)
          setClaseAbierta(clase)
        }
      } catch (error) {
        if (montado.current) setErrorVideo(error instanceof Error ? error.message : 'No se pudo abrir la clase.')
      } finally {
        aperturaEnCurso.current = false
        if (montado.current) setCargandoVideo(null)
      }
      return
    }
    if (clase.vimeo_url) setClaseAbierta(clase)
  }, [tieneAcceso])

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  useEffect(() => {
    if (claseInicialId === null) { enlaceProcesado.current = null; return }
    if (!claseDelEnlace || enlaceProcesado.current === claseInicialId || aperturaEnCurso.current) return
    // Registrar antes de abrir evita otra petición durante el replay de efectos
    // de StrictMode, cambios de filtros o actualizaciones del progreso.
    enlaceProcesado.current = claseInicialId
    void abrirClase(claseDelEnlace)
  }, [claseInicialId, claseDelEnlace, abrirClase, cargandoVideo])

  function cerrarClase() {
    setClaseAbierta(null)
    setVideoSeguroUrl(null)
  }

  return (
    <main className="min-h-screen bg-[#F4EFEA] text-[#211C19]" data-platform-role={esAdmin ? 'admin' : 'member'}>
      <header data-student-section-header="true" className="border-b border-[#E7DDD5] bg-[#FAF7F3]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href={esAdmin ? '/admin' : '/inicio'} aria-label={esAdmin ? 'Volver al panel de Flor' : 'Volver a mi espacio'} className="flex items-center gap-3">
            <img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" className="h-9 w-auto object-contain sm:h-11" />
          </a>
          <div className="flex items-center gap-3">
            {esAdmin && <a href="/admin/classroom" className="rounded-full bg-[#F4CAD8] px-4 py-2.5 text-xs font-semibold text-[#211C19] transition hover:bg-[#EC9BB6] sm:text-sm">Gestionar clases</a>}
            <a href={esAdmin ? '/admin' : '/inicio'} className="hidden items-center gap-2 text-sm font-medium text-[#746A64] transition hover:text-[#294A38] sm:flex">{esAdmin ? 'Panel de Flor' : 'Mi espacio'} <Icon name="arrow" className="h-4 w-4" /></a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
          <div>
            <p className="font-impact text-[10px] font-semibold uppercase tracking-[0.22em] text-[#294A38]">Tu programa</p>
            <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-[1.04] tracking-[-0.04em] sm:text-5xl">{espacioFarmasi ? 'Socias Farmasi' : 'Tus clases'}</h1>
            {espacioFarmasi && <p className="mt-3 text-sm leading-6 text-[#746A64]">Tus clases Farmasi y sus materiales, dentro de cada clase.</p>}
            {!espacioFarmasi && !tieneAcceso && <p className="mt-3 max-w-xl text-sm leading-6 text-[#746A64]">{accesoPausado ? 'Tu acceso pago está pausado. Tus avances se conservan y las clases de muestra siguen disponibles.' : tieneFarmaciVisible ? 'Tus clases Farmasi y las clases de muestra, listas para seguir a tu ritmo.' : 'Tus clases disponibles, listas para empezar a tu ritmo.'}</p>}
          </div>
          <div className="flex items-center gap-4 rounded-[22px] bg-[#294A38] p-5 text-white">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F4CAD8] text-[#294A38]"><Icon name="book" className="h-6 w-6" /></span>
            <div><p className="font-impact text-3xl font-semibold leading-none">{clases.filter(c=>(c.puede_ver??tieneAcceso) && (c.tiene_video_privado||c.vimeo_url)).length}</p><p className="mt-1.5 text-xs text-[#F4EFEA]">clases disponibles</p></div>
          </div>
        </section>

        {!esAdmin && <nav aria-label="Contenido del programa" className="mt-6 flex flex-wrap gap-2">
          <Link href={espacioFarmasi ? RUTA_AULA_FARMASI : '/classroom'} aria-current="page" className="inline-flex min-h-11 items-center rounded-full border border-[#294A38] bg-[#294A38] px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]">Clases</Link>
          {!espacioFarmasi && <Link href="/clases/materiales" prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-5 py-3 text-sm font-medium text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]">Materiales <Icon name="arrow" className="h-4 w-4" /></Link>}
          {mostrarUpgrade && <Link href="/socias" prefetch={false} className="inline-flex min-h-11 items-center rounded-full border border-[#EC9BB6] bg-[#F4CAD8] px-5 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]">Conocer Socias</Link>}
        </nav>}
        {avisoEnlace && <p role="status" className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 text-sm leading-6 text-[#746A64]">{avisoEnlace}</p>}
        {errorProgreso && <p role="alert" className="mt-5 rounded-2xl border border-[#EC9BB6] bg-[#FAF7F3] p-4 text-sm">No pudimos cargar tu progreso. Recargá para retomarlo; las clases siguen disponibles.</p>}
        {!espacioFarmasi && mostrarUpgrade && clasesBiblioteca.length > 0 && <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><h2 className="font-impact text-xl font-semibold">Tu biblioteca</h2><span className="rounded-full border border-[#E7DDD5] bg-[#FAF7F3] px-3 py-2 text-xs font-medium text-[#294A38]">Incluido en tu acceso</span></div>}
        {continuar && <section className="mt-6 flex flex-col gap-4 rounded-[22px] border border-[#EC9BB6] bg-[#F4CAD8] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#294A38]">Continuar viendo</p><h2 className="mt-2 break-words text-lg font-semibold [overflow-wrap:anywhere]">{continuar.clase.titulo}</h2><p className="mt-1 break-words text-xs text-[#746A64] [overflow-wrap:anywhere]">{ubicacionClase(continuar.clase.modulo).programa} · Desde {tiempoClase(continuar.progreso.posicion_seg)}</p></div>
          <button type="button" onClick={()=>void abrirClase(continuar.clase)} disabled={Boolean(cargandoVideo)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Retomar clase <Icon name="arrow" /></button>
        </section>}
        {clasesBiblioteca.length>0 && <div className={`mt-7 grid gap-3 ${espacioFarmasi ? '' : 'sm:grid-cols-2'}`}>{!espacioFarmasi && <label className="text-xs text-[#746A64]">Programa<select value={filtro} onChange={e=>setFiltro(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#D8CFC8] bg-[#FAF7F3] px-3 py-3 text-base text-[#211C19]"><option>Todos</option>{modulos.map(m=><option key={m}>{m}</option>)}</select></label>}<label className="text-xs text-[#746A64]">Buscar clase<input type="search" value={buscar} onChange={e=>setBuscar(e.target.value)} maxLength={120} placeholder="Nombre de la clase" className="mt-2 min-h-11 w-full rounded-xl border border-[#D8CFC8] bg-[#FAF7F3] px-3 py-3 text-base text-[#211C19]" /></label></div>}
        {!esAdmin && clasesBiblioteca.length>0 && <section aria-label="Filtrar clases por avance" className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4">
          <p className="text-sm font-semibold">Tu avance</p>
          <p id="ayuda-filtros-avance" className="mt-1 text-xs leading-5 text-[#746A64]">Los conteos incluyen solo las clases disponibles según tu programa y búsqueda.{!espacioFarmasi && !mostrarUpgrade && ' Todas también muestra contenido con acceso Socias.'}</p>
          <div role="group" aria-label="Estado de las clases" aria-describedby="ayuda-filtros-avance" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FILTROS_AVANCE_CLASES.map(item => <button key={item.id} type="button" aria-pressed={avanceAplicado === item.id} disabled={errorProgreso && item.id !== 'todas'} onClick={() => setAvance(item.id)} className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294A38] disabled:cursor-not-allowed disabled:text-[#746A64] ${avanceAplicado === item.id ? 'border-[#294A38] bg-[#294A38] text-white' : 'border-[#E7DDD5] bg-[#FFFDFA] text-[#294A38]'}`}>
              <span>{item.etiqueta}</span><span className="font-impact" aria-label={biblioteca.conteos[item.id] === null ? 'Progreso no disponible' : `${biblioteca.conteos[item.id]} ${biblioteca.conteos[item.id] === 1 ? 'clase disponible' : 'clases disponibles'}`}>{biblioteca.conteos[item.id] ?? '—'}</span>
            </button>)}
          </div>
        </section>}
        {clasesBiblioteca.length>0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><p role="status" aria-live="polite" className="text-xs text-[#746A64]">{biblioteca.visibles.length} {biblioteca.visibles.length === 1 ? 'clase visible' : 'clases visibles'}{!esAdmin && biblioteca.bloqueadas > 0 && avanceAplicado === 'todas' ? ` · ${biblioteca.bloqueadas} sin reproducción disponible` : ''}</p>{biblioteca.filtrosActivos && <button type="button" onClick={limpiarFiltros} className="min-h-11 rounded-lg px-2 text-sm font-medium text-[#294A38] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294A38]">Limpiar filtros</button>}</div>}

        {clasesBiblioteca.length === 0 ? (
          <section className="mt-8 rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-8 sm:p-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4CAD8] text-[#294A38]"><Icon name="book" className="h-6 w-6" /></div>
            <h2 className="mt-5 font-serif text-2xl">{mostrarUpgrade && clases.length > 0 ? 'Todavía no hay clases disponibles en tu acceso.' : 'Estamos preparando tus clases.'}</h2>
            <p className="mt-2 text-sm text-[#746A64]">{mostrarUpgrade && clases.length > 0 ? 'Podés conocer la propuesta de Socias Digitales más abajo.' : 'Volvé pronto para empezar.'}</p>
          </section>
        ) : (
          <div className="mt-7 space-y-4">
            {espacioFarmasi ? <ClassroomProgram programa="Farmasi" compactoFarmasi claseDestacadaId={claseAbierta?.id ?? claseDelEnlace?.id ?? continuar?.clase.id ?? null} clases={clasesBiblioteca} gruposFarmasi={gruposVisibles} progreso={progreso} buscar={buscar} esAdmin={esAdmin} tieneAcceso={tieneAcceso} cargando={Boolean(cargandoVideo)} abierto idsVisibles={biblioteca.idsVisibles} filtrandoAvance={avanceAplicado !== 'todas'} errorProgreso={errorProgreso} onAbrir={clase => void abrirClase(clase)} /> : modulos.filter(m=>filtro==='Todos'||filtro===m).map((modulo) => {
              const clasesDelModulo = clasesBiblioteca.filter(clase => ubicacionClase(clase.modulo).programa === modulo)
              const visibles=clasesDelModulo.filter(c=>idsVisibles.has(c.id))
              if(!visibles.length)return null
              return (
                <ClassroomProgram key={modulo} programa={modulo} clases={clasesDelModulo} progreso={progreso} buscar={buscar} esAdmin={esAdmin} tieneAcceso={tieneAcceso} cargando={Boolean(cargandoVideo)} abierto={programaInicial === modulo} idsVisibles={biblioteca.idsVisibles} filtrandoAvance={avanceAplicado !== 'todas'} errorProgreso={errorProgreso} onAbrir={clase => void abrirClase(clase)} />
              )
            })}
          </div>
        )}
        {clasesBiblioteca.length>0 && !biblioteca.visibles.length && <p className="mt-6 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-6 text-sm text-[#746A64]">No hay clases que coincidan con estos filtros. Probá otro estado o limpiá los filtros para ver tu biblioteca.</p>}
        {mostrarUpgrade && <SociasUpgradePanel ofertaSocias={ofertaSocias} contexto={espacioFarmasi ? 'farmasi' : 'general'} />}
      </div>

      {errorVideo && <div role="alert" className="sd-mobile-toast fixed bottom-5 left-1/2 z-[60] w-[min(92vw,32rem)] -translate-x-1/2 rounded-2xl border border-[#B01B30] bg-[#FAF7F3] px-5 py-4 text-sm text-[#7C1D2A]">{errorVideo}</div>}

      {claseAbierta && <ClassPlayer key={claseAbierta.id} clase={claseAbierta} url={videoSeguroUrl} progreso={progreso.find(p=>p.clase_id===claseAbierta.id)} esAdmin={esAdmin} siguiente={siguiente?.titulo} onSiguiente={()=>{if(siguiente)void abrirClase(siguiente)}} onCerrar={cerrarClase} onProgreso={onProgreso} onError={onError} />}
    </main>
  )
}
