'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ubicacionClase } from '@/lib/class-management'
import { tiempoClase } from '@/lib/class-progress'
import { esSeguimientoFormacion, type SeguimientoFormacion } from '@/lib/admin-learning-progress'
import { clasePermitida, clasesDeRecorrido, ESTADOS_APRENDIZAJE, filasAprendizaje, filtrarAprendizaje, indiceAprendizaje, resumenAprendizaje, resumenClaseAprendizaje, type FilaAprendizaje } from '@/lib/admin-learning-progress-view'

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const campo = 'mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'
const vacio = 'rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-6 text-sm leading-6 text-[#746A64]'
const tamanoPagina = 24
function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin registro'
}
function tipoNombre(tipo: string | null) { return tipo === 'socia' ? 'Socias Digitales' : tipo === 'desafio' ? 'Desafío Socias' : tipo === 'gratuito' ? 'Gratuito' : 'Tipo por revisar' }
function Progreso({ completadas, total, etiqueta }: { completadas: number; total: number; etiqueta: string }) {
  const porcentaje = total ? Math.round(completadas / total * 100) : 0
  return <div><div role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-valuetext={`${completadas} de ${total} clases completadas`} className="h-1.5 overflow-hidden rounded-full bg-[#E7DDD5]"><div className="h-full rounded-full bg-[#294A38]" style={{ width: `${porcentaje}%` }} /></div><p className="mt-2 text-xs text-[#746A64]">{completadas} de {total} completadas</p></div>
}

