'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import { createClient } from '@/lib/supabase/client'
import { PROGRAMAS_INICIALES, SECCIONES_CLASE, ubicacionClase, clasificacionClase, ordenarClases, puedePublicarClase, type SeccionClase } from '@/lib/class-management'
import VideoUpload from './VideoUpload'
import ClassProgressAdmin, {type EstadisticaClase} from './ClassProgressAdmin'
import ClassVideoThumbnail from '@/components/ClassVideoThumbnail'
import ClassMaterialsEditor from './ClassMaterialsEditor'

interface Clase {
  id: string
  titulo: string
  descripcion: string | null
  vimeo_url: string | null
  video_key: string | null
  orden: number
  plan: '27' | '97'
  modulo: string
  activo: boolean
  acceso_gratuito: boolean
  solo_farmaci: boolean
}
interface Alumna {
  id: string
  nombre: string
  plan: string | null
}
type Ficha = {
  id?: string
  titulo: string
  descripcion: string
  vimeo_url: string
  modulo: string
  orden: number
  activo: boolean
  acceso_gratuito: boolean
  solo_farmaci: boolean
  tieneVideo: boolean
}
const vacia: Ficha = {
  titulo: '',
  descripcion: '',
  vimeo_url: '',
  modulo: 'Desafío Socias',
  orden: 0,
  activo: false,
  acceso_gratuito: false,
  solo_farmaci: false,
  tieneVideo: false,
}
const inputStyle =
  'mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base'
