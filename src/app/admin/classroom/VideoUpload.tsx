'use client'
import { useEffect, useRef, useState } from 'react'
import { validarVideo } from '@/lib/class-management'
import { extraerMiniatura } from '@/lib/video-thumbnail-client'

async function api(body: Record<string, unknown>) {
  const response = await fetch('/api/admin/clases/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error || 'No pudimos conectar con la carga.')
  return data
}
export default function VideoUpload({
  claseId,
  tieneVideo = false,
  onUploaded,
  onBusy,
}: {
  claseId: string
  tieneVideo?: boolean
  onUploaded: () => void
  onBusy: (busy: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [finishing, setFinishing] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false)
  const upload = useRef<{
      token: string
      partSize: number
      completed: Set<number>
    } | null>(null),
    xhr = useRef<XMLHttpRequest | null>(null),
    pause = useRef(false),
    running = useRef(false)
  const [hasUpload, setHasUpload] = useState(false)
  const [playable, setPlayable] = useState(false)
  const captura = useRef<Promise<Blob | null> | null>(null)
  const cancelarCaptura = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )
  useEffect(
    () => () => {
      pause.current = true
      xhr.current?.abort()
      cancelarCaptura.current?.abort()
    },
    [],
  )
  function choose(next: File | null) {
    if (upload.current || busy) return
    setError('')
    setDone(false)
    setPlayable(false)
    setProgress(0)
    if (!next || !validarVideo(next.name, next.size)) {
      setFile(null)
      setPreview('')
      setError('Elegí un video MP4 de hasta 8 GB.')
      return
    }
    setFile(next)
    const localUrl = URL.createObjectURL(next)
    setPreview(localUrl)
    cancelarCaptura.current?.abort()
    cancelarCaptura.current = new AbortController()
    captura.current = extraerMiniatura(localUrl, cancelarCaptura.current.signal).catch(() => null)
  }
  async function start() {
    if (!file || !playable || running.current) return
    running.current = true
    pause.current = false
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      if (!upload.current) {
        const data = await api({
          action: 'iniciar',
          claseId,
          nombre: file.name,
          bytes: file.size,
        })
        upload.current = { ...data, completed: new Set<number>() }
        setHasUpload(true)
      }
      const current = upload.current!
      const parts = Math.ceil(file.size / current.partSize)
      for (let numero = 1; numero <= parts; numero++) {
        if (pause.current) break
        if (current.completed.has(numero)) continue
        const { url } = await api({
          action: 'parte',
          token: current.token,
          numero,
        })
        if (pause.current) break
        const start = (numero - 1) * current.partSize,
          chunk = file.slice(
            start,
            Math.min(start + current.partSize, file.size),
          )
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest()
          xhr.current = request
          request.open('PUT', url)
          request.timeout = 10 * 60 * 1000
          request.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setProgress(
                Math.min(
                  99,
                  Math.floor(((start + e.loaded) / file.size) * 100),
                ),
              )
          }
          request.onload = () =>
            request.status >= 200 && request.status < 300
              ? resolve()
              : reject(
                  new Error(
                    'La conexión interrumpió una parte. Podés reintentar sin repetir lo ya cargado.',
                  ),
                )
          request.onerror = () =>
            reject(
              new Error(
                'No pudimos subir esta parte. Revisá tu conexión y reintentá.',
              ),
            )
          request.ontimeout = () =>
            reject(
              new Error(
                'La conexión está tardando demasiado. Podés continuar desde esta parte.',
              ),
            )
          request.onabort = () => reject(new Error('Carga pausada.'))
          request.send(chunk)
        })
        current.completed.add(numero)
        setProgress(
          Math.min(
            99,
            Math.floor(
              (Math.min(numero * current.partSize, file.size) / file.size) *
                100,
            ),
          ),
        )
      }
      if (!pause.current) {
        setFinishing(true)
        await api({ action: 'finalizar', token: current.token })
        // No afecta al video si falla una captura. El panel vuelve a intentar
        // automáticamente generar miniaturas pendientes al mostrar la tarjeta.
        try {
          const imagen = await captura.current
          if (imagen) {
            const info = await fetch(`/api/classroom/${claseId}/miniatura?fuente=automatica`, { cache: 'no-store' })
            if (info.headers.get('content-type')?.includes('application/json')) {
              const { revision } = await info.json()
              if (revision) await fetch(`/api/admin/clases/${claseId}/miniatura?revision=${encodeURIComponent(revision)}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: imagen })
            }
          }
        } catch { /* La clase se conserva aunque la miniatura no esté disponible. */ }
        setProgress(100)
        setDone(true)
        upload.current = null
        setHasUpload(false)
        onUploaded()
      }
    } catch (cause) {
      if (!pause.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'No pudimos completar la carga.',
        )
    } finally {
      xhr.current = null
      running.current = false
      setBusy(false)
      setFinishing(false)
      onBusy(false)
    }
  }
  async function cancel() {
    pause.current = true
    xhr.current?.abort()
    setBusy(true)
    onBusy(true)
    try {
      if (upload.current)
        await api({ action: 'cancelar', token: upload.current.token })
      upload.current = null
      setHasUpload(false)
      setFile(null)
      setPreview('')
      setProgress(0)
      setError('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No pudimos cancelar. Reintentá.',
      )
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <section className="rounded-2xl border border-[#E7DDD5] bg-white p-4">
      <h3 className="font-impact text-sm font-semibold">Video de la clase</h3>
      <p role="status" className="mt-2 text-sm text-[#294A38]">
        {done || tieneVideo
          ? 'Video privado cargado. Elegir otro archivo reemplaza el video al finalizar la nueva carga.'
          : 'Ficha guardada. Elegí el archivo para cargar el video.'}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#746A64]">
        MP4 · hasta 8 GB por archivo. Recomendado: H.264 + audio AAC, 720p o
        1080p. No se comprime automáticamente. La miniatura se toma del video.
      </p>
      {!done && (
        <label className="mt-3 block text-sm">
          Elegir archivo
          <input
            type="file"
            accept="video/mp4,.mp4"
            disabled={busy || hasUpload}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full min-w-0 text-base file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-[#F4CAD8] file:px-4 file:py-3 file:text-sm"
          />
        </label>
      )}
      {preview && (
        <video
          src={preview}
          controls
          playsInline
          preload="metadata"
          aria-label="Vista previa del archivo seleccionado"
          onLoadedMetadata={() => setPlayable(true)}
          className="mt-4 aspect-video w-full rounded-xl bg-black"
          onError={() => {
            setPlayable(false)
            setError(
              'Este archivo no se puede previsualizar en tu navegador. Exportalo como MP4 H.264 con audio AAC antes de subirlo.',
            )
          }}
        />
      )}
      {file && (
        <p className="mt-3 break-all text-xs text-[#746A64]">
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
      {file && (
        <div className="mt-3">
          <progress
            aria-label="Progreso de carga"
            max={100}
            value={progress}
            className="h-2 w-full accent-[#294A38]"
          />
          <p role="status" className="mt-2 text-sm">
            {done
              ? 'Video cargado y vinculado. Guardá la clase como publicada cuando esté lista.'
              : finishing
                ? 'Verificando el video…'
                : busy
                  ? `Subiendo · ${progress}%`
                  : `${progress}% cargado`}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[#B01B30]">
          {error}
        </p>
      )}
      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          {busy ? (
            <button
              type="button"
              disabled={finishing}
              onClick={() => {
                pause.current = true
                xhr.current?.abort()
              }}
              className="min-h-11 rounded-full border border-[#294A38]/30 px-4 py-3 text-sm disabled:opacity-50"
            >
              Pausar
            </button>
          ) : (
            <button
              type="button"
              disabled={!file || !playable}
              onClick={() => void start()}
              className="min-h-11 rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {hasUpload ? 'Continuar / reintentar' : 'Subir video'}
            </button>
          )}
          {hasUpload && !busy && (
            <button
              type="button"
              onClick={() => void cancel()}
              className="min-h-11 rounded-full border border-[#D8CFC8] px-4 py-3 text-sm"
            >
              Descartar carga
            </button>
          )}
        </div>
      )}
      {hasUpload && (
        <p className="mt-3 text-xs leading-5 text-[#746A64]">
          Mantené esta ventana abierta para continuar sin repetir las partes
          cargadas. Descartar no borra el video anterior.
        </p>
      )}
    </section>
  )
}
