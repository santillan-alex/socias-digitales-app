'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import NavigationIcon from '@/components/NavigationIcon'
import CommunityComposer from '@/components/community/CommunityComposer'
import CommunityPostCard from '@/components/community/CommunityPostCard'
import { createClient } from '@/lib/supabase/client'
import { esComentarioComunidad, esPaginaComunidad, esPublicacionComunidad, type ComentarioComunidad, type PaginaComunidad, type PublicacionComunidad } from '@/lib/community'

interface RespuestaAnterior { id: string; contenido: string; es_oficial: boolean; created_at: string; perfiles: { nombre: string } | null }
export interface PreguntaAnterior {
  id: string; titulo: string; contenido: string; estado: string; created_at: string
  perfiles: { nombre: string; avatar_url: string | null } | null
  respuestas: RespuestaAnterior[]
}
interface Props {
  initial: PaginaComunidad; preguntas: PreguntaAnterior[]; consultasError: boolean
  totalPreguntas: number | null; sinResponder: number | null; adminId: string; nombre: string | null
}
type Vista = 'todas' | 'ocultas' | 'retiradas'
type Objetivo = { clase: 'publicacion'; item: PublicacionComunidad } | { clase: 'comentario'; item: ComentarioComunidad }
type IntentoRespuesta = { id: string; preguntaId: string; contenido: string; confirmada: boolean }
const accionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-2 text-sm font-medium text-[#294A38] disabled:cursor-not-allowed disabled:opacity-50'
const principalClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#294A38] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'

function formatFecha(fecha: string) { return new Date(fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function objeto(valor: unknown): valor is Record<string, unknown> { return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor) }
async function solicitar(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
    const data: unknown = await response.json()
    if (!response.ok) throw new Error(objeto(data) && typeof data.error === 'string' ? data.error : objeto(data) && typeof data.mensaje === 'string' ? data.mensaje : 'No pudimos completar la operación. Volvé a intentarlo.')
    return data
  } finally { clearTimeout(timeout) }
}

export default function ComunidadAdmin({ initial, preguntas, consultasError, totalPreguntas, sinResponder, adminId, nombre }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'comunidad' | 'qa'>('comunidad')
  const [pagina, setPagina] = useState<PaginaComunidad>(initial)
  const [vista, setVista] = useState<Vista>('todas')
  const [cargando, setCargando] = useState(false)
  const [revisionLectura, setRevisionLectura] = useState(0)
  const [errorLectura, setErrorLectura] = useState('')
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [moderacionIntentada, setModeracionIntentada] = useState(false)
  const [ultimoComentario, setUltimoComentario] = useState<ComentarioComunidad | null>(null)
  const [borradores, setBorradores] = useState<Record<string, boolean>>({})
  const [sinAcceso, setSinAcceso] = useState(false)
  const [preguntaAbierta, setPreguntaAbierta] = useState<string | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorRespuesta, setErrorRespuesta] = useState('')
  const [respuestaCongelada, setRespuestaCongelada] = useState(false)
  const [filtroPregunta, setFiltroPregunta] = useState('todas')
  const bloqueo = useRef(false), bloqueoRespuesta = useRef(false), intentoRespuesta = useRef<IntentoRespuesta | null>(null)
  const dialogo = useRef<HTMLDialogElement>(null), borradoresActuales = useRef<Record<string, boolean>>({})
  const hayBorrador = Object.values(borradores).some(Boolean)
  const cambiarBorrador = useCallback((clave: string, activo: boolean) => {
    borradoresActuales.current = { ...borradoresActuales.current, [clave]: activo }
    setBorradores(borradoresActuales.current)
  }, [])
  const bloquearAcceso = useCallback(() => setSinAcceso(true), [])

  useEffect(() => {
    const elemento = dialogo.current
    if (objetivo && elemento && !elemento.open) elemento.showModal()
    return () => { if (elemento?.open) elemento.close() }
  }, [objetivo])
  useEffect(() => {
    if (!hayBorrador && !respuesta.trim() && !respuestaCongelada) return
    const advertir = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', advertir)
    return () => window.removeEventListener('beforeunload', advertir)
  }, [hayBorrador, respuesta, respuestaCongelada])

  async function cargarVista(nuevaVista: Vista, mas = false) {
    if (bloqueo.current || sinAcceso || Object.values(borradoresActuales.current).some(Boolean)) return
    bloqueo.current = true; setCargando(true); setErrorLectura(''); setAviso('')
    try {
      const cursor = mas && pagina.estado === 'lista' ? pagina.siguiente : null
      const params = new URLSearchParams({ vista: nuevaVista })
      if (cursor) params.set('cursor', cursor)
      const data = await solicitar(`/api/comunidad?${params}`)
      if (!esPaginaComunidad(data) || data.estado !== 'lista' || (cursor && data.siguiente === cursor)) throw new Error(objeto(data) && typeof data.mensaje === 'string' ? data.mensaje : 'La lectura no se pudo confirmar. Intentá nuevamente.')
      setPagina(anterior => mas && anterior.estado === 'lista' ? { ...data, publicaciones: [...anterior.publicaciones, ...data.publicaciones.filter(nueva => !anterior.publicaciones.some(item => item.id === nueva.id))] } : data)
      if (!mas) { setVista(nuevaVista); setRevisionLectura(version => version + 1); setUltimoComentario(null) }
    } catch (error) { setErrorLectura(error instanceof Error && error.name !== 'AbortError' ? error.message : 'La conexión tardó demasiado. Conservamos la última lectura; volvé a intentarlo.') }
    finally { bloqueo.current = false; setCargando(false) }
  }
  function actualizarPublicacion(publicacion: PublicacionComunidad) {
    setPagina(actual => actual.estado === 'lista' ? { ...actual, publicaciones: actual.publicaciones.map(pub => pub.id === publicacion.id ? publicacion : pub) } : actual)
  }
  function publicacionCreada(publicacion: PublicacionComunidad) {
    if (vista === 'todas') setPagina(actual => actual.estado === 'lista' ? { ...actual, publicaciones: [publicacion, ...actual.publicaciones.filter(pub => pub.id !== publicacion.id)] } : actual)
    setAviso(vista === 'todas' ? 'Publicación compartida con las Socias.' : 'Publicación compartida. La encontrás en Todas.')
  }
  function prepararModeracion(nuevo: Objetivo) {
    if (bloqueo.current || sinAcceso || Object.values(borradoresActuales.current).some(Boolean)) return
    setObjetivo(nuevo); setMotivo(''); setModeracionIntentada(false); setErrorGuardado(''); setAviso('')
  }
  async function moderar() {
    if (!objetivo || bloqueo.current || sinAcceso) return
    const anterior = objetivo.item, ocultar = !anterior.oculta
    if (ocultar && motivo.trim().length < 5) { setErrorGuardado('Escribí un motivo de al menos 5 caracteres.'); return }
    bloqueo.current = true; setGuardando(true); setModeracionIntentada(true); setErrorGuardado(''); setAviso('')
    try {
      const url = objetivo.clase === 'publicacion' ? `/api/comunidad/${anterior.id}` : `/api/comunidad/comentarios/${anterior.id}`
      const data = await solicitar(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: anterior.version, accion: ocultar ? 'ocultar' : 'mostrar', ...(ocultar ? { motivo: motivo.trim() } : {}) }) })
      const item = objeto(data) && data.ok === true ? data[objetivo.clase === 'publicacion' ? 'publicacion' : 'comentario'] : null
      const valido = objetivo.clase === 'publicacion' ? esPublicacionComunidad(item) : esComentarioComunidad(item)
      if (!valido || !objeto(item) || item.id !== anterior.id || item.oculta !== ocultar || item.version !== anterior.version + 1 || item.retirada !== anterior.retirada || item.contenido !== anterior.contenido || (objetivo.clase === 'comentario' && item.publicacion_id !== objetivo.item.publicacion_id) || (objetivo.clase === 'publicacion' && item.tipo !== objetivo.item.tipo)) throw new Error('El cambio no se pudo confirmar. Conservamos la tarjeta; actualizá antes de volver a moderar.')
      if (objetivo.clase === 'publicacion') actualizarPublicacion(item as unknown as PublicacionComunidad)
      else setUltimoComentario(item as unknown as ComentarioComunidad)
      setAviso(ocultar ? 'Contenido oculto. Podés volver a mostrarlo desde moderación.' : anterior.retirada ? 'Moderación retirada. Sigue sin mostrarse porque su autora lo retiró.' : 'Contenido visible nuevamente.')
      setObjetivo(null); setMotivo('')
    } catch (error) { setErrorGuardado(error instanceof Error && error.name !== 'AbortError' ? error.message : 'La conexión se interrumpió; el cambio podría haberse guardado. Reintentá esta misma acción o actualizá la lectura.') }
    finally { bloqueo.current = false; setGuardando(false) }
  }

  async function responderPregunta(preguntaId: string) {
    if (bloqueoRespuesta.current || !adminId || !respuesta.trim()) return
    bloqueoRespuesta.current = true; setEnviando(true); setErrorRespuesta('')
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      const supabase = createClient()
      const intento = intentoRespuesta.current ?? { id: crypto.randomUUID(), preguntaId, contenido: respuesta.trim(), confirmada: false }
      intentoRespuesta.current = intento; setRespuestaCongelada(true)
      if (intento.preguntaId !== preguntaId) throw new Error('Revisá primero la respuesta pendiente antes de abrir otra consulta.')
      if (!intento.confirmada) {
        const previa = await supabase.from('respuestas').select('id,contenido,pregunta_id,autor_id').eq('id', intento.id).abortSignal(controller.signal).maybeSingle()
        if (previa.error) throw new Error('No pudimos comprobar el intento anterior. Conservamos tu respuesta para reintentar sin duplicarla.')
        let fila = previa.data
        if (!fila) {
          const guardado = await supabase.from('respuestas').insert({ id: intento.id, pregunta_id: preguntaId, autor_id: adminId, contenido: intento.contenido, es_oficial: true }).select('id,contenido,pregunta_id,autor_id').abortSignal(controller.signal).single()
          if (guardado.error || !guardado.data) throw new Error('No se confirmó el guardado. El texto sigue acá; reintentá el mismo envío para evitar duplicados.')
          fila = guardado.data
        }
        if (fila.id !== intento.id || fila.pregunta_id !== preguntaId || fila.autor_id !== adminId || fila.contenido !== intento.contenido) throw new Error('La respuesta no coincide con el intento enviado. Recargá y revisá la consulta antes de enviar otra.')
        intento.confirmada = true
      }
      const estado = await supabase.from('preguntas').update({ estado: 'respondida' }).eq('id', preguntaId).select('id,estado').abortSignal(controller.signal).single()
      if (estado.error || estado.data?.id !== preguntaId || estado.data.estado !== 'respondida') throw new Error('Tu respuesta ya quedó guardada. Falta confirmar el estado de la consulta; reintentá para terminar sin volver a enviarla.')
      setRespuesta(''); setPreguntaAbierta(null); setRespuestaCongelada(false); intentoRespuesta.current = null
      setAviso('Respuesta oficial guardada y consulta marcada como respondida.'); router.refresh()
    } catch (error) { setErrorRespuesta(error instanceof Error && error.name !== 'AbortError' ? error.message : 'La conexión se interrumpió. Reintentá el mismo envío; conservamos su identificador para no duplicarlo.') }
    finally { clearTimeout(timeout); bloqueoRespuesta.current = false; setEnviando(false) }
  }
  const preguntasFiltradas = preguntas.filter(p => filtroPregunta === 'todas' || p.estado === filtroPregunta)
  const publicaciones = pagina.estado === 'lista' ? pagina.publicaciones : []
  const ocupada = cargando || guardando || enviando || Boolean(objetivo) || respuestaCongelada || hayBorrador || sinAcceso

  return <main className="min-h-screen bg-[#F4EFEA] text-[#211C19]" data-platform-role="admin">
    <header data-admin-section-header="true" className="border-b border-[#E7DDD5] px-5 py-4 sm:px-8"><a href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#294A38]"><NavigationIcon name="inicio" />Panel de Flor</a></header>
    <AdminSectionMenu />
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-medium uppercase tracking-[.2em] text-[#294A38]">Entre Socias</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Comunidad</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-[#746A64]">Compartí, respondé y acompañá la conversación. Acá también cuidás lo que se publica.</p></div><button onClick={() => tab === 'comunidad' ? cargarVista(vista) : router.refresh()} disabled={ocupada} className={accionClass}>{cargando ? 'Actualizando…' : 'Actualizar'}</button></div>
      <div className="flex flex-wrap gap-2" aria-label="Contenido de comunidad">{([{ id: 'comunidad', label: 'Publicaciones', icon: 'comunidad' }, { id: 'qa', label: 'Consultas anteriores', icon: 'encuesta' }] as const).map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { if (!ocupada) { setTab(item.id); setAviso('') } }} disabled={ocupada} className={tab === item.id ? accionClass.replace('bg-[#FFFDFA]', 'bg-[#F4CAD8]') : accionClass}><NavigationIcon name={item.icon} />{item.label}</button>)}</div>
      {aviso && <p role="status" className="rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4 text-sm text-[#294A38]">{aviso}</p>}
      {sinAcceso && <div role="alert" className="rounded-2xl border border-[#EC9BB6] bg-[#FFFDFA] p-4 text-sm"><p>Necesitamos volver a comprobar tu sesión administrativa. Conservamos los textos de esta visita.</p><a href="/login?next=%2Fadmin%2Fcomunidad" className={`${accionClass} mt-3`}>Volver a ingresar</a></div>}

      {tab === 'comunidad' ? <section className="space-y-4" aria-label="Moderación de publicaciones">
        <CommunityComposer key={`crear:${revisionLectura}`} nombre={nombre} lecturaPendiente={cargando || guardando || Boolean(objetivo) || sinAcceso || pagina.estado === 'error'} onGuardada={publicacionCreada} onBorrador={activo => cambiarBorrador('crear', activo)} onAcceso={bloquearAcceso} />
        <div className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><div className="flex flex-wrap gap-2" aria-label="Filtrar publicaciones">{([{ id: 'todas', label: 'Todas' }, { id: 'ocultas', label: 'Ocultas' }, { id: 'retiradas', label: 'Retiradas' }] as const).map(item => <button key={item.id} aria-pressed={vista === item.id} disabled={ocupada} onClick={() => cargarVista(item.id)} className={`min-h-11 rounded-full px-4 py-2 text-sm ${vista === item.id ? 'bg-[#294A38] text-white' : 'border border-[#E7DDD5] bg-[#FFFDFA] text-[#746A64]'} disabled:opacity-50`}>{item.label}</button>)}</div><p className="mt-3 text-xs leading-relaxed text-[#746A64]">{pagina.estado === 'lista' ? `${publicaciones.length} ${publicaciones.length === 1 ? 'publicación cargada' : 'publicaciones cargadas'}${pagina.siguiente ? ' · hay más por revisar' : ''}. ` : ''}Ocultar es reversible. Las ventas y los comprobantes privados no se publican acá.</p>{hayBorrador && <p role="status" className="mt-2 text-xs leading-relaxed text-[#294A38]">Terminá o cancelá tu borrador para actualizar, cambiar de vista o moderar.</p>}</div>
        {(pagina.estado === 'error' || errorLectura) && <div role="alert" className="rounded-2xl border border-[#EC9BB6] bg-[#FFFDFA] p-4 text-sm"><p>{errorLectura || (pagina.estado === 'error' ? pagina.mensaje : '')}</p><button onClick={() => cargarVista(vista)} disabled={ocupada} className={`${accionClass} mt-3`}>Reintentar lectura</button></div>}
        {cargando && <p role="status" className="text-sm text-[#746A64]">Cargando publicaciones…</p>}
        {pagina.estado === 'lista' && publicaciones.length === 0 && !cargando && <div className="rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] px-5 py-10 text-center"><h2 className="text-lg font-semibold">{vista === 'ocultas' ? 'Sin publicaciones ocultas' : vista === 'retiradas' ? 'Sin publicaciones retiradas' : 'La conversación empieza acá'}</h2><p className="mt-2 text-sm text-[#746A64]">{vista === 'todas' ? 'Podés compartir una bienvenida o abrir una pregunta para las Socias.' : 'No hay contenido en esta selección.'}</p></div>}
        {publicaciones.map(pub => <CommunityPostCard key={`${pub.id}:${revisionLectura}`} publicacion={pub} nombre={nombre} administracion onActualizada={actualizarPublicacion} onBorrador={cambiarBorrador} onAcceso={bloquearAcceso} lecturaPendiente={cargando || guardando || Boolean(objetivo) || sinAcceso} onModerarPublicacion={item => prepararModeracion({ clase: 'publicacion', item })} onModerarComentario={item => prepararModeracion({ clase: 'comentario', item })} comentarioActualizado={ultimoComentario?.publicacion_id === pub.id ? ultimoComentario : undefined} />)}
        {pagina.estado === 'lista' && pagina.siguiente && <button onClick={() => cargarVista(vista, true)} disabled={ocupada} className={`${accionClass} w-full`}>{cargando ? 'Cargando…' : 'Cargar más publicaciones'}</button>}
      </section> : <section className="space-y-4" aria-label="Consultas anteriores">
        <div className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><h2 className="text-lg font-semibold">Consultas anteriores</h2><p className="mt-2 text-sm text-[#746A64]">Se conserva el historial del espacio anterior. Las preguntas nuevas se comparten y responden en Publicaciones.</p><p className="mt-3 text-sm text-[#294A38]">{totalPreguntas === null ? 'Total sin comprobar' : `${totalPreguntas} consultas en el historial`} · {sinResponder === null ? 'Pendientes sin comprobar' : `${sinResponder} sin responder`}</p></div>
        {consultasError ? <div role="alert" className="rounded-2xl border border-[#EC9BB6] bg-[#FFFDFA] p-4"><p className="text-sm">No pudimos cargar las consultas. No es un historial vacío.</p><button onClick={() => router.refresh()} className={`${accionClass} mt-3`}>Recargar consultas</button></div> : <>
          <div className="flex flex-wrap gap-2" aria-label="Filtrar consultas">{[{ id: 'todas', label: 'Todas' }, { id: 'abierta', label: 'Sin responder' }, { id: 'respondida', label: 'Respondidas' }].map(f => <button key={f.id} aria-pressed={filtroPregunta === f.id} disabled={respuestaCongelada || enviando} onClick={() => setFiltroPregunta(f.id)} className={filtroPregunta === f.id ? accionClass.replace('bg-[#FFFDFA]', 'bg-[#F4CAD8]') : accionClass}>{f.label}</button>)}</div>
          {preguntasFiltradas.length === 0 && <p className="rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-8 text-center text-sm text-[#746A64]">No hay consultas en esta selección.</p>}
          {preguntasFiltradas.map(p => <article key={p.id} className="space-y-4 rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-4 sm:p-6"><div><p className="break-words text-sm font-semibold">{p.perfiles?.nombre ?? 'Socia'}</p><time dateTime={p.created_at} className="text-xs text-[#746A64]">{formatFecha(p.created_at)}</time></div><h3 className="break-words text-base font-semibold">{p.titulo}</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{p.contenido}</p>{p.respuestas.map(r => <div key={r.id} className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><p className="text-xs font-medium text-[#294A38]">{r.es_oficial ? 'Respuesta del equipo · ' : ''}{r.perfiles?.nombre ?? 'Socia'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{r.contenido}</p></div>)}
            {p.estado === 'abierta' && (preguntaAbierta === p.id ? <div className="space-y-3"><label className="block text-sm font-medium" htmlFor={`respuesta-${p.id}`}>Respuesta oficial</label><textarea id={`respuesta-${p.id}`} value={respuesta} onChange={e => setRespuesta(e.target.value)} disabled={enviando || respuestaCongelada} maxLength={5000} rows={4} className="w-full resize-y rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] px-4 py-3 text-base disabled:opacity-70" /><p className="text-xs text-[#746A64]">{respuestaCongelada ? 'El intento está conservado. Reintentar termina el mismo envío, sin crear otra respuesta.' : 'La respuesta queda guardada antes de marcar la consulta como respondida.'}</p>{errorRespuesta && <p role="alert" className="text-sm text-[#B01B30]">{errorRespuesta}</p>}<div className="flex flex-wrap gap-2"><button disabled={enviando || !respuesta.trim()} onClick={() => responderPregunta(p.id)} className={principalClass}>{enviando ? 'Guardando…' : respuestaCongelada ? 'Reintentar mismo envío' : 'Responder oficialmente'}</button><button disabled={enviando || respuestaCongelada} className={accionClass} onClick={() => { setPreguntaAbierta(null); setRespuesta(''); setErrorRespuesta('') }}>Cancelar</button></div></div> : <button disabled={enviando || respuestaCongelada} onClick={() => { setPreguntaAbierta(p.id); setRespuesta(''); setErrorRespuesta('') }} className={accionClass}>Responder consulta</button>)}
          </article>)}
          {totalPreguntas !== null && totalPreguntas > preguntas.length && <p className="text-xs text-[#746A64]">Se muestran las últimas {preguntas.length} consultas del historial anterior.</p>}
        </>}
      </section>}
      {objetivo && <dialog ref={dialogo} aria-labelledby="titulo-moderacion" onCancel={event => { if (guardando) event.preventDefault(); else { setObjetivo(null); setMotivo(''); setErrorGuardado('') } }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#EC9BB6] bg-[#F4CAD8] p-5 text-[#211C19] backdrop:bg-black/40 sm:p-6" style={{ maxWidth: 'min(32rem, calc(100vw - 2rem))' }}><div className="space-y-3"><h2 id="titulo-moderacion" className="text-lg font-semibold">{objetivo.item.oculta ? 'Volver a mostrar' : 'Ocultar'} {objetivo.clase === 'publicacion' ? 'publicación' : 'comentario'}</h2><p className="text-sm leading-relaxed">{objetivo.item.oculta ? 'Se retira la moderación. Si su autora retiró el contenido, seguirá fuera del muro hasta que ella lo restaure.' : 'El contenido deja de mostrarse a las socias, pero se conserva para poder revisarlo y restaurarlo.'}</p><blockquote className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-3 text-sm [overflow-wrap:anywhere]">{objetivo.item.contenido}</blockquote>{!objetivo.item.oculta && <><label htmlFor="motivo-moderacion" className="block text-sm font-medium">Motivo para el equipo</label><textarea id="motivo-moderacion" maxLength={300} minLength={5} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={guardando || moderacionIntentada} rows={3} className="w-full rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-base" /><p className="text-xs text-[#746A64]">{moderacionIntentada ? 'Conservamos el mismo motivo para reintentar sin pisar otro cambio.' : 'Entre 5 y 300 caracteres. No publiques información privada.'}</p></>}{errorGuardado && <p role="alert" className="text-sm text-[#B01B30]">{errorGuardado}</p>}<div className="flex flex-wrap gap-2"><button disabled={guardando || (!objetivo.item.oculta && motivo.trim().length < 5)} onClick={moderar} className={principalClass}>{guardando ? 'Guardando…' : objetivo.item.oculta ? 'Confirmar que vuelva a mostrarse' : 'Confirmar ocultar'}</button><button disabled={guardando} onClick={() => { setObjetivo(null); setMotivo(''); setErrorGuardado('') }} className={accionClass}>Cancelar moderación</button></div></div></dialog>}
    </div>
  </main>
}