export default function AvancesFormacion({ inicial, claseInicial = '' }: { inicial: SeguimientoFormacion; claseInicial?: string }) {
  const [datos, setDatos] = useState(inicial)
  const [programa, setPrograma] = useState('')
  const [claseId, setClaseId] = useState(claseInicial)
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState('')
  const [acceso, setAcceso] = useState('con_acceso')
  const [actividad, setActividad] = useState('')
  const [vista, setVista] = useState<'alumnas' | 'clases'>('alumnas')
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const dialogo = useRef<HTMLDialogElement | null>(null)
  const origenFicha = useRef<HTMLButtonElement | null>(null)
  const peticion = useRef<AbortController | null>(null)
  const enCurso = useRef(false)
  useEffect(() => () => peticion.current?.abort(), [])
  const clases = useMemo(() => datos.estado === 'lista' ? [...datos.clases].sort((a, b) => { const ua = ubicacionClase(a.modulo), ub = ubicacionClase(b.modulo); return ua.programa.localeCompare(ub.programa, 'es') || Number(ua.seccion === 'Material de apoyo') - Number(ub.seccion === 'Material de apoyo') || a.orden - b.orden || a.id.localeCompare(b.id) }) : [], [datos])
  const alumnas = useMemo(() => datos.estado === 'lista' ? [...datos.alumnas].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es') || a.id.localeCompare(b.id)) : [], [datos])
  const indice = useMemo(() => indiceAprendizaje(datos.estado === 'lista' ? datos.progreso : []), [datos])
  const programas = [...new Set(clases.map(c => ubicacionClase(c.modulo).programa))]
  const recorrido = useMemo(() => clasesDeRecorrido(clases, programa, claseId), [clases, programa, claseId])
  const filas = useMemo(() => filasAprendizaje(alumnas, recorrido, indice), [alumnas, recorrido, indice])
  const resumen = resumenAprendizaje(filas)
  const visibles = filtrarAprendizaje(filas, { busqueda, tipo, acceso, actividad })
  const totalVista = vista === 'alumnas' ? visibles.length : recorrido.length
  const paginas = Math.max(1, Math.ceil(totalVista / tamanoPagina))
  const paginaActual = Math.min(pagina, paginas)
  const desde = (paginaActual - 1) * tamanoPagina
  const ficha = filas.find(f => f.alumna.id === seleccionada)
  const hayFiltros = Boolean(programa || claseId || busqueda || tipo || actividad || acceso !== 'con_acceso')
  const claseNoDisponible = Boolean(claseId && !clases.some(c => c.id === claseId))
  function limpiar() { setPrograma(''); setClaseId(''); setBusqueda(''); setTipo(''); setAcceso('con_acceso'); setActividad(''); setPagina(1) }
  function cambiarVista(valor: 'alumnas' | 'clases') { setVista(valor); setPagina(1) }
  function abrirFicha(fila: FilaAprendizaje, origen: HTMLButtonElement) { origenFicha.current = origen; setSeleccionada(fila.alumna.id); dialogo.current?.showModal() }
  async function actualizar() {
    if (enCurso.current) return
    enCurso.current = true; setCargando(true); dialogo.current?.close(); setSeleccionada(null)
    const controller = new AbortController(); peticion.current = controller
    const limite = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch('/api/admin/formacion', { cache: 'no-store', signal: controller.signal })
      const resultado: unknown = await response.json()
      if (!response.ok || !esSeguimientoFormacion(resultado)) throw new Error('read_failed')
      if (!controller.signal.aborted) setDatos(resultado)
    } catch {
      if (peticion.current === controller) setDatos({ estado: 'error', mensaje: 'No pudimos comprobar los avances. Volvé a intentar para ver los datos actualizados.' })
    } finally { window.clearTimeout(limite); if (peticion.current === controller) { peticion.current = null; enCurso.current = false; setCargando(false) } }
  }
  return <main className="mx-auto w-full min-w-0 max-w-[1120px] px-4 py-7 sm:px-8 sm:py-10" aria-busy={cargando}>
    <header className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.22em] text-[#294A38]">Formación y comunidad</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Avances de las alumnas</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#746A64]">Un vistazo a sus clases para saber a quién acompañar y celebrar cada avance.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/classroom" className={boton}>Gestionar clases</Link><button type="button" disabled={cargando} onClick={actualizar} className={boton}>{cargando ? 'Actualizando…' : 'Actualizar'}</button></div></header>
    {cargando && <p role="status" className="mt-4 text-sm text-[#294A38]">Comprobando clases y avances…</p>}
    {datos.estado === 'error' ? <section role="alert" className={`${vacio} mt-7 border-[#EC9BB6]`}><h2 className="font-semibold text-[#211C19]">No pudimos cargar el seguimiento.</h2><p className="mt-2">{datos.mensaje}</p><button type="button" onClick={actualizar} disabled={cargando} className={`${boton} mt-4`}>Reintentar</button></section> : <>
      <section aria-label="Elegir recorrido" className="mt-7 grid gap-4 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5 sm:grid-cols-2">
        <label className="min-w-0 text-xs font-medium">Programa<select value={programa} onChange={e => { setPrograma(e.target.value); setClaseId(''); setPagina(1) }} className={campo}><option value="">Todos los programas</option>{programas.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
        <label className="min-w-0 text-xs font-medium">Clase o material<select value={claseId} onChange={e => { setClaseId(e.target.value); setPagina(1) }} className={campo}><option value="">Todo el recorrido</option>{clases.filter(c => !programa || ubicacionClase(c.modulo).programa === programa).map(c => <option key={c.id} value={c.id}>{c.titulo} · {ubicacionClase(c.modulo).seccion}</option>)}</select></label>
      </section>
      {claseNoDisponible && <p role="alert" className={`${vacio} mt-4`}>La clase de este enlace ya no está disponible. <button className={`${boton} mt-2`} onClick={() => { setClaseId(''); setPagina(1) }}>Ver el recorrido actual</button></p>}
      <section aria-label="Resumen del recorrido elegido" className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[{ titulo: 'Con acceso al recorrido', valor: resumen.conAcceso, tono: 'bg-[#FFFDFA] border-[#E7DDD5]', filtro: '' }, { titulo: 'Registraron actividad', valor: resumen.conActividad, tono: 'bg-[#F4CAD8] border-[#F4CAD8]', filtro: 'en_curso' }, { titulo: 'Completaron el recorrido', valor: resumen.completaron, tono: 'bg-[#EC9BB6] border-[#EC9BB6]', filtro: 'completado' }, { titulo: 'Sin actividad registrada', valor: resumen.sinRegistro, tono: 'bg-[#FAF7F3] border-[#E7DDD5]', filtro: 'sin_registro' }].map(t => <article key={t.titulo} className={`min-w-0 rounded-[22px] border p-4 sm:p-5 ${t.tono}`}><p className="min-h-9 text-xs leading-5 text-[#294A38]">{t.titulo}</p><p className="mt-2 font-impact text-3xl font-semibold text-[#211C19]">{t.valor}</p></article>)}
      </section>
      <p className="mt-3 text-xs leading-5 text-[#746A64]">Resumen del programa o clase elegidos. Solo cuenta clases publicadas con video y acceso actual. No incluye equipo ni cuenta de prueba.</p>
      <div className="mt-7 flex flex-wrap gap-2" aria-label="Vista del seguimiento">{(['alumnas', 'clases'] as const).map(v => <button key={v} type="button" aria-pressed={vista === v} onClick={() => cambiarVista(v)} className={`${boton} ${vista === v ? '!border-[#294A38] !bg-[#294A38] !text-white' : ''}`}>{v === 'alumnas' ? 'Por alumna' : 'Por clase'}</button>)}</div>
      {vista === 'alumnas' && <section aria-label="Filtrar alumnas" className="mt-4 grid gap-4 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-medium">Buscar alumna<input type="search" value={busqueda} maxLength={240} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} placeholder="Nombre" className={campo} /></label>
        <label className="min-w-0 text-xs font-medium">Tipo de cuenta<select value={tipo} onChange={e => { setTipo(e.target.value); setPagina(1) }} className={campo}><option value="">Todas</option><option value="socia">Socias Digitales</option><option value="desafio">Desafío Socias</option><option value="gratuito">Gratuito</option><option value="sin_tipo">Por revisar</option></select></label>
        <label className="min-w-0 text-xs font-medium">Acceso a estas clases<select value={acceso} onChange={e => { setAcceso(e.target.value); setPagina(1) }} className={campo}><option value="con_acceso">Con acceso actual</option><option value="">Todas las cuentas</option><option value="sin_acceso">Sin acceso actual</option></select></label>
        <label className="min-w-0 text-xs font-medium">Avance<select value={actividad} onChange={e => { setActividad(e.target.value); setPagina(1) }} className={campo}><option value="">Todos los avances</option><option value="sin_registro">Sin actividad registrada</option><option value="en_curso">En curso</option><option value="completado">Recorrido completado</option><option value="sin_acceso">Sin acceso actual</option></select></label>
      </section>}
      <div className="my-4 flex min-w-0 flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-[#746A64]">{totalVista} {vista === 'alumnas' ? 'alumnas' : 'clases'} en esta vista{totalVista > tamanoPagina ? ` · ${desde + 1}–${Math.min(desde + tamanoPagina, totalVista)}` : ''}</p>{hayFiltros && <button type="button" className={boton} onClick={limpiar}>Limpiar filtros</button>}</div>
      {!clases.length ? <div className={vacio}><h2 className="font-semibold text-[#211C19]">El seguimiento empieza con la primera clase.</h2><p className="mt-2">Publicá una clase con video para ver cómo avanzan las alumnas.</p><Link href="/admin/classroom" className={`${boton} mt-4`}>Ir a Clases</Link></div> : !totalVista ? <div className={vacio}>No hay resultados para estos filtros.{hayFiltros && <button type="button" onClick={limpiar} className={`${boton} mt-3`}>Ver todas</button>}</div> : vista === 'alumnas' ? <section aria-label="Avance por alumna" className="grid gap-3 lg:grid-cols-2">{visibles.slice(desde, desde + tamanoPagina).map(f => <article key={f.alumna.id} className="flex min-w-0 flex-col rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{f.alumna.nombre || 'Sin nombre'}</h2><p className="mt-1 text-xs text-[#746A64]">{tipoNombre(f.alumna.tipo_usuario)} · {f.alumna.estado === 'activa' ? 'Activa' : f.alumna.estado === 'pausada' ? 'Pausada' : f.alumna.estado === 'cancelada' ? 'Cancelada' : 'Estado por revisar'}</p></div><span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${f.estado === 'completado' ? 'bg-[#294A38]' : 'bg-[#EC9BB6]'}`} /></div><p className="mb-4 mt-4 text-xs font-medium text-[#294A38]">{ESTADOS_APRENDIZAJE[f.estado]}</p>{f.disponibles ? <Progreso completadas={f.completadas} total={f.disponibles} etiqueta={`Clases completadas de ${f.alumna.nombre || 'alumna sin nombre'}`} /> : <p className="text-xs text-[#746A64]">Los permisos actuales no habilitan este recorrido.</p>}<div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5"><p className="text-xs leading-5 text-[#746A64]">Último avance<br /><span className="text-[#211C19]">{fecha(f.ultima)}</span></p><button type="button" className={boton} onClick={e => abrirFicha(f, e.currentTarget)}>Ver avance<span className="sr-only"> de {f.alumna.nombre || 'alumna sin nombre'}</span></button></div></article>)}</section> : <section aria-label="Avance por clase" className="grid gap-3 lg:grid-cols-2">{recorrido.slice(desde, desde + tamanoPagina).map(c => { const r = resumenClaseAprendizaje(c, alumnas, indice); return <article key={c.id} className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5"><p className="text-xs leading-5 text-[#746A64]">{ubicacionClase(c.modulo).programa} · {ubicacionClase(c.modulo).seccion}</p><h2 className="mt-2 break-words text-base font-semibold">{c.titulo}</h2><dl className="my-5 grid grid-cols-3 gap-3 text-xs"><div><dt className="text-[#746A64]">Con acceso</dt><dd className="mt-1 font-impact text-2xl font-semibold">{r.conAcceso}</dd></div><div><dt className="text-[#746A64]">Con actividad</dt><dd className="mt-1 font-impact text-2xl font-semibold">{r.conActividad}</dd></div><div><dt className="text-[#746A64]">Completaron</dt><dd className="mt-1 font-impact text-2xl font-semibold text-[#294A38]">{r.completaron}</dd></div></dl><p className="text-xs text-[#746A64]">{r.porcentaje === null ? 'Sin alumnas con acceso actual' : `${r.porcentaje}% de las alumnas con acceso la completaron`}</p><button type="button" onClick={() => { setClaseId(c.id); setBusqueda(''); setTipo(''); setActividad(''); setAcceso('con_acceso'); cambiarVista('alumnas') }} className={`${boton} mt-5`}>Ver alumnas de esta clase</button></article> })}</section>}
      {paginas > 1 && <nav aria-label="Páginas del seguimiento" className="mt-5 flex flex-wrap items-center justify-center gap-3"><button type="button" className={boton} disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button><p className="text-xs">{paginaActual} de {paginas}</p><button type="button" className={boton} disabled={paginaActual >= paginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button></nav>}
      <aside className="mt-7 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5 text-xs leading-5 text-[#746A64]"><p>Los avances se registran desde que se habilitó el seguimiento. “Completada” es una marca de la alumna, no una certificación. Sin actividad registrada no significa que nunca haya visto la clase. Si se reemplaza un video, su avance anterior no se atribuye al nuevo.</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2"><Link href="/admin/alumnas" className="inline-flex min-h-11 items-center font-medium text-[#294A38] underline underline-offset-4">Todas las alumnas y accesos</Link><Link href="/admin/comunidad" className="inline-flex min-h-11 items-center font-medium text-[#294A38] underline underline-offset-4">Ir a Comunidad</Link><Link href="/admin/lanzamiento/historico" className="inline-flex min-h-11 items-center text-[#746A64] underline underline-offset-4">Datos comerciales anteriores</Link></div></aside>
    </>}
    <dialog ref={dialogo} aria-labelledby="avance-ficha-titulo" onClose={() => { setSeleccionada(null); origenFicha.current?.focus() }} className="m-auto max-h-[calc(100dvh-24px)] w-[calc(100%_-_24px)] max-w-[680px] overflow-y-auto rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-[#211C19] backdrop:bg-black/40 sm:p-7">
      <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.18em] text-[#294A38]">Su recorrido</p><h2 id="avance-ficha-titulo" className="mt-2 break-words text-xl font-semibold">{ficha?.alumna.nombre || 'Avance de la alumna'}</h2></div><button type="button" className={boton} onClick={() => dialogo.current?.close()}>Cerrar</button></div>
      {ficha && <><p className="mt-3 text-xs leading-5 text-[#746A64]">{tipoNombre(ficha.alumna.tipo_usuario)} · {ESTADOS_APRENDIZAJE[ficha.estado]}</p><p className="mt-3 text-xs text-[#746A64]">Solo las clases del recorrido elegido con acceso actual.</p><ul className="mt-5 space-y-3">{recorrido.filter(c => clasePermitida(ficha.alumna, c)).map(c => { const p = indice.get(ficha.alumna.id)?.get(c.id); return <li key={c.id} className="min-w-0 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><p className="text-[11px] leading-5 text-[#746A64]">{ubicacionClase(c.modulo).programa} · {ubicacionClase(c.modulo).seccion}</p><h3 className="mt-1 break-words text-sm font-semibold">{c.titulo}</h3><p className="mt-3 text-xs font-medium text-[#294A38]">{p?.completada ? 'Completada por la alumna' : p ? 'En curso' : 'Sin actividad registrada'}</p>{p && <p className="mt-2 text-xs leading-5 text-[#746A64]">{p.duracion_seg > 0 ? `Última posición: ${tiempoClase(p.posicion_seg)} de ${tiempoClase(p.duracion_seg)}. ` : ''}Último avance: {fecha(p.actualizado_en)}.</p>}</li> })}</ul>{!ficha.disponibles && <p className={`${vacio} mt-4`}>Esta cuenta no tiene acceso actual a las clases elegidas. Revisá sus permisos desde Todas las alumnas.</p>}<Link href="/admin/alumnas" className={`${boton} mt-5`}>Ver alumnas y accesos</Link></>}
    </dialog>
  </main>
}
