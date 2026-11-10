'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import ArrowIcon from '@/components/ArrowIcon'
import AffiliateFileUpload from './AffiliateFileUpload'
import { analizarArchivoAfiliadasUrl } from '@/lib/affiliate-files'
import { agruparCampanasAfiliadas, claveCampanaAfiliada, nombreCampanaAfiliada, opcionesCampanasAfiliadas } from '@/lib/affiliate-campaigns'
import { esCatalogoAfiliadas, esIdAfiliadas, esRecursoAfiliada, ESTADOS_RECURSO_AFILIADA, fechaRecursoAfiliada, filtrarRecursosAfiliadas, recursoCoincideAfiliada, TIPOS_RECURSO_AFILIADA, validarDatosRecursoAfiliada, type CatalogoAfiliadas, type DatosRecursoAfiliada, type RecursoAfiliada } from '@/lib/affiliate-hub'

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const primario = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#294A38] bg-[#294A38] px-4 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const campo = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19] disabled:opacity-60'
type Formulario = Omit<DatosRecursoAfiliada, 'url' | 'campana' | 'producto_id'> & { url: string; campana: string; producto_id: string }
type Intento = { id: string; version?: number; datos: DatosRecursoAfiliada }
const vacio = (productoId = ''): Formulario => ({ titulo: '', cuerpo: '', tipo: 'aviso', campana: '', url: '', estado: 'borrador', destacado: false, producto_id: productoId })
const formulario = (r: RecursoAfiliada): Formulario => ({ titulo: r.titulo, cuerpo: r.cuerpo, tipo: r.tipo, campana: r.campana ?? '', url: r.url ?? '', estado: r.estado, destacado: r.destacado, producto_id: r.producto_id ?? '' })

