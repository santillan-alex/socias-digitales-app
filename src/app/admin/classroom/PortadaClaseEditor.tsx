'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { esTipoPortada, MAX_PORTADA_ENTRADA, type TipoPortada } from '@/lib/class-cover'

type Seleccion = { archivo: File; tipo: TipoPortada; url: string }
type Foto = { revision: string; url: string; fuente: 'personalizada' | 'automatica' | 'sin_imagen' | 'error'; parcial?: boolean }
const tipos = ['image/jpeg', 'image/png', 'image/webp'].join(',')
const boton = 'min-h-11 rounded-full border border-[#294A38]/30 px-4 py-2 text-sm font-medium text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'
const porExtension = (nombre: string) => /\.jpe?g$/i.test(nombre) ? 'image/jpeg' : /\.png$/i.test(nombre) ? 'image/png' : /\.webp$/i.test(nombre) ? 'image/webp' : ''

export default function PortadaClaseEditor({ claseId, revisionVideo = 0, disabled = false, onBusy, onChange }: {
  claseId: string
  revisionVideo?: number
  disabled?: boolean
  onBusy: (ocupada: boolean) => void
  onChange: () => void
}) {
  const [revisionLocal, setRevisionLocal] = useState(0)
  const revision = `${claseId}:${revisionVideo}:${revisionLocal}`
  const [foto, setFoto] = useState<Foto | null>(null)
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  const [ocupada, setOcupada] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const guardando = useRef(false)
  const urlLocal = useRef('')
  const input = useRef<HTMLInputElement>(null)
  const confirmada = foto?.revision === revision ? foto : null
  const urlPreview = seleccion?.url || confirmada?.url

  useEffect(() => () => { if (urlLocal.current) URL.revokeObjectURL(urlLocal.current) }, [])
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    async function cargar() {
      try {
        const respuesta = await fetch(`/api/classroom/${claseId}/miniatura`, { signal: controller.signal, cache: 'no-store' })
        if (!respuesta.ok) throw new Error('portada')
        const tipo = respuesta.headers.get('content-type')
        if (respuesta.status === 204 || tipo?.includes('application/json')) {
          if (!controller.signal.aborted) setFoto({ revision, url: '', fuente: 'sin_imagen' })
          return
        }
        if (tipo !== 'image/jpeg' && tipo !== 'image/webp') throw new Error('portada')
        const blob = await respuesta.blob()
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setFoto({ revision, url, fuente: respuesta.headers.get('x-class-thumbnail') === 'custom' ? 'personalizada' : 'automatica',
          parcial: respuesta.headers.get('x-class-cover-unavailable') === '1' })
      } catch {
        if (!controller.signal.aborted) setFoto({ revision, url: '', fuente: 'error' })
      }
    }
    void cargar()
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [claseId, revision])

  function cancelarSeleccion() {
    if (urlLocal.current) URL.revokeObjectURL(urlLocal.current)
    urlLocal.current = ''
    setSeleccion(null)
    if (input.current) input.current.value = ''
  }

  function elegir(event: ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    if (!archivo) return
    setMensaje(''); setError('')
    if (urlLocal.current) URL.revokeObjectURL(urlLocal.current)
    urlLocal.current = ''
    setSeleccion(null)
    const tipo = archivo.type || porExtension(archivo.name)
    if (!esTipoPortada(tipo) || archivo.size === 0 || archivo.size > MAX_PORTADA_ENTRADA) {
      setError('Elegí un JPG, PNG o WebP de hasta 2 MB.')
      event.target.value = ''
      return
    }
    urlLocal.current = URL.createObjectURL(archivo)
    setSeleccion({ archivo, tipo, url: urlLocal.current })
  }

  async function actualizar(metodo: 'POST' | 'DELETE') {
    if (disabled || guardando.current || (metodo === 'POST' && !seleccion)) return
    if (metodo === 'DELETE' && !window.confirm('¿Quitar la portada personalizada? Se volverá a mostrar la miniatura automática, si está disponible.')) return
    guardando.current = true
    setOcupada(true); onBusy(true); setMensaje(''); setError('')
    try {
      const respuesta = await fetch(`/api/admin/clases/${claseId}/portada`, {
        method: metodo,
        ...(metodo === 'POST' && seleccion ? { headers: { 'Content-Type': seleccion.tipo }, body: seleccion.archivo } : {}),
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => null)
        throw new Error(typeof datos?.error === 'string' ? datos.error : 'No pudimos actualizar la portada. El video no se modificó.')
      }
      if (metodo === 'POST' && (await respuesta.json()).ok !== true) throw new Error('No pudimos confirmar la portada. Revisá antes de reintentar.')
      cancelarSeleccion()
      onChange()
      setMensaje(metodo === 'POST' ? 'Portada guardada.' : 'Portada personalizada quitada.')
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos actualizar la portada. El video no se modificó.')
    } finally {
      guardando.current = false
      setOcupada(false)
      onBusy(false)
    }
  }

  const bloqueado = disabled || ocupada
  return <section aria-labelledby="portada-clase-titulo" className="mt-5 min-w-0 space-y-3 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4">
    <h3 id="portada-clase-titulo" className="font-impact text-base font-semibold">Portada de la clase <span className="font-normal">(opcional)</span></h3>
    <p className="text-sm leading-6 text-[#655B56]">Si no subís una portada, usamos la miniatura del video cuando está disponible.</p>
    <div className="relative grid aspect-video w-full max-w-sm place-items-center overflow-hidden rounded-xl bg-[#F4EFEA]">
      {urlPreview ? <img src={urlPreview} alt={seleccion ? 'Vista previa de la portada elegida' : 'Portada actual de la clase'} className="absolute inset-0 h-full w-full object-cover" onError={() => {
        if (seleccion) { cancelarSeleccion(); setError('No pudimos mostrar esa imagen. Elegí otro archivo.') }
        else setFoto({ revision, url: '', fuente: 'error' })
      }} /> : <span className="px-3 text-center text-sm text-[#655B56]">{!confirmada ? 'Cargando vista previa…' : 'Sin vista previa'}</span>}
    </div>
    <p className="text-sm text-[#655B56]">{seleccion ? 'Vista previa sin guardar' : confirmada?.fuente === 'personalizada' ? 'Portada personalizada' : confirmada?.fuente === 'automatica' ? 'Miniatura automática' : null}</p>
    {(confirmada?.fuente === 'error' || confirmada?.parcial) && <div className="flex flex-wrap items-center gap-2">
      <p role="alert" className="text-sm text-[#B01B30]">No pudimos comprobar la portada guardada.</p>
      <button type="button" disabled={bloqueado} onClick={() => setRevisionLocal(actual => actual + 1)} className={boton}>Recargar vista previa</button>
    </div>}
    <label className="block min-w-0 text-sm font-semibold">
      {confirmada?.fuente === 'personalizada' ? 'Elegir reemplazo' : 'Elegir imagen'}
      <input ref={input} type="file" accept={tipos} disabled={bloqueado} onChange={elegir} aria-describedby="portada-clase-formato"
        className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-xl border border-[#D8CFC8] bg-white px-2 py-2 text-base file:mr-2 file:rounded-lg file:border-0 file:bg-[#F4CAD8] file:px-2 file:py-1 file:text-sm" />
    </label>
    <p id="portada-clase-formato" className="text-xs leading-5 text-[#746A64]">JPG, PNG o WebP estático, hasta 2 MB. Ideal: 1280 × 720 px (16:9) y hasta 300 KB. La imagen se ajusta desde el centro.</p>
    <div className="flex flex-wrap gap-2">
      {seleccion && <>
        <button type="button" disabled={bloqueado} onClick={() => void actualizar('POST')} className={boton}>{ocupada ? 'Guardando…' : 'Guardar portada'}</button>
        <button type="button" disabled={bloqueado} onClick={cancelarSeleccion} className={boton}>Cancelar selección</button>
      </>}
      {!seleccion && confirmada?.fuente === 'personalizada' &&
        <button type="button" disabled={bloqueado} onClick={() => void actualizar('DELETE')} className={boton}>{ocupada ? 'Quitando…' : 'Quitar portada personalizada'}</button>}
    </div>
    {mensaje && <p role="status" className="text-sm text-[#294A38]">{mensaje}</p>}
    {error && <p role="alert" className="text-sm text-[#B01B30]">{error}</p>}
  </section>
}
