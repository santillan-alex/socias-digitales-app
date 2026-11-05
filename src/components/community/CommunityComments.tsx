'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import ArrowIcon from '@/components/ArrowIcon'
import { esComentarioComunidad, esPaginaComentariosComunidad, type ComentarioComunidad } from '@/lib/community'
import CommunityAvatar from './CommunityAvatar'
import { accionComunidad, campoComunidad, controlComunidad, ErrorComunidad, errorComunidad, esRespuestaComunidad, fechaComunidad, solicitarComunidad, textoComunidad } from './community-client'

interface Props {
  publicacionId: string
  nombre: string | null
  cantidadInicial: number
  onCantidad: (cantidad: number) => void
  onBorrador: (activo: boolean) => void
  onAcceso: () => void
  lecturaPendiente?: boolean
  administracion?: boolean
  onModerarComentario?: (comentario: ComentarioComunidad) => void
  comentarioActualizado?: ComentarioComunidad | null
}
type IntencionComentario = { id: string; contenido: string; version?: number; accion?: 'editar' }
type CambioComentario = { id: string; version: number; accion: 'retirar' | 'restaurar' }

export default function CommunityComments({ publicacionId, nombre, cantidadInicial, onCantidad, onBorrador, onAcceso, lecturaPendiente = false, administracion = false, onModerarComentario, comentarioActualizado }: Props) {
  const [comentarios, setComentarios] = useState<ComentarioComunidad[]>([])
  const [siguiente, setSiguiente] = useState<string | null>(null)
  const [leido, setLeido] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errorLectura, setErrorLectura] = useState('')
  const [contenido, setContenido] = useState('')
  const [edicion, setEdicion] = useState<ComentarioComunidad | null>(null)
  const [intencion, setIntencion] = useState<IntencionComentario | null>(null)
  const [cambio, setCambio] = useState<CambioComentario | null>(null)
  const [confirmar, setConfirmar] = useState<CambioComentario | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [bloqueada, setBloqueada] = useState(false)
  const viva = useRef(false), escribiendo = useRef(false), leyendo = useRef(false)
  const controlLectura = useRef<AbortController | null>(null), controlEscritura = useRef<AbortController | null>(null)
  const cantidades = useRef(cantidadInicial)
  const versionesModeradas = useRef(new Map<string, number>())
  const acceso = useRef(onAcceso)
  acceso.current = onAcceso

  const comentariosActuales = comentarioActualizado && comentarioActualizado.publicacion_id === publicacionId && esComentarioComunidad(comentarioActualizado)
    ? comentarios.map(item => item.id === comentarioActualizado.id && comentarioActualizado.version >= item.version ? comentarioActualizado : item)
    : comentarios

  useEffect(() => { cantidades.current = cantidadInicial }, [cantidadInicial])

  useEffect(() => {
    if (!comentarioActualizado || comentarioActualizado.publicacion_id !== publicacionId || !esComentarioComunidad(comentarioActualizado)) return
    const anterior = comentarios.find(item => item.id === comentarioActualizado.id)
    if (!anterior || comentarioActualizado.version <= Math.max(anterior.version, versionesModeradas.current.get(anterior.id) ?? 0)) return
    // The parent supplies a confirmed moderation, not a new comment. Retain
    // its version and apply its visibility delta once, including effect replays.
    versionesModeradas.current.set(anterior.id, comentarioActualizado.version)
    setComentarios(prev => prev.map(item => item.id === comentarioActualizado.id && item.version < comentarioActualizado.version ? comentarioActualizado : item))
    const delta = Number(!comentarioActualizado.retirada && !comentarioActualizado.oculta) - Number(!anterior.retirada && !anterior.oculta)
    if (delta) { cantidades.current = Math.max(0, cantidades.current + delta); onCantidad(cantidades.current) }
  }, [comentarioActualizado, comentarios, onCantidad, publicacionId])

  useEffect(() => {
    viva.current = true
    leyendo.current = false
    void leerComentarios(null, false)
    return () => { viva.current = false; controlLectura.current?.abort(); controlEscritura.current?.abort() }
    // The post is the read boundary. Event callbacks live in refs, not a polling
    // effect; typing or receiving a confirmed comment never refetches the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicacionId])

  async function leerComentarios(cursor: string | null, ampliar: boolean) {
    if (leyendo.current) return
    leyendo.current = true; setCargando(true); setErrorLectura('')
    const controller = new AbortController(); controlLectura.current = controller
    try {
      const response = await solicitarComunidad(`/api/comunidad/${publicacionId}/comentarios${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal })
      if (!esPaginaComentariosComunidad(response) || response.estado !== 'lista' || response.comentarios.some(item => item.publicacion_id !== publicacionId)) throw new ErrorComunidad(null, false)
      if (!viva.current || controller.signal.aborted || controlLectura.current !== controller) return
      setComentarios(prev => {
        const unicos = new Map((ampliar ? prev : []).map(item => [item.id, item]))
        for (const item of response.comentarios) if (!unicos.has(item.id) || item.version >= unicos.get(item.id)!.version) unicos.set(item.id, item)
        return [...unicos.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      })
      setSiguiente(response.siguiente); setLeido(true)
    } catch (cause) {
      if (!viva.current || controller.signal.aborted || controlLectura.current !== controller) return
      const fallo = errorComunidad(cause)
      setErrorLectura('No pudimos cargar los comentarios. Podés reintentar sin perder tu texto.')
      if (fallo.status === 401 || fallo.status === 403) acceso.current()
    } finally {
      if (controlLectura.current === controller) {
        leyendo.current = false
        if (viva.current) setCargando(false)
        controlLectura.current = null
      }
    }
  }

  function incorporar(guardado: ComentarioComunidad, anterior?: ComentarioComunidad) {
    setComentarios(prev => {
      const sinAnterior = prev.filter(item => item.id !== guardado.id)
      return [...sinAnterior, guardado].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    })
    const antesVisible = Boolean(anterior && !anterior.retirada && !anterior.oculta)
    const ahoraVisible = !guardado.retirada && !guardado.oculta
    if (antesVisible !== ahoraVisible) { cantidades.current = Math.max(0, cantidades.current + (ahoraVisible ? 1 : -1)); onCantidad(cantidades.current) }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (escribiendo.current || leyendo.current || bloqueada || cambio || confirmar || lecturaPendiente) return
    const visible = event.currentTarget.elements.namedItem('comentario') as HTMLTextAreaElement | null
    const texto = textoComunidad(visible?.value ?? contenido)
    if (!intencion && (!texto || texto.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(texto))) { setError('Escribí entre 1 y 1.000 caracteres, sin caracteres de control.'); return }
    const envio = intencion ?? { id: edicion?.id ?? crypto.randomUUID(), contenido: texto, ...(edicion ? { version: edicion.version, accion: 'editar' as const } : {}) }
    escribiendo.current = true; setEnviando(true); setError(''); setAviso(''); setIntencion(envio); onBorrador(true)
    const controller = new AbortController(); controlEscritura.current = controller
    try {
      const { id, ...datos } = envio
      const response = await solicitarComunidad(edicion ? `/api/comunidad/comentarios/${id}` : `/api/comunidad/${publicacionId}/comentarios`, { method: edicion ? 'PATCH' : 'POST', body: JSON.stringify(edicion ? datos : envio), signal: controller.signal })
      if (!esRespuestaComunidad(response) || !esComentarioComunidad(response.comentario)) throw new ErrorComunidad(null, true)
      const guardado = response.comentario
      if (guardado.id !== envio.id || guardado.publicacion_id !== publicacionId || guardado.contenido !== envio.contenido || !guardado.propia || guardado.retirada || guardado.oculta || (envio.version !== undefined && guardado.version <= envio.version)) throw new ErrorComunidad(null, true)
      if (!viva.current) return
      incorporar(guardado, edicion ?? undefined); setIntencion(null); setContenido(''); setEdicion(null); onBorrador(false); setAviso(envio.accion ? 'Tu comentario quedó actualizado.' : 'Tu comentario ya acompaña esta conversación.')
    } catch (cause) {
      if (!viva.current) return
      const fallo = errorComunidad(cause); setError(fallo.message)
      if (!fallo.pendiente) { setIntencion(null); if (![400, 422].includes(fallo.status ?? 0)) setBloqueada(true) }
      if (fallo.status === 401 || fallo.status === 403) acceso.current()
    } finally {
      escribiendo.current = false
      if (viva.current) setEnviando(false)
      if (controlEscritura.current === controller) controlEscritura.current = null
    }
  }

  async function cambiarComentario(datos: CambioComentario) {
    if (escribiendo.current || leyendo.current || bloqueada || intencion || lecturaPendiente) return
    const envio = cambio ?? datos
    const anterior = comentariosActuales.find(item => item.id === envio.id)
    if (!anterior) return
    escribiendo.current = true; setEnviando(true); setCambio(envio); setError(''); setAviso(''); onBorrador(true)
    const controller = new AbortController(); controlEscritura.current = controller
    try {
      const { id, ...body } = envio
      const response = await solicitarComunidad(`/api/comunidad/comentarios/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal: controller.signal })
      if (!esRespuestaComunidad(response) || !esComentarioComunidad(response.comentario)) throw new ErrorComunidad(null, true)
      const guardado = response.comentario
      if (guardado.id !== id || guardado.publicacion_id !== publicacionId || !guardado.propia || guardado.version <= envio.version || guardado.retirada !== (envio.accion === 'retirar')) throw new ErrorComunidad(null, true)
      if (!viva.current) return
      incorporar(guardado, anterior); setCambio(null); setConfirmar(null); onBorrador(false); setAviso(envio.accion === 'retirar' ? 'Retiraste tu comentario.' : 'Tu comentario quedó restaurado.')
    } catch (cause) {
      if (!viva.current) return
      const fallo = errorComunidad(cause); setError(fallo.message)
      if (!fallo.pendiente) { setCambio(null); onBorrador(false); if (![400, 422].includes(fallo.status ?? 0)) setBloqueada(true) }
      if (fallo.status === 401 || fallo.status === 403) acceso.current()
    } finally {
      escribiendo.current = false
      if (viva.current) setEnviando(false)
      if (controlEscritura.current === controller) controlEscritura.current = null
    }
  }

  const hayTexto = Boolean(contenido.trim() || edicion || intencion || cambio || confirmar)
  return <section aria-label="Comentarios de la publicación" className="mt-4 min-w-0 border-t border-[#E7DDD5] pt-4">
    <h3 className="text-sm font-semibold">Sigamos la conversación</h3>
    {cargando && <p role="status" className="mt-4 text-sm text-[#746A64]">Cargando comentarios…</p>}
    {errorLectura && <div role="alert" className="mt-4 rounded-[14px] border border-[#E7DDD5] bg-[#FAF7F3] p-3"><p className="text-sm leading-6">{errorLectura}</p><button type="button" onClick={() => void leerComentarios(leido ? siguiente : null, leido)} disabled={cargando} className={`${controlComunidad} mt-2`}>Reintentar comentarios</button></div>}
    {leido && !comentarios.length && !errorLectura && <p className="mt-4 text-sm leading-6 text-[#746A64]">Todavía no hay comentarios. Unas palabras pueden hacer la diferencia.</p>}
    <div className="mt-4 space-y-4">{comentariosActuales.map(comentario => <div key={comentario.id} className="flex min-w-0 items-start gap-2.5">
      <CommunityAvatar nombre={comentario.autor.nombre} small />
      <div className="min-w-0 flex-1">
        <div className="rounded-[18px] border border-[#E7DDD5] bg-[#FAF7F3] px-3 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="break-words text-xs font-semibold leading-5">{comentario.autor.nombre ?? 'Socia'}{comentario.propia ? ' · Vos' : ''}</p>{comentario.autor.es_admin && <span className="text-[10px] font-medium text-[#294A38]">Equipo Socias</span>}</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{comentario.contenido}</p>
          {(comentario.retirada || comentario.oculta) && <p className="mt-2 text-xs leading-5 text-[#746A64]">{comentario.oculta ? administracion ? 'Oculto por moderación · no se muestra a las Socias.' : 'Oculto por moderación · solo vos y el equipo lo ven.' : 'Retirado · no se muestra a las demás Socias.'}</p>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <time dateTime={comentario.created_at} className="text-[10px] leading-5 text-[#746A64]">{fechaComunidad(comentario.created_at)}{comentario.actualizado_at !== comentario.created_at ? ' · Editado' : ''}</time>
          {comentario.propia && <>
            {!comentario.retirada && !comentario.oculta && <button type="button" className="min-h-11 min-w-11 px-2 text-xs font-medium text-[#294A38] underline-offset-4 hover:underline" disabled={cargando || enviando || hayTexto || bloqueada || lecturaPendiente} onClick={() => { setEdicion(comentario); setContenido(comentario.contenido); setError(''); setAviso(''); onBorrador(true) }}>Editar</button>}
            <button type="button" className="min-h-11 min-w-11 px-2 text-xs font-medium text-[#294A38] underline-offset-4 hover:underline" disabled={cargando || enviando || hayTexto || bloqueada || lecturaPendiente} onClick={() => { setConfirmar({ id: comentario.id, version: comentario.version, accion: comentario.retirada ? 'restaurar' : 'retirar' }); setError(''); setAviso(''); onBorrador(true) }}>{comentario.retirada ? 'Restaurar' : 'Retirar'}</button>
          </>}
          {administracion && onModerarComentario && <button type="button" className="min-h-11 min-w-11 px-2 text-xs font-semibold text-[#294A38] underline-offset-4 hover:underline" disabled={cargando || enviando || hayTexto || bloqueada || lecturaPendiente} onClick={() => onModerarComentario(comentario)}>{comentario.oculta ? 'Mostrar comentario' : 'Ocultar comentario'}</button>}
        </div>
      </div>
    </div>)}</div>
    {leido && siguiente && !errorLectura && <button type="button" onClick={() => void leerComentarios(siguiente, true)} disabled={cargando} className={`${controlComunidad} mt-4`}>Cargar más comentarios</button>}
    {confirmar && <div role="group" aria-label="Confirmar cambio del comentario" className="mt-4 rounded-[18px] border border-[#EC9BB6] bg-[#F4CAD8] p-4"><p className="text-sm leading-6">{confirmar.accion === 'retirar' ? '¿Retirar tu comentario de esta conversación? No se borra y podés restaurarlo después.' : '¿Restaurar tu comentario? Si está oculto por moderación, seguirá sin mostrarse a las demás.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void cambiarComentario(confirmar)} disabled={cargando || enviando || bloqueada || lecturaPendiente} className={accionComunidad}>{enviando ? 'Confirmando…' : cambio ? 'Reintentar el mismo cambio' : 'Confirmar'}</button><button type="button" onClick={() => { setConfirmar(null); onBorrador(false) }} disabled={enviando || Boolean(cambio)} className={`${controlComunidad} bg-[#FFFDFA]`}>Cancelar</button></div></div>}
    {!confirmar && <form onSubmit={event => void enviar(event)} aria-label={edicion ? 'Editar tu comentario' : 'Agregar comentario'} className="mt-4 min-w-0 rounded-[18px] border border-[#E7DDD5] bg-[#FFFDFA] p-3 sm:p-4"><div className="mb-3 flex items-center gap-2"><CommunityAvatar nombre={nombre} small /><label htmlFor={`nuevo-comentario-${publicacionId}`} className="text-xs font-semibold">{edicion ? 'Editá tu comentario' : 'Sumá tu comentario'}</label></div><textarea id={`nuevo-comentario-${publicacionId}`} name="comentario" value={contenido} onChange={event => { setContenido(event.target.value); onBorrador(Boolean(event.target.value.trim()) || Boolean(edicion)) }} rows={2} maxLength={1000} disabled={cargando || enviando || Boolean(intencion) || bloqueada || lecturaPendiente} aria-describedby={`ayuda-comentario-${publicacionId}`} className={campoComunidad} placeholder="Acompañá, preguntá o compartí tu experiencia…" /><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p id={`ayuda-comentario-${publicacionId}`} className="text-[11px] text-[#746A64]">{contenido.length.toLocaleString('es-AR')} / 1.000 · Texto visible en la comunidad</p><div className="flex flex-wrap gap-2">{edicion && <button type="button" className={controlComunidad} disabled={enviando || Boolean(intencion)} onClick={() => { if (!window.confirm('¿Descartar la edición del comentario?')) return; setEdicion(null); setContenido(''); onBorrador(false); setError('') }}>Cancelar edición</button>}<button type="submit" className={accionComunidad} disabled={cargando || enviando || bloqueada || lecturaPendiente || (!intencion && !contenido.trim())} aria-busy={enviando}>{enviando ? 'Confirmando…' : intencion ? 'Reintentar el mismo envío' : edicion ? 'Guardar comentario' : 'Comentar'}{!enviando && <ArrowIcon />}</button></div></div></form>}
    {bloqueada && !edicion && <button type="button" onClick={() => { if (!window.confirm('¿Cerrar este texto sin reenviar? Actualizá la comunidad para volver a comprobar la conversación.')) return; setContenido(''); setIntencion(null); setError(''); onBorrador(false) }} className={`${controlComunidad} mt-3`}>Cerrar texto sin reenviar</button>}
    {error && <p role="alert" className="mt-3 rounded-[14px] border border-[#EC9BB6] bg-[#F4CAD8] p-3 text-sm leading-6">{error}</p>}
    {aviso && <p role="status" className="mt-3 text-sm leading-6 text-[#294A38]">{aviso}</p>}
  </section>
}
