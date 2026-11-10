'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ArrowIcon from '@/components/ArrowIcon'
import NavigationIcon from '@/components/NavigationIcon'
import { esCatalogoAfiliadas, fechaRecursoAfiliada, filtrarRecursosAfiliadas, TIPOS_RECURSO_AFILIADA, type CatalogoAfiliadas, type RecursoAfiliada } from '@/lib/affiliate-hub'
import { agruparCampanasAfiliadas, claveCampanaAfiliada, opcionesCampanasAfiliadas, separarAvisosDestacadosAfiliadas } from '@/lib/affiliate-campaigns'
import { analizarArchivoAfiliadasUrl } from '@/lib/affiliate-files'

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const campo = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'
const superficiesRecurso = {
  aviso: 'border-[#EC9BB6] bg-[#FAF7F3]',
  copy: 'border-[#EC9BB6] bg-[#F4CAD8]',
  video: 'border-[#E7DDD5] bg-[#FFFDFA]',
  archivo: 'border-[#EC9BB6] bg-[#F4EFEA]',
  enlace: 'border-[#E7DDD5] bg-[#FFFDFA]',
}
interface ResultadoCopia { recursoId: string; estado: 'copiado' | 'error'; mensaje: string }
function TarjetaRecurso({ recurso, alCopiar, copiando = false, resultadoCopia }: { recurso: RecursoAfiliada; alCopiar: (recurso: RecursoAfiliada) => Promise<void>; copiando?: boolean; resultadoCopia?: ResultadoCopia }) {
  const [abierto, setAbierto] = useState(false)
  const largo = recurso.cuerpo.length > 650
  const tipo = TIPOS_RECURSO_AFILIADA.find(t => t.id === recurso.tipo)!
  const avisoDestacado = recurso.tipo === 'aviso' && recurso.destacado
  const secundario = avisoDestacado || recurso.tipo === 'copy' ? 'text-[#294A38]' : 'text-[#746A64]'
  const referencia = analizarArchivoAfiliadasUrl(recurso.url)
  const propio = referencia?.recursoId === recurso.id
  const referenciaAjena = Boolean(referencia && !propio)
  const href = recurso.url && !referenciaAjena ? propio ? new URL(recurso.url).pathname : recurso.url : null
  return <article className={`min-w-0 rounded-[24px] border p-5 sm:p-6 ${avisoDestacado ? 'border-[#EC9BB6] bg-[#EC9BB6]' : superficiesRecurso[recurso.tipo]}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#294A38]">{recurso.destacado && <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[#294A38]/20 px-2">Destacado</span>}<span>{tipo.nombre}</span><time dateTime={recurso.actualizado_en} className={`font-normal tracking-normal ${secundario}`}>{fechaRecursoAfiliada(recurso.actualizado_en)}</time></div>
    <h3 className="mt-3 break-words text-xl font-semibold">{recurso.titulo}</h3>
    {recurso.campana && <p className={`mt-2 break-words text-xs font-medium ${secundario}`}>{recurso.campana}</p>}
    {recurso.cuerpo && <p className={`mt-4 whitespace-pre-wrap break-words text-sm leading-6 ${recurso.tipo === 'copy' ? 'rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4' : ''}`}>{largo && !abierto ? recurso.cuerpo.slice(0, 650) + '…' : recurso.cuerpo}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {largo && <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className={boton}>{abierto ? 'Mostrar menos' : 'Ver texto completo'}</button>}
      {recurso.tipo === 'copy' && <button type="button" disabled={copiando} aria-busy={copiando} onClick={() => void alCopiar(recurso)} className={`${boton} border-[#294A38]`}>{copiando ? 'Copiando…' : resultadoCopia?.estado === 'copiado' ? 'Copiado' : 'Copiar texto completo'}</button>}
      {href && <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={`${boton} border-[#294A38]`}>{propio ? recurso.tipo === 'video' ? 'Descargar video' : 'Descargar archivo' : recurso.tipo === 'video' ? 'Abrir video' : recurso.tipo === 'archivo' ? 'Abrir archivo' : 'Abrir enlace'}<ArrowIcon diagonal /><span className="sr-only">: {recurso.titulo} (se abre en otra pestaña)</span></a>}
    </div>
    {recurso.tipo === 'copy' && <p data-copy-feedback={recurso.id} role="status" aria-live="polite" aria-atomic="true" className={resultadoCopia ? `mt-3 break-words text-sm leading-6 ${resultadoCopia.estado === 'error' ? 'text-[#B01B30]' : 'font-medium text-[#294A38]'}` : 'sr-only'}>{resultadoCopia?.mensaje ?? ''}</p>}
    {propio && <p className="mt-3 text-xs leading-5 text-[#746A64]">{recurso.tipo === 'video' ? 'Guardalo en tu dispositivo para usarlo en tus contenidos.' : 'Material compartido por Flor para descargar y usar.'}</p>}
    {recurso.url && !referencia && <p className={`mt-3 break-all text-xs leading-5 ${secundario}`}>Destino externo: {new URL(recurso.url).hostname}. El acceso depende de los permisos de ese sitio.</p>}
    {referenciaAjena && <p role="alert" className={`mt-3 text-xs leading-5 ${secundario}`}>El archivo necesita una revisión del equipo. Probá actualizar los recursos.</p>}
  </article>
}
export default function AfiliadasCliente({ inicial, avisoDescarga }: { inicial: CatalogoAfiliadas; avisoDescarga?: 'reintentar' | 'no-disponible' }) {
  const [catalogo, setCatalogo] = useState(inicial), [busqueda, setBusqueda] = useState(''), [tipo, setTipo] = useState('todos'), [campana, setCampana] = useState('todas')
  const [cargando, setCargando] = useState(false), [error, setError] = useState(''), [resultadoCopia, setResultadoCopia] = useState<ResultadoCopia | null>(null)
  const [copiando, setCopiando] = useState<string | null>(null)
  const intentoCopia = useRef(0)
  const recursos = catalogo.estado === 'lista' ? catalogo.recursos : []
  const campanas = opcionesCampanasAfiliadas(recursos)
  const visibles = filtrarRecursosAfiliadas(recursos, { busqueda, tipo, campana: 'todas' }).filter(r => campana === 'todas' || claveCampanaAfiliada(r.campana) === campana)
  const separados = separarAvisosDestacadosAfiliadas(visibles), grupos = agruparCampanasAfiliadas(separados.recursos)
  const hayFiltros = Boolean(busqueda || tipo !== 'todos' || campana !== 'todas')
  const mensajeDescarga = avisoDescarga === 'reintentar' ? 'No pudimos preparar la descarga. Actualizá los recursos y volvé a intentarlo.' : avisoDescarga === 'no-disponible' ? 'Este archivo ya no está disponible. Actualizá los recursos para ver el material vigente.' : null
  async function actualizar() {
    if (cargando) return
    intentoCopia.current++; setResultadoCopia(null); setCopiando(null)
    setCargando(true); setError('')
    try { const response = await fetch('/api/afiliadas', { cache: 'no-store' }), data: unknown = await response.json(); if (!response.ok || !esCatalogoAfiliadas(data)) throw new Error(); setCatalogo(data) }
    catch { setError('No pudimos actualizar los recursos. La lista anterior puede haber cambiado; reintentá antes de usarla.'); setCatalogo({ estado: 'error', mensaje: 'No pudimos comprobar los recursos publicados.' }) }
    finally { setCargando(false) }
  }
  async function copiar(recurso: RecursoAfiliada) {
    const intento = ++intentoCopia.current
    setResultadoCopia(null); setCopiando(recurso.id)
    try {
      if (!navigator.clipboard?.writeText) throw new Error()
      await navigator.clipboard.writeText(recurso.cuerpo)
      if (intento === intentoCopia.current) setResultadoCopia({ recursoId: recurso.id, estado: 'copiado', mensaje: `Copiado: ${recurso.titulo}. Podés pegarlo y adaptarlo a tu voz.` })
    } catch { if (intento === intentoCopia.current) setResultadoCopia({ recursoId: recurso.id, estado: 'error', mensaje: 'No pudimos copiar automáticamente. Abrí el texto completo y seleccionalo para copiarlo desde tu dispositivo. También podés volver a intentarlo.' }) }
    finally { if (intento === intentoCopia.current) setCopiando(null) }
  }
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211C19]">
    <header data-student-section-header="true" className="flex min-h-[76px] items-center justify-between gap-3 border-b border-[#E7DDD5] px-5 py-3 sm:px-8"><Link href="/inicio" aria-label="Socias Digitales, volver a Inicio"><Image src="/academy-horizontal-color.png" alt="Socias Digitales Academy" width={3922} height={1366} className="h-10 w-auto max-w-[160px] object-contain" /></Link><Link href="/inicio" className={`${boton} text-xs`}>Mi espacio<ArrowIcon /></Link></header>
    <main className="mx-auto min-w-0 max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
      <nav aria-label="Secciones de Afiliadas" className="mb-6 flex flex-wrap gap-2"><Link href="/afiliadas/productos" className={boton}>Productos</Link><Link href="/afiliadas" aria-current="page" className={`${boton} !bg-[#294A38] !text-white`}>Recursos</Link></nav>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Tu espacio de Afiliadas</p><h1 className="mt-2 text-4xl sm:text-5xl">Todo para salir a vender.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Los mensajes de Flor, copies y materiales para acompañar tus próximas ventas.</p></div><button type="button" onClick={() => void actualizar()} disabled={cargando} aria-busy={cargando} className={boton}>{cargando ? 'Actualizando…' : 'Actualizar recursos'}</button></div>
      {mensajeDescarga && <p role="alert" data-download-notice={avisoDescarga} className="mt-5 break-words rounded-2xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm leading-6 text-[#211C19]">{mensajeDescarga}</p>}
      {error && <p role="alert" className="mt-5 rounded-2xl border border-[#B01B30] bg-[#FFFDFA] p-4 text-sm leading-6">{error}</p>}
      {catalogo.estado === 'error' ? <section className="mt-5 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h2 className="text-xl font-semibold">No pudimos reunir tus recursos</h2><p role="alert" className="mt-3 text-sm leading-6 text-[#746A64]">{catalogo.mensaje}</p><button type="button" onClick={() => void actualizar()} disabled={cargando} className={`${boton} mt-4`}>Reintentar</button></section> : <>
        <section aria-label="Encontrar recursos de Afiliadas" className="mt-5 grid min-w-0 gap-4 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:grid-cols-3 sm:p-5"><label className="min-w-0 text-xs font-medium">Buscar recurso<input type="search" value={busqueda} maxLength={200} onChange={e => setBusqueda(e.target.value)} className={campo} placeholder="Tema, mensaje o campaña" /></label><label className="min-w-0 text-xs font-medium">Tipo de material<select value={tipo} onChange={e => setTipo(e.target.value)} className={campo}><option value="todos">Todos los materiales</option>{TIPOS_RECURSO_AFILIADA.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label><label className="min-w-0 text-xs font-medium">Campaña o tema<select value={campana} onChange={e => setCampana(e.target.value)} className={campo}><option value="todas">Todas las campañas</option>{campana !== 'todas' && !campanas.some(c => c.clave === campana) && <option value={campana}>Campaña sin recursos disponibles</option>}{campanas.map(c => <option key={c.clave} value={c.clave}>{c.nombre} · {c.cantidad}</option>)}</select></label></section>
        {catalogo.limitado && <p className="mt-3 text-xs leading-5 text-[#746A64]">Mostrando los primeros 200 recursos, con destacados primero. Los filtros se aplican a esta lista.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-[#746A64]">{visibles.length} {visibles.length === 1 ? 'recurso disponible' : 'recursos disponibles'} en esta vista</p>{(busqueda || tipo !== 'todos' || campana !== 'todas') && <button type="button" onClick={() => { setBusqueda(''); setTipo('todos'); setCampana('todas') }} className={boton}>Limpiar filtros</button>}</div>
        <section aria-label="Recursos para vender" className="mt-4 space-y-5">
          {separados.avisos.length > 0 && <section aria-label="Avisos destacados de Flor" className="space-y-3"><h2 className="text-lg font-semibold">De Flor para vos</h2>{separados.avisos.map(r => <TarjetaRecurso key={r.id} recurso={r} alCopiar={copiar} copiando={copiando === r.id} resultadoCopia={resultadoCopia?.recursoId === r.id ? resultadoCopia : undefined} />)}</section>}
          {grupos.length > 0 && <section aria-label="Campañas y materiales" className="space-y-4"><h2 className="text-lg font-semibold">Tus campañas y materiales</h2>{grupos.map((grupo, indice) => <details key={`${grupo.clave}:${busqueda}:${tipo}:${campana}`} open={hayFiltros || indice === 0} className="group min-w-0 rounded-[24px] border border-[#294A38] bg-[#FAF7F3]"><summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 rounded-[23px] bg-[#294A38] p-5 text-white group-open:rounded-b-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] sm:p-6"><span className="min-w-0 flex-1"><span className="block break-words text-xl font-semibold text-white">{grupo.nombre}</span><span className="mt-2 block text-xs text-[#F4EFEA]">{grupo.cantidad} {grupo.cantidad === 1 ? 'recurso' : 'recursos'}</span><span className="mt-3 flex flex-wrap gap-2">{grupo.tipos.map(t => <span key={t.tipo} className="rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-2 py-1 text-[11px] font-medium text-[#294A38]">{t.nombre} · {t.cantidad}</span>)}</span></span><svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></summary><div className="space-y-4 border-t border-[#E7DDD5] p-3 sm:p-5">{grupo.recursos.map(r => <TarjetaRecurso key={r.id} recurso={r} alCopiar={copiar} copiando={copiando === r.id} resultadoCopia={resultadoCopia?.recursoId === r.id ? resultadoCopia : undefined} />)}</div></details>)}</section>}
          {visibles.length === 0 && <article className="rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6 sm:p-8"><NavigationIcon name="productos" /><h2 className="mt-3 text-xl font-semibold">{recursos.length ? 'Probá otra búsqueda' : 'Este espacio ya es tuyo.'}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#746A64]">{recursos.length ? 'No hay recursos que coincidan con estos filtros.' : 'Acá vas a encontrar los materiales que Flor publique para sus Afiliadas. Por ahora no hay recursos publicados.'}</p></article>}
        </section>
      </>}
    </main>
  </div>
}