export default function AfiliadasAdmin({ inicial, productos = [], errorProductos = false, productoInicial }: { inicial: CatalogoAfiliadas; productos?: readonly { id: string; nombre: string }[]; errorProductos?: boolean; productoInicial?: string }) {
  const [catalogo, setCatalogo] = useState(inicial), [busqueda, setBusqueda] = useState(''), [tipo, setTipo] = useState('todos'), [campana, setCampana] = useState('todas'), [estado, setEstado] = useState('todos')
  const [productoFiltro, setProductoFiltro] = useState(esIdAfiliadas(productoInicial) ? productoInicial : 'todos')
  const [cargando, setCargando] = useState(false), [error, setError] = useState(''), [mensaje, setMensaje] = useState('')
  const [editor, setEditor] = useState<RecursoAfiliada | 'nuevo' | null>(null), [form, setForm] = useState<Formulario>(() => vacio()), [base, setBase] = useState('')
  const [guardando, setGuardando] = useState(false), [errorEditor, setErrorEditor] = useState(''), [congelado, setCongelado] = useState(false)
  const [recursoId, setRecursoId] = useState(''), [fuente, setFuente] = useState<'archivo' | 'enlace'>('archivo'), [subiendo, setSubiendo] = useState(false), [archivoPendiente, setArchivoPendiente] = useState(false), [confirmarCierre, setConfirmarCierre] = useState(false)
  const dialogo = useRef<HTMLDialogElement>(null), intento = useRef<Intento | null>(null), guardandoRef = useRef(false), subiendoRef = useRef(false), archivoPendienteRef = useRef(false), urlsFuentes = useRef({ archivo: '', enlace: '' })
  const recursos = useMemo(() => catalogo.estado === 'lista' ? catalogo.recursos : [], [catalogo])
  const visibles = useMemo(() => filtrarRecursosAfiliadas(recursos, { busqueda, tipo, campana: 'todas', estado }).filter(r => (campana === 'todas' || claveCampanaAfiliada(r.campana) === campana) && (productoFiltro === 'todos' || (productoFiltro === 'general' ? !r.producto_id : r.producto_id === productoFiltro))), [recursos, busqueda, tipo, campana, estado, productoFiltro])
  const grupos = useMemo(() => agruparCampanasAfiliadas(visibles), [visibles])
  const campanas = useMemo(() => opcionesCampanasAfiliadas(recursos), [recursos])
  const esMultimedia = form.tipo === 'video' || form.tipo === 'archivo'
  const sucio = Boolean(editor && JSON.stringify(form) !== base)
  useEffect(() => {
    if (!editor || !sucio && !congelado && !subiendo && !archivoPendiente) return
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [editor, sucio, congelado, subiendo, archivoPendiente])
  function abrir(recurso?: RecursoAfiliada) {
    if (guardandoRef.current || editor) return
    const f = recurso ? formulario(recurso) : vacio(esIdAfiliadas(productoFiltro) ? productoFiltro : '')
    const interno = Boolean(analizarArchivoAfiliadasUrl(f.url)); urlsFuentes.current = { archivo: interno ? f.url : '', enlace: interno ? '' : f.url }
    setRecursoId(recurso?.id ?? crypto.randomUUID()); setFuente(recurso?.url && !analizarArchivoAfiliadasUrl(recurso.url) ? 'enlace' : 'archivo'); setSubiendo(false); subiendoRef.current = false; setArchivoPendiente(false); archivoPendienteRef.current = false; setConfirmarCierre(false)
    intento.current = null; setMensaje(''); setError(''); setErrorEditor(''); setCongelado(false); setForm(f); setBase(JSON.stringify(f)); setEditor(recurso ?? 'nuevo')
    dialogo.current?.showModal()
  }
  function descartar() {
    if (guardandoRef.current || subiendoRef.current) return
    dialogo.current?.close(); setEditor(null); intento.current = null; setErrorEditor(''); setCongelado(false); setConfirmarCierre(false); setArchivoPendiente(false); archivoPendienteRef.current = false
  }
  function cerrar() {
    if (guardandoRef.current || subiendoRef.current) return
    if (sucio || congelado || archivoPendienteRef.current) { setConfirmarCierre(true); return }
    descartar()
  }
  function cambiarFuente(siguiente: 'archivo' | 'enlace') {
    if (siguiente === fuente || subiendoRef.current || guardandoRef.current || congelado) return
    urlsFuentes.current[fuente] = form.url
    setArchivoPendiente(false); archivoPendienteRef.current = false; setFuente(siguiente); setForm(f => ({ ...f, url: urlsFuentes.current[siguiente] }))
  }
  async function actualizar() {
    if (cargando || editor) return
    setCargando(true); setError(''); setMensaje('')
    try { const response = await fetch('/api/admin/afiliadas', { cache: 'no-store' }), data: unknown = await response.json(); if (!response.ok || !esCatalogoAfiliadas(data, true)) throw new Error(); setCatalogo(data) }
    catch { setError('No pudimos actualizar el catálogo. Reintentá antes de editar o publicar.'); setCatalogo({ estado: 'error', mensaje: 'No pudimos comprobar los recursos de Afiliadas.' }) }
    finally { setCargando(false) }
  }
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guardandoRef.current || subiendoRef.current || !editor) return
    setErrorEditor('')
    if (archivoPendienteRef.current) { setErrorEditor('Terminá de subir el archivo o cancelá el reemplazo antes de guardar.'); return }
    if (!intento.current) {
      try {
        if (esMultimedia && fuente === 'archivo' && analizarArchivoAfiliadasUrl(form.url)?.recursoId !== recursoId) throw new Error('Subí el archivo y esperá la confirmación antes de guardar. También podés elegir Usar enlace.')
        if (form.producto_id && (errorProductos || !productos.some(p => p.id === form.producto_id)) && (editor === 'nuevo' || (editor.producto_id ?? '') !== form.producto_id)) throw new Error('Actualizá los productos antes de asociar este material.')
        const campanaElegida = campanas.find(c => c.clave === claveCampanaAfiliada(form.campana))?.nombre ?? nombreCampanaAfiliada(form.campana)
        intento.current = { id: recursoId, ...(editor === 'nuevo' ? {} : { version: editor.version }), datos: validarDatosRecursoAfiliada({ ...form, producto_id: form.producto_id || null, campana: form.campana ? campanaElegida : null, url: form.url || null }) }
      }
      catch (cause) { setErrorEditor(cause instanceof Error ? cause.message : 'Revisá el recurso.'); return }
    }
    const envio = intento.current
    guardandoRef.current = true; setGuardando(true); setCongelado(true)
    const controlador = new AbortController(), timer = setTimeout(() => controlador.abort(), 12000)
    try {
      const editar = envio.version !== undefined
      const response = await fetch(editar ? `/api/admin/afiliadas/${envio.id}` : '/api/admin/afiliadas', { method: editar ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editar ? { version: envio.version, recurso: envio.datos } : { id: envio.id, recurso: envio.datos }), signal: controlador.signal })
      const data: unknown = await response.json()
      if (!response.ok) {
        const detalle = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error.slice(0, 350) : 'No pudimos confirmar el guardado.'
        if (response.status === 400 || response.status === 413 || response.status === 415) { intento.current = null; setCongelado(false) }
        throw new Error(detalle)
      }
      const row = data && typeof data === 'object' && 'recurso' in data ? data.recurso : null
      if (!esRecursoAfiliada(row) || row.id !== envio.id || row.version !== (envio.version ?? 0) + 1 || !recursoCoincideAfiliada(row, envio.datos)) throw new Error('La respuesta no confirma este recurso. Reintentá el mismo guardado.')
      setCatalogo(previo => {
        const anteriores = previo.estado === 'lista' ? previo.recursos : []
        const siguiente = [row, ...anteriores.filter(r => r.id !== row.id)]
        return { estado: 'lista', recursos: siguiente.slice(0, 200), limitado: siguiente.length > 200 || previo.estado === 'lista' && previo.limitado }
      })
      setMensaje(row.estado === 'publicado' ? 'Recurso publicado en el espacio de Afiliadas. No se enviaron emails ni push.' : row.estado === 'archivado' ? 'Recurso archivado: ya no aparece para las Afiliadas. Podés volver a publicarlo al editar.' : 'Borrador guardado. Todavía no es visible para las Afiliadas.')
      dialogo.current?.close(); setEditor(null); intento.current = null; setCongelado(false); setErrorEditor('')
    } catch (cause) { setErrorEditor(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'El guardado no se confirmó. Reintentá el mismo envío; no crees un segundo recurso.') }
    finally { clearTimeout(timer); guardandoRef.current = false; setGuardando(false) }
  }
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211C19]" data-platform-role="admin">
    <header data-admin-section-header="true" className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-3 sm:px-8"><Link href="/admin" aria-label="Socias Digitales, Panel de Flor"><Image src="/academy-horizontal-color.png" alt="Socias Digitales Academy" width={3922} height={1366} className="h-10 w-auto max-w-[160px] object-contain" /></Link><Link href="/admin" className={boton}>Panel de Flor<ArrowIcon /></Link></header>
    <AdminSectionMenu />
    <main className="mx-auto min-w-0 max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Ecosistema comercial</p><h1 className="mt-2 text-4xl sm:text-5xl">Afiliadas</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Organizá los copys, videos y archivos que tus Afiliadas van a usar para vender.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/afiliadas/productos" prefetch={false} className={boton}>Productos<ArrowIcon /></Link><Link href="/admin/afiliadas/accesos" className={boton}>Gestionar accesos<ArrowIcon /></Link><button type="button" disabled={cargando || Boolean(editor)} onClick={() => void actualizar()} className={boton}>{cargando ? 'Actualizando…' : 'Actualizar'}</button><button type="button" disabled={catalogo.estado !== 'lista' || Boolean(editor)} onClick={() => abrir()} className={primario}>Crear recurso +</button></div></div>
      <p className="mt-4 text-xs leading-5 text-[#746A64]">Solo lo publicado aparece en el espacio de Afiliadas habilitadas. Archivar retira el recurso sin borrarlo. Publicar acá no envía email ni push.</p>
      <p role="status" aria-live="polite" className="mt-4 break-words text-sm font-semibold text-[#294A38]">{mensaje}</p>
      {errorProductos && <p role="alert" className="mt-4 rounded-2xl border border-[#EC9BB6] bg-[#FAF7F3] p-4 text-sm leading-6">No pudimos cargar los productos. Las asociaciones guardadas se conservan.</p>}
      {error && <p role="alert" className="mt-4 rounded-2xl border border-[#B01B30] bg-[#FFFDFA] p-4 text-sm leading-6">{error}</p>}
      {catalogo.estado === 'error' ? <section className="mt-5 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h2 className="text-xl font-semibold">El catálogo no está disponible</h2><p role="alert" className="mt-3 text-sm leading-6 text-[#746A64]">{catalogo.mensaje}</p><button type="button" onClick={() => void actualizar()} disabled={cargando} className={`${boton} mt-4`}>Reintentar</button></section> : <>
        <section aria-label="Filtrar recursos de Afiliadas" className="mt-5 grid min-w-0 gap-4 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="min-w-0 text-xs font-medium">Buscar<input type="search" maxLength={200} value={busqueda} onChange={e => setBusqueda(e.target.value)} className={campo} /></label><label className="min-w-0 text-xs font-medium">Tipo<select value={tipo} onChange={e => setTipo(e.target.value)} className={campo}><option value="todos">Todos los materiales</option>{TIPOS_RECURSO_AFILIADA.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label><label className="min-w-0 text-xs font-medium">Campaña<select value={campana} onChange={e => setCampana(e.target.value)} className={campo}><option value="todas">Todas las campañas</option>{campanas.map(c => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}</select></label><label className="min-w-0 text-xs font-medium">Producto<select value={productoFiltro} onChange={e => setProductoFiltro(e.target.value)} className={campo}><option value="todos">Todos los productos</option><option value="general">Recursos generales</option>{esIdAfiliadas(productoFiltro) && !productos.some(p => p.id === productoFiltro) && <option value={productoFiltro}>Producto seleccionado</option>}{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label className="min-w-0 text-xs font-medium">Estado<select value={estado} onChange={e => setEstado(e.target.value)} className={campo}><option value="todos">Todos los estados</option>{ESTADOS_RECURSO_AFILIADA.map(e => <option key={e} value={e}>{e === 'publicado' ? 'Publicado' : e === 'archivado' ? 'Archivado' : 'Borrador'}</option>)}</select></label></section>
        {catalogo.limitado && <p className="mt-3 text-xs leading-5 text-[#746A64]">Se muestran los primeros 200 recursos, con destacados primero; los filtros se aplican a esta lista.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-[#746A64]">{visibles.length} recursos en esta vista</p>{(busqueda || tipo !== 'todos' || campana !== 'todas' || estado !== 'todos' || productoFiltro !== 'todos') && <button type="button" className={boton} onClick={() => { setBusqueda(''); setTipo('todos'); setCampana('todas'); setEstado('todos'); setProductoFiltro('todos') }}>Limpiar filtros</button>}</div>
        <section aria-label="Catálogo de Afiliadas" className="mt-4 space-y-4">{grupos.map(grupo => <details key={grupo.clave} open className="min-w-0 rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:p-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]"><span className="min-w-0"><span className="block break-words text-lg font-semibold">{grupo.nombre}</span><span className="mt-1 block text-xs text-[#746A64]">{grupo.recursos.length} {grupo.recursos.length === 1 ? 'recurso' : 'recursos'} · {grupo.tipos.map(t => t.nombre).join(' · ')}</span></span><span className="shrink-0 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] p-3" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span></summary><div className="mt-4 space-y-3">{grupo.recursos.map(r => <article key={r.id} className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#294A38]"><span>{r.estado === 'publicado' ? 'Publicado' : r.estado === 'archivado' ? 'Archivado' : 'Borrador'}</span>{r.destacado && <span>· Destacado</span>}<span>· {TIPOS_RECURSO_AFILIADA.find(t => t.id === r.tipo)?.nombre}</span></div><h3 className="mt-3 break-words text-lg font-semibold">{r.titulo}</h3></div><button type="button" onClick={() => abrir(r)} className={boton} aria-label={`Editar ${r.titulo}`}>Editar</button></div><p className="mt-2 break-words text-xs font-medium text-[#294A38]">{r.producto_id ? productos.find(p => p.id === r.producto_id)?.nombre ?? 'Producto' : 'Recursos generales'}</p>{r.cuerpo && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#746A64]">{r.cuerpo.length > 240 ? r.cuerpo.slice(0, 240) + '…' : r.cuerpo}</p>}{r.url && <a href={analizarArchivoAfiliadasUrl(r.url)?.recursoId === r.id ? new URL(r.url).pathname : r.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={`${boton} mt-3`}>{analizarArchivoAfiliadasUrl(r.url)?.recursoId === r.id ? 'Revisar archivo cargado' : 'Revisar enlace'}<ArrowIcon diagonal /></a>}<p className="mt-3 text-xs text-[#746A64]">Actualizado {fechaRecursoAfiliada(r.actualizado_en)} · Versión {r.version}</p></article>)}</div></details>)}{!visibles.length && <article className="rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h2 className="text-xl font-semibold">{recursos.length ? 'Sin coincidencias' : 'El primer recurso empieza acá.'}</h2><p className="mt-3 text-sm leading-6 text-[#746A64]">{recursos.length ? 'Probá otros filtros para encontrar el material.' : 'Creá una campaña o tema al guardar tu primer recurso. Podés preparar copys, subir videos y compartir archivos.'}</p></article>}</section>
      </>}
    </main>
    <dialog ref={dialogo} aria-labelledby="editar-recurso-afiliadas" onCancel={event => { event.preventDefault(); cerrar() }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_1.5rem)] max-w-2xl overflow-y-auto rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-[#211C19] backdrop:bg-[#211C19]/60 sm:p-7" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FFFDFA] pb-3"><h2 id="editar-recurso-afiliadas" className="text-xl font-semibold">{editor === 'nuevo' ? 'Crear recurso' : 'Editar recurso'}</h2><button type="button" autoFocus disabled={guardando || subiendo} className={boton} onClick={cerrar}>Cerrar</button></div>
      {confirmarCierre && <div role="alert" className="mt-4 rounded-2xl border border-[#EC9BB6] bg-[#F4CAD8] p-4"><p className="text-sm leading-6">{congelado ? 'El guardado todavía no se confirmó. Si cerrás, revisá el catálogo antes de volver a crear este recurso.' : 'Tenés cambios sin guardar. Si cerrás, no se publicarán.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={guardando || subiendo} onClick={descartar} className={boton}>Descartar cambios y cerrar</button><button type="button" disabled={guardando || subiendo} onClick={() => setConfirmarCierre(false)} className={boton}>Seguir editando</button></div></div>}
      {editor && <form onSubmit={guardar} className="mt-5 space-y-4">
        <fieldset disabled={congelado || guardando} className="min-w-0 space-y-4"><legend className="sr-only">Información del recurso</legend><label className="block min-w-0 text-sm font-medium">Producto<select value={form.producto_id} disabled={errorProductos} onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))} className={campo}><option value="">Recursos generales</option>{form.producto_id && !productos.some(p => p.id === form.producto_id) && <option value={form.producto_id}>Producto asociado</option>}{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label className="block min-w-0 text-sm font-medium">Título<input value={form.titulo} maxLength={140} required onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={campo} /></label><div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-medium">Tipo de recurso<select value={form.tipo} disabled={subiendo} onChange={e => { urlsFuentes.current = { archivo: '', enlace: '' }; setFuente('archivo'); setArchivoPendiente(false); archivoPendienteRef.current = false; setForm(f => ({ ...f, tipo: e.target.value as Formulario['tipo'], url: '' })) }} className={campo}>{TIPOS_RECURSO_AFILIADA.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label><label className="min-w-0 text-sm font-medium">Campaña o tema<input list="campanas-afiliadas-editor" value={form.campana} maxLength={120} onChange={e => setForm(f => ({ ...f, campana: e.target.value }))} className={campo} placeholder="Elegí una campaña o escribí una nueva" /><datalist id="campanas-afiliadas-editor">{campanas.map(c => <option key={c.clave} value={c.nombre} />)}</datalist><span className="mt-2 block text-xs font-normal leading-5 text-[#746A64]">Agrupá lo que pertenece a una misma campaña, lanzamiento o tema.</span></label></div><label className="block min-w-0 text-sm font-medium">{form.tipo === 'copy' ? 'Copy para copiar y adaptar' : 'Mensaje o descripción'}<textarea value={form.cuerpo} maxLength={12000} rows={7} required={form.tipo === 'aviso' || form.tipo === 'copy'} onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))} className={campo} /><span className="mt-1 block text-xs font-normal text-[#746A64]">{form.cuerpo.length.toLocaleString('es-AR')} / 12.000 · Texto plano; no se interpreta HTML.</span></label>{esMultimedia && <div className="space-y-3"><p className="text-sm font-semibold">{form.tipo === 'video' ? 'Video para compartir' : 'Archivo para compartir'}</p><div className="flex flex-wrap gap-2" aria-label="Origen del material"><button type="button" disabled={subiendo} aria-pressed={fuente === 'archivo'} onClick={() => cambiarFuente('archivo')} className={`${boton} ${fuente === 'archivo' ? 'border-[#EC9BB6] bg-[#F4CAD8]' : ''}`}>Desde mi dispositivo</button><button type="button" disabled={subiendo} aria-pressed={fuente === 'enlace'} onClick={() => cambiarFuente('enlace')} className={`${boton} ${fuente === 'enlace' ? 'border-[#EC9BB6] bg-[#F4CAD8]' : ''}`}>Usar enlace</button></div>{fuente === 'archivo' && <AffiliateFileUpload key={`${recursoId}:${form.tipo}`} recursoId={recursoId} tipo={form.tipo as 'video' | 'archivo'} actualUrl={form.url} disabled={congelado || guardando} onPending={pending => { archivoPendienteRef.current = pending; setArchivoPendiente(pending) }} onBusy={busy => { subiendoRef.current = busy; setSubiendo(busy) }} onUploaded={archivo => { setForm(f => ({ ...f, url: archivo.url, titulo: f.titulo || archivo.nombre.replace(/\.[^.]+$/, '').slice(0, 140) })); setErrorEditor('') }} />}</div>}
        {(!esMultimedia || fuente === 'enlace') && <label className="block min-w-0 text-sm font-medium">Enlace {['aviso', 'copy'].includes(form.tipo) ? '(opcional)' : 'del recurso'}<input type="url" value={form.url} maxLength={2000} required={['video', 'archivo', 'enlace'].includes(form.tipo)} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className={campo} placeholder="https://…" /><span className="mt-2 block text-xs font-normal leading-5 text-[#746A64]">Para Drive, Canva u otro sitio, pegá el enlace y revisá que tus Afiliadas tengan permiso para abrirlo.</span></label>}<div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-medium">Estado<select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as Formulario['estado'] }))} className={campo}><option value="borrador">Borrador · solo equipo</option><option value="publicado">Publicado · visible para Afiliadas</option><option value="archivado">Archivado · retirado sin borrar</option></select></label><label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.destacado} onChange={e => setForm(f => ({ ...f, destacado: e.target.checked }))} className="h-5 w-5" />Destacar al comienzo</label></div></fieldset>
        {errorEditor && <p role="alert" className="break-words rounded-xl border border-[#B01B30] bg-[#FAF7F3] p-4 text-sm leading-6">{errorEditor}</p>}
        {congelado && !guardando && <p className="text-xs leading-5 text-[#746A64]">Conservamos exactamente el mismo envío para no duplicarlo. Si hubo un conflicto de versión, cerrá y actualizá el catálogo antes de editar de nuevo.</p>}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7DDD5] bg-[#FFFDFA] pt-4"><p className="max-w-sm text-xs leading-5 text-[#746A64]">Guardar no envía comunicaciones. Las Afiliadas solo ven los recursos publicados.</p><button type="submit" disabled={guardando || subiendo} aria-busy={guardando || subiendo} className={primario}>{subiendo ? 'Esperando la carga…' : guardando ? 'Guardando…' : congelado ? 'Reintentar mismo guardado' : form.estado === 'publicado' ? 'Guardar y publicar' : form.estado === 'archivado' ? 'Guardar archivado' : 'Guardar borrador'}</button></div>
      </form>}
    </dialog>
  </div>
}