export default function ClassroomAdmin({
  clases,
  alumnas,
  errorCarga = false,
  estadisticas = [],
  errorProgreso = false,
}: {
  clases: Clase[]
  alumnas: Alumna[]
  errorCarga?: boolean
  estadisticas?: EstadisticaClase[]
  errorProgreso?: boolean
}) {
  const router = useRouter(),
    supabase = createClient()
  const [tab, setTab] = useState<'clases' | 'alumnas' | 'progreso'>('clases'),
    [filtro, setFiltro] = useState('Todos'),
    [ficha, setFicha] = useState<Ficha | null>(null),
    [guardando, setGuardando] = useState(false),
    [cargando, setCargando] = useState(false),
    [aviso, setAviso] = useState(''),
    [modalError, setModalError] = useState(''),
    [programaNuevo, setProgramaNuevo] = useState(''),
    [programasLocales, setProgramasLocales] = useState<string[]>([])
  const [materialOcupado, setMaterialOcupado] = useState(false)
  const [materialPendiente, setMaterialPendiente] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)
  const continuarAlVideo = useRef(false)
  const editorAbierto = Boolean(ficha)
  const puedePublicar = ficha ? puedePublicarClase(ficha) : false
  const pasoActual = !ficha?.id ? 1 : puedePublicar ? 3 : 2
  function cerrarEditor() {
    if (cargando || guardando || materialOcupado) return
    if (materialPendiente && !window.confirm('Tenés materiales sin guardar. ¿Cerrar y descartar esos cambios?')) return
    setMaterialPendiente(false)
    setFicha(null)
  }
  useEffect(() => {
    if (!editorAbierto) return
    const anterior = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => anterior?.focus()
  }, [editorAbierto])
  useEffect(() => {
    if (!ficha?.id || !continuarAlVideo.current) return
    continuarAlVideo.current = false
    videoRef.current?.scrollIntoView({ block: 'nearest' })
    videoRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.focus({ preventScroll: true })
  }, [ficha?.id])
  const programas = [
    ...new Set([
      ...PROGRAMAS_INICIALES,
      ...clases.map((c) => ubicacionClase(c.modulo).programa),
      ...programasLocales,
    ]),
  ]
  async function api(body: Record<string, unknown>) {
    const response = await fetch('/api/admin/clases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    return data
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!ficha || guardando || cargando || materialOcupado) return
    setGuardando(true)
    setModalError('')
    try {
      // Una ficha sin video siempre se guarda como borrador, incluso si
      // conservó una selección de publicación de un estado anterior.
      const datos = { ...ficha, activo: ficha.activo && puedePublicarClase(ficha) }
      const data = await api(datos)
      continuarAlVideo.current = !ficha.id && !puedePublicarClase(ficha)
      setFicha({ ...datos, id: data.id })
      setAviso(
        datos.activo
          ? 'Clase publicada.'
          : 'Borrador guardado; todavía no es visible para las alumnas.',
      )
      router.refresh()
    } catch (cause) {
      setModalError(
        cause instanceof Error ? cause.message : 'No pudimos guardar.',
      )
    } finally {
      setGuardando(false)
    }
  }
  async function archivar(c: Clase) {
    if (!c.activo && !puedePublicarClase({ tieneVideo: Boolean(c.video_key), vimeo_url: c.vimeo_url, solo_farmaci: c.solo_farmaci })) return
    if (
      !window.confirm(
        `¿${c.activo ? 'Ocultar' : 'Publicar'} “${c.titulo}”? ${c.activo ? 'No se borrará el video ni la ficha.' : ''}`,
      )
    )
      return
    try {
      await api({ ...c, activo: !c.activo })
      setAviso(
        c.activo
          ? 'Clase oculta; podés volver a publicarla.'
          : 'Clase publicada.',
      )
      router.refresh()
    } catch (cause) {
      setAviso(cause instanceof Error ? cause.message : 'No pudimos guardar.')
    }
  }
  async function renombrar(anterior: string) {
    const nuevo = window.prompt('Nuevo nombre del programa', anterior)
    if (!nuevo?.trim() || nuevo.trim() === anterior) return
    try {
      await api({ action: 'renombrar', anterior, nuevo })
      setFiltro('Todos')
      setAviso('Programa actualizado sin cambiar videos ni accesos.')
      router.refresh()
    } catch (cause) {
      setAviso(cause instanceof Error ? cause.message : 'No pudimos renombrar.')
    }
  }
  async function asignarPlan(id: string, plan: string | null) {
    setGuardando(true)
    setAviso('')
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ plan })
        .eq('id', id)
      if (error) throw error
      router.refresh()
    } catch {
      setAviso('No pudimos actualizar el plan.')
    } finally {
      setGuardando(false)
    }
  }
  function abrir(c?: Clase, modulo?: string) {
    setModalError('')
    setAviso('')
    setFicha(
      c
        ? {
            ...c,
            modulo: clasificacionClase(ubicacionClase(c.modulo).programa, ubicacionClase(c.modulo).seccion) ?? c.modulo,
            descripcion: c.descripcion ?? '',
            vimeo_url: c.vimeo_url ?? '',
            tieneVideo: Boolean(c.video_key),
          }
        : {
            ...vacia,
            modulo: modulo ?? vacia.modulo,
            orden: clases.filter((c) => {
              const actual = ubicacionClase(c.modulo), destino = ubicacionClase(modulo ?? vacia.modulo)
              return actual.programa === destino.programa && actual.seccion === destino.seccion
            }).reduce((max, c) => Math.max(max, c.orden), -1) + 1,
          },
    )
  }
  return (
    <main
      className="min-h-screen bg-[#F4EFEA] text-[#211C19]"
      data-platform-role="admin"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-4 sm:px-8">
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm text-[#294A38]"
        >
          ← Panel de Flor
        </a>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/classroom"
            className="inline-flex min-h-11 items-center rounded-full border border-[#D8CFC8] px-4 py-3 text-sm"
          >
            Ver biblioteca
          </Link>
          <button
            onClick={() => abrir()}
            className="min-h-11 rounded-full bg-[#294A38] px-4 py-3 text-sm font-semibold text-white"
          >
            + Nueva clase
          </button>
        </div>
      </header>
      <AdminSectionMenu />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <p className="font-impact text-[10px] uppercase tracking-[.2em] text-[#294A38]">
          Biblioteca
        </p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
          Clases y programas
        </h1>
        <div className="my-6 flex flex-wrap gap-2">
          {(['clases', 'progreso', 'alumnas'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 rounded-full border px-4 py-3 text-sm ${tab === t ? 'border-[#EC9BB6] bg-[#F4CAD8]' : 'border-[#D8CFC8] bg-[#FAF7F3]'}`}
            >
              {t === 'clases' ? 'Contenido' : t === 'progreso' ? 'Seguimiento' : 'Alumnas y planes'}
            </button>
          ))}
        </div>
        {(aviso || errorCarga) && (
          <p
            role="status"
            className="mb-5 rounded-2xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm"
          >
            {aviso ||
              'No pudimos cargar la biblioteca. Recargá antes de hacer cambios.'}
          </p>
        )}
        {tab === 'progreso' ? <ClassProgressAdmin clases={clases} estadisticas={estadisticas} error={errorProgreso} /> : tab === 'clases' ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Clases', clases.length],
                ['Publicadas', clases.filter((c) => c.activo).length],
                ['Borradores', clases.filter((c) => !c.activo).length],
                [
                  'Gratuitas',
                  clases.filter((c) => c.activo && c.acceso_gratuito).length,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"
                >
                  <p className="text-xs text-[#746A64]">{label}</p>
                  <p className="mt-2 font-impact text-3xl font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="my-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 text-sm">
                Programa
                <select
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className={inputStyle}
                >
                  <option>Todos</option>
                  {programas.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <form
                className="flex min-w-0 flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const p = programaNuevo.trim().replace(/\s+/g, ' ')
                  if (p) {
                    setProgramasLocales((prev) => [...prev, p])
                    setProgramaNuevo('')
                    abrir(undefined, p)
                  }
                }}
              >
                <label className="min-w-0 flex-1 text-sm">
                  Nuevo programa
                  <input
                    required
                    maxLength={75}
                    value={programaNuevo}
                    onChange={(e) => setProgramaNuevo(e.target.value)}
                    className={inputStyle}
                    placeholder="Nombre del programa"
                  />
                </label>
                <button className="min-h-11 rounded-full border border-[#294A38]/30 px-4 py-3 text-sm text-[#294A38]">
                  Crear y agregar clase
                </button>
              </form>
            </div>
            <div className="space-y-7">
              {programas
                .filter((p) => filtro === 'Todos' || p === filtro)
                .map((programa) => {
                  const contenido = ordenarClases(clases.filter((c) => ubicacionClase(c.modulo).programa === programa))
                  return (
                    <details
                      key={programa}
                      className="rounded-3xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:p-6"
                    >
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <p className="text-xs text-[#746A64]">
                            Programa · {contenido.length} clases
                          </p>
                          <h2 className="mt-1 break-words font-serif text-2xl">
                            {programa}
                          </h2>
                        </div>
                        <span aria-hidden="true" className="text-xl text-[#294A38]">⌄</span>
                      </summary>
                        <div className="my-4 flex flex-wrap gap-2">
                          {contenido.length > 0 && (
                            <button
                              onClick={() => void renombrar(programa)}
                              className="min-h-11 rounded-full border border-[#D8CFC8] px-4 py-3 text-xs"
                            >
                              Renombrar
                            </button>
                          )}
                          <button
                            onClick={() => abrir(undefined, programa)}
                            className="min-h-11 rounded-full bg-[#F4CAD8] px-4 py-3 text-xs font-semibold"
                          >
                            + Agregar clase
                          </button>
                        </div>
                      {contenido.length ? (
                        <div className="space-y-4">
                        {SECCIONES_CLASE.map(seccion => {
                          const videos = contenido.filter(c => ubicacionClase(c.modulo).seccion === seccion)
                          if (!videos.length && programa === 'Bienvenida') return null
                          return <section key={seccion} aria-label={`${programa}: ${seccion}`}>
                          {programa !== 'Bienvenida' && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-impact text-base font-semibold">{seccion} <span className="font-normal text-[#746A64]">· {videos.length}</span></h3><button type="button" onClick={() => abrir(undefined, clasificacionClase(programa, seccion)!)} className="min-h-11 rounded-full border border-[#D8CFC8] px-4 py-2 text-xs">+ Agregar a {seccion.toLocaleLowerCase('es')}</button></div>}
                        <div className="grid gap-3 lg:grid-cols-2">
                          {videos.map((c, index) => (
                            <article
                              key={c.id}
                              className="rounded-2xl border border-[#E7DDD5] bg-white p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-24 shrink-0"><ClassVideoThumbnail id={c.id} titulo={c.titulo} disponible={Boolean(c.video_key)} esAdmin revision={c.video_key ?? ''} /></div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="break-words font-impact text-sm font-semibold">
                                    {String(index + 1).padStart(2, '0')} · {c.titulo}
                                  </h3>
                                  <p className="mt-2 text-xs leading-5 text-[#746A64]">
                                    {c.activo ? 'Publicada' : 'Borrador'} ·{' '}
                                    {c.solo_farmaci ? 'Solo Socias Farmaci' : c.acceso_gratuito
                                      ? 'Acceso gratuito'
                                      : 'Socias / Desafío habilitado'}
                                  </p>
                                  <p className="mt-1 text-xs text-[#294A38]">
                                    {c.video_key
                                      ? 'Video privado cargado'
                                      : c.vimeo_url
                                        ? 'Vimeo conectado'
                                        : 'Falta cargar video'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => abrir(c)}
                                  className="min-h-11 rounded-full border border-[#294A38]/25 px-4 py-3 text-xs font-medium text-[#294A38]"
                                >
                                  Editar / subir video
                                </button>
                                <button
                                  onClick={() => void archivar(c)}
                                  disabled={!c.activo && !puedePublicarClase({ tieneVideo: Boolean(c.video_key), vimeo_url: c.vimeo_url, solo_farmaci: c.solo_farmaci })}
                                  title={!c.activo && !c.video_key && !c.vimeo_url ? 'Cargá el video desde Editar / subir video antes de publicar.' : undefined}
                                  className="min-h-11 rounded-full border border-[#D8CFC8] px-4 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {c.activo ? 'Ocultar' : 'Publicar'}
                                </button>
                                {(c.video_key || c.vimeo_url) && (
                                  <Link
                                    href="/classroom"
                                    className="inline-flex min-h-11 items-center px-3 py-3 text-xs text-[#294A38]"
                                  >
                                    Ver biblioteca →
                                  </Link>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                          {!videos.length && <p className="rounded-xl border border-dashed border-[#D8CFC8] p-4 text-sm text-[#746A64]">Todavía no hay videos en esta sección.</p>}
                          </section>
                        })}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-[#D8CFC8] p-5 text-sm text-[#746A64]">
                          Agregá la primera clase. Los borradores no aparecen a
                          las alumnas.
                        </p>
                      )}
                    </details>
                  )
                })}
            </div>
          </>
        ) : (
          <section className="space-y-3">
            <p className="text-sm text-[#746A64]">
              Los permisos de Gratuito, Desafío y Socias se gestionan desde{' '}
              <a href="/admin" className="underline">
                Acceso y actividad
              </a>
              . Se conservan los planes anteriores.
            </p>
            {alumnas.map((a) => (
              <article
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-[#746A64]">
                    {a.plan ? `Plan $${a.plan}` : 'Sin plan anterior'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['27', '97', null] as const).map((p) => (
                    <button
                      key={p ?? 'ninguno'}
                      disabled={guardando}
                      onClick={() => void asignarPlan(a.id, p)}
                      className={`min-h-11 rounded-full border border-[#D8CFC8] px-4 py-3 text-xs ${a.plan === p ? 'bg-[#F4CAD8]' : ''}`}
                    >
                      {p ? '$' + p : 'Quitar plan'}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
      {ficha && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171413]/65 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clase-editor-titulo"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); cerrarEditor() }
            if (e.key === 'Tab') {
              const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button, input, textarea, select, summary, a[href]')].filter(el => !el.matches(':disabled') && el.getClientRects().length > 0)
              const first = controls[0], last = controls[controls.length - 1]
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
            }
          }}
        >
          <div ref={dialogRef} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-[#FAF7F3] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="clase-editor-titulo"
                className="font-impact text-xl font-semibold"
              >
                {ficha.id ? 'Editar clase' : 'Nueva clase'}
              </h2>
              <button
                disabled={cargando || guardando || materialOcupado}
                onClick={cerrarEditor}
                aria-label="Cerrar editor"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D8CFC8] text-xl disabled:opacity-40"
              >
                ×
              </button>
            </div>
            <ol aria-label="Pasos para publicar una clase" className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {['Ficha', 'Video', 'Publicar'].map((paso, i) => (
                <li key={paso} aria-current={pasoActual === i + 1 ? 'step' : undefined} className={`rounded-xl border px-3 py-2 ${pasoActual === i + 1 ? 'border-[#EC9BB6] bg-[#F4CAD8] font-semibold' : 'border-[#E7DDD5] text-[#746A64]'}`}>
                  {i + 1}. {paso}
                </li>
              ))}
            </ol>
            <form onSubmit={guardar} className="mt-5 space-y-4">
              <fieldset disabled={guardando || cargando || materialOcupado} className="space-y-4">
              <label className="block text-sm">
                Título
                <input
                  required
                  maxLength={180}
                  value={ficha.titulo}
                  onChange={(e) =>
                    setFicha({ ...ficha, titulo: e.target.value })
                  }
                  className={inputStyle}
                />
              </label>
              <label className="block text-sm">
                Programa
                <input
                  required
                  maxLength={75}
                  list="programas-clase"
                  value={ficha.modulo.split(' › ')[0]}
                  onChange={(e) =>
                    setFicha({ ...ficha, modulo: e.target.value + (e.target.value !== 'Bienvenida' && ubicacionClase(ficha.modulo).seccion === 'Material de apoyo' ? ' › Material de apoyo' : '') })
                  }
                  className={inputStyle}
                />
                <datalist id="programas-clase">
                  {programas.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </datalist>
              </label>
              {ubicacionClase(ficha.modulo).programa !== 'Bienvenida' && <label className="block text-sm">Sección<select value={ubicacionClase(ficha.modulo).seccion} onChange={e => setFicha({ ...ficha, modulo: clasificacionClase(ubicacionClase(ficha.modulo).programa, e.target.value as SeccionClase) ?? ficha.modulo })} className={inputStyle}>{SECCIONES_CLASE.map(seccion => <option key={seccion}>{seccion}</option>)}</select></label>}
              <label className="block text-sm">
                Descripción
                <textarea
                  rows={2}
                  maxLength={3000}
                  value={ficha.descripcion}
                  onChange={(e) =>
                    setFicha({ ...ficha, descripcion: e.target.value })
                  }
                  className={inputStyle}
                />
              </label>
              <label className="block text-sm">
                Posición dentro de la sección
                <input
                  type="number"
                  required
                  min={1}
                  max={10000}
                  value={ficha.orden + 1}
                  onChange={(e) =>
                    setFicha({ ...ficha, orden: Number(e.target.value) - 1 })
                  }
                  className={inputStyle}
                />
              </label>
              {!ficha.solo_farmaci && <details>
                <summary className="min-h-11 cursor-pointer py-3 text-sm text-[#294A38]">
                  Usar enlace de Vimeo en lugar de archivo
                </summary>
                <label className="block text-sm">
                  Enlace de Vimeo
                  <input
                    type="url"
                    value={ficha.vimeo_url}
                    onChange={(e) => {
                      const siguiente = { ...ficha, vimeo_url: e.target.value }
                      setFicha({ ...siguiente, activo: ficha.activo && puedePublicarClase(siguiente) })
                    }}
                    className={inputStyle}
                    placeholder="https://vimeo.com/123456789"
                  />
                </label>
                <p className="mt-2 text-xs text-[#746A64]">
                  Si hay un video privado cargado, ese video tiene prioridad.
                </p>
              </details>}
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" checked={ficha.solo_farmaci} aria-describedby="farmaci-clase-ayuda"
                  onChange={e => setFicha({ ...ficha, solo_farmaci: e.target.checked, activo: false,
                    ...(e.target.checked ? { acceso_gratuito: false, vimeo_url: '' } : {}) })} />
                Solo Socias Farmaci
              </label>
              <p id="farmaci-clase-ayuda" className="text-xs leading-5 text-[#746A64]">Solo la ven alumnas activas con este acceso. Requiere un MP4 privado. Si cambiás el acceso, revisá la publicación antes de guardar.</p>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  disabled={ficha.solo_farmaci}
                  checked={ficha.acceso_gratuito}
                  onChange={(e) =>
                    setFicha({ ...ficha, acceso_gratuito: e.target.checked })
                  }
                />
                Clase de muestra: disponible para cuentas gratuitas
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  disabled={!puedePublicar}
                  aria-describedby="clase-publicacion-ayuda"
                  checked={ficha.activo && puedePublicar}
                  onChange={(e) =>
                    setFicha({ ...ficha, activo: e.target.checked })
                  }
                />
                Publicar en la biblioteca al guardar
              </label>
              <p id="clase-publicacion-ayuda" className="text-sm text-[#746A64]">
                {puedePublicar
                  ? 'El video está listo. Activá esta opción y guardá para que las alumnas vean la clase.'
                  : ficha.solo_farmaci ? 'Cargá un MP4 privado antes de publicar. Podés guardar un borrador ahora.' : 'La publicación se habilita cuando cargues el video o agregues un enlace de Vimeo válido. Podés guardar el borrador ahora.'}
              </p>
              {modalError && (
                <p role="alert" className="text-sm text-[#B01B30]">
                  {modalError}
                </p>
              )}
              <button
                disabled={guardando || cargando}
                className="min-h-11 w-full rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {guardando
                  ? 'Guardando…'
                  : ficha.activo && puedePublicar
                    ? 'Guardar y publicar clase'
                    : !ficha.id && !puedePublicar
                      ? 'Guardar borrador y continuar al video'
                      : 'Guardar borrador'}
              </button>
              </fieldset>
            </form>
            <div ref={videoRef} className="mt-5">
              {ficha.id ? (
                <fieldset disabled={guardando || materialOcupado}><VideoUpload
                  key={ficha.id}
                  claseId={ficha.id}
                  tieneVideo={ficha.tieneVideo}
                  onBusy={setCargando}
                  onUploaded={() => {
                    setFicha((p) =>
                      p ? { ...p, tieneVideo: true, vimeo_url: '' } : p,
                    )
                    setAviso(
                      'Video cargado. Revisá y publicá cuando esté listo.',
                    )
                    router.refresh()
                  }}
                /></fieldset>
              ) : (
                <p className="rounded-2xl border border-[#E7DDD5] p-4 text-sm text-[#746A64]">
                  Al guardar el borrador aparecerá aquí el selector de archivo.
                  La clase no se publica hasta que el video esté listo y vos lo confirmes.
                </p>
              )}
            </div>
            {ficha.id ? <ClassMaterialsEditor key={ficha.id} claseId={ficha.id} disabled={guardando || cargando} onBusy={setMaterialOcupado} onDraftChange={setMaterialPendiente} />
              : <section className="mt-5 rounded-2xl border border-[#E7DDD5] p-4"><h3 className="font-impact text-base font-semibold">Materiales de la clase</h3><p className="mt-2 text-sm text-[#746A64]">Después de guardar la ficha podés adjuntar PDF, documentos y enlaces en este mismo editor, sin salir de la clase.</p></section>}
          </div>
        </div>
      )}
    </main>
  )
}
