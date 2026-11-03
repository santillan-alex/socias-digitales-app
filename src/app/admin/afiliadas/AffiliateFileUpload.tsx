'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { analizarArchivoAfiliadasUrl, validarArchivoAfiliadas } from '@/lib/affiliate-files'

export interface ArchivoAfiliadaSubido {
  id: string; recursoId: string; nombre: string; bytes: number; mime: string; extension: string; url: string
}
interface SesionCarga { token: string; parteBytes: number; totalPartes: number }
const boton = 'inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const peso = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`
function objeto(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
async function api(body: Record<string, unknown>) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch('/api/admin/afiliadas/archivos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
    const data: unknown = await response.json()
    if (!response.ok || !objeto(data)) throw new Error(objeto(data) && typeof data.error === 'string' ? data.error : 'No pudimos confirmar la carga. Reintentá desde este mismo formulario.')
    return data
  } finally { clearTimeout(timer) }
}
function archivoConfirmado(value: unknown, recursoId: string, file: File): value is ArchivoAfiliadaSubido {
  if (!objeto(value) || typeof value.url !== 'string') return false
  const ref = analizarArchivoAfiliadasUrl(value.url)
  const esperado = validarArchivoAfiliadas(file.name, file.size)
  return ref?.recursoId === recursoId && ref.archivoId === value.id && value.recursoId === recursoId && value.nombre === esperado.nombre && value.bytes === file.size && value.mime === esperado.mime && value.extension === esperado.extension
}
export default function AffiliateFileUpload({ recursoId, tipo, actualUrl, disabled, onUploaded, onBusy, onPending }: {
  recursoId: string; tipo: 'video' | 'archivo'; actualUrl: string; disabled: boolean
  onUploaded: (archivo: ArchivoAfiliadaSubido) => void; onBusy: (busy: boolean) => void; onPending: (pending: boolean) => void
}) {
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [finishing, setFinishing] = useState(false)
  const [error, setError] = useState(''), [estado, setEstado] = useState(''), [progress, setProgress] = useState(0), [hasUpload, setHasUpload] = useState(false), [done, setDone] = useState(false)
  const upload = useRef<SesionCarga | null>(null), xhr = useRef<XMLHttpRequest | null>(null), pause = useRef(false), running = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pause.current = true; xhr.current?.abort(); if (upload.current) void api({ action: 'cancelar', token: upload.current.token }).catch(() => {}) } }, [])
  function choose(next: File | null) {
    if (running.current || upload.current || disabled) return
    setError(''); setEstado(''); setDone(false); setProgress(0)
    if (!next) { setFile(null); onPending(false); return }
    try {
      const datos = validarArchivoAfiliadas(next.name, next.size)
      if ((tipo === 'video') !== (datos.extension === 'mp4')) throw new Error(tipo === 'video' ? 'Elegí un video MP4. Para un documento, elegí Archivos y guías.' : 'Para subir un MP4, elegí Videos para anuncios.')
      setFile(next); onPending(true)
    } catch (cause) { setFile(null); onPending(false); setError(cause instanceof Error ? cause.message : 'Revisá el archivo elegido.') }
  }
  async function start() {
    if (!file || running.current || disabled || done) return
    running.current = true; pause.current = false; setBusy(true); onBusy(true); setError(''); setEstado('Preparando la carga…')
    try {
      if (!upload.current) {
        const data = await api({ action: 'iniciar', recursoId, nombre: file.name, bytes: file.size })
        if (!mounted.current) { if (typeof data.token === 'string') void api({ action: 'cancelar', token: data.token }).catch(() => {}); return }
        if (typeof data.token !== 'string' || !data.token || !Number.isSafeInteger(data.parteBytes) || Number(data.parteBytes) < 5 * 1024 * 1024 || Number(data.parteBytes) > 64 * 1024 * 1024 || data.totalPartes !== Math.ceil(file.size / Number(data.parteBytes))) throw new Error('No pudimos preparar esta carga. Volvé a elegir el archivo.')
        upload.current = { token: data.token, parteBytes: Number(data.parteBytes), totalPartes: Number(data.totalPartes) }; setHasUpload(true)
      }
      const current = upload.current
      if (pause.current) { setEstado('Carga pausada. Podés continuar acá.'); return }
      const status = await api({ action: 'estado', token: current.token })
      if (!mounted.current) return
      if (!Array.isArray(status.partes) || status.partes.some(n => !Number.isSafeInteger(n) || n < 1 || n > current.totalPartes) || new Set(status.partes).size !== status.partes.length) throw new Error('No pudimos comprobar las partes cargadas. Reintentá la misma carga.')
      const completed = new Set<number>(status.partes)
      const bytesCompletos = () => [...completed].reduce((sum, n) => sum + Math.min(current.parteBytes, file.size - (n - 1) * current.parteBytes), 0)
      setProgress(Math.min(99, Math.floor(bytesCompletos() / file.size * 100)))
      for (let numero = 1; numero <= current.totalPartes; numero++) {
        if (pause.current) break
        if (completed.has(numero)) continue
        setEstado(`Subiendo parte ${numero} de ${current.totalPartes}…`)
        const data = await api({ action: 'firmar', token: current.token, numero })
        if (!mounted.current) return
        if (typeof data.url !== 'string') throw new Error('No pudimos preparar esta parte.')
        const destino = new URL(data.url)
        if (destino.protocol !== 'https:' || !destino.hostname.endsWith('.r2.cloudflarestorage.com') || destino.username || destino.password) throw new Error('El destino de carga no es válido.')
        if (pause.current) break
        const start = (numero - 1) * current.parteBytes
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest(); xhr.current = request
          request.open('PUT', data.url as string); request.timeout = 10 * 60 * 1000
          request.upload.onprogress = event => { if (mounted.current && event.lengthComputable) setProgress(Math.min(99, Math.floor((bytesCompletos() + event.loaded) / file.size * 100))) }
          request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Esta parte no se confirmó. Reintentá para continuar sin repetir lo ya cargado.'))
          request.onerror = () => reject(new Error('Se interrumpió la conexión. Podés continuar esta misma carga.'))
          request.ontimeout = () => reject(new Error('La conexión está tardando demasiado. Podés reintentar esta misma carga.'))
          request.onabort = () => reject(new Error('Carga pausada. Podés continuar acá.'))
          request.send(file.slice(start, Math.min(start + current.parteBytes, file.size)))
        })
        if (!mounted.current) return
        completed.add(numero); setProgress(Math.min(99, Math.floor(bytesCompletos() / file.size * 100)))
      }
      if (pause.current) { setEstado('Carga pausada. Podés continuar acá.'); return }
      setFinishing(true); setEstado('Verificando el archivo…')
      const data = await api({ action: 'completar', token: current.token })
      if (!mounted.current) return
      if (!archivoConfirmado(data.archivo, recursoId, file)) throw new Error('La respuesta no confirma este archivo. Reintentá la misma carga.')
      onUploaded(data.archivo); onPending(false); setProgress(100); setDone(true); upload.current = null; setHasUpload(false)
      setEstado('Archivo listo. Guardá el recurso para conservarlo o publicarlo.')
    } catch (cause) {
      if (!mounted.current) return
      if (pause.current) setEstado('Carga pausada. Podés continuar acá.')
      else setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'No se confirmó la carga. Reintentá acá; conservamos las partes recibidas.')
    } finally { xhr.current = null; running.current = false; if (mounted.current) { setBusy(false); setFinishing(false); onBusy(false) } }
  }
  async function cambiar() {
    if (running.current || disabled) return
    running.current = true; setBusy(true); onBusy(true); setError('')
    try {
      if (upload.current) await api({ action: 'cancelar', token: upload.current.token })
      if (!mounted.current) return
      upload.current = null; setHasUpload(false); setFile(null); setDone(false); setProgress(0); setEstado(''); onPending(false)
    } catch { if (mounted.current) setError('No pudimos cerrar la carga anterior. Reintentá antes de elegir otro archivo.') }
    finally { running.current = false; if (mounted.current) { setBusy(false); onBusy(false) } }
  }
  const accept = tipo === 'video' ? '.mp4,video/mp4' : '.pdf,.docx,.xlsx,.pptx,.txt,.jpg,.jpeg,.png,.webp'
  return <section aria-label="Subir archivo del recurso" className="min-w-0 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4">
    {actualUrl && !done && <p className="mb-3 text-sm font-medium text-[#294A38]">Ya hay un archivo cargado. Se conserva hasta que guardes un reemplazo.</p>}
    {!file ? <><label htmlFor={inputId} className="block text-sm font-semibold">{tipo === 'video' ? 'Elegí el video' : 'Elegí el archivo'}</label><input key={tipo} id={inputId} type="file" accept={accept} disabled={disabled || busy || hasUpload} onChange={e => { choose(e.target.files?.[0] ?? null); e.target.value = '' }} className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] p-3 text-base file:mr-2 file:rounded-full file:border-0 file:bg-[#F4CAD8] file:px-3 file:py-2 file:text-sm file:text-[#211C19]" /></> : <><p className="break-all text-sm font-semibold">{file.name}</p><p className="mt-1 text-xs text-[#746A64]">{peso(file.size)}</p></>}
    <p className="mt-3 text-xs leading-5 text-[#746A64]">{tipo === 'video' ? 'Video MP4 de hasta 1 GB.' : 'PDF, documentos de Office, TXT o imágenes de hasta 25 MB.'} Podés cargarlo antes de guardar la ficha. Solo se comparte al publicar el recurso.</p>
    {file && <div className="mt-4 space-y-3"><progress aria-label="Progreso de la carga" value={progress} max={100} className="block h-2 w-full accent-[#294A38]" /><p role="status" aria-live="polite" className="break-words text-sm text-[#294A38]">{progress}%{estado ? ` · ${estado}` : ''}</p><div className="flex flex-wrap gap-2">{!done && <button type="button" disabled={disabled || busy} onClick={() => void start()} className={`${boton} border-[#294A38]`}>{busy ? finishing ? 'Verificando…' : 'Subiendo…' : hasUpload ? 'Continuar carga' : 'Subir archivo'}</button>}{busy && !finishing && <button type="button" onClick={() => { pause.current = true; xhr.current?.abort(); setEstado('Pausando…') }} className={boton}>Pausar</button>}{!busy && <button type="button" disabled={disabled} onClick={() => void cambiar()} className={boton}>{hasUpload ? 'Cancelar y elegir otro' : 'Elegir otro archivo'}</button>}</div></div>}
    {error && <p role="alert" className="mt-3 break-words rounded-xl border border-[#B01B30] bg-[#FFFDFA] p-3 text-sm leading-6">{error}</p>}
  </section>
}
