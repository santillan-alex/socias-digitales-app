'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ArrowIcon from '@/components/ArrowIcon'
import NavigationIcon from '@/components/NavigationIcon'
import { campanasAfiliadas, esCatalogoAfiliadas, fechaRecursoAfiliada, filtrarRecursosAfiliadas, TIPOS_RECURSO_AFILIADA, type CatalogoAfiliadas, type RecursoAfiliada } from '@/lib/affiliate-hub'

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const campo = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'
function TarjetaRecurso({ recurso, alCopiar }: { recurso: RecursoAfiliada; alCopiar: (recurso: RecursoAfiliada) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false)
  const largo = recurso.cuerpo.length > 650
  const tipo = TIPOS_RECURSO_AFILIADA.find(t => t.id === recurso.tipo)!
  return <article className={`min-w-0 rounded-[24px] border p-5 sm:p-6 ${recurso.tipo === 'aviso' && recurso.destacado ? 'border-[#EC9BB6] bg-[#F4CAD8]' : 'border-[#E7DDD5] bg-[#FFFDFA]'}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#294A38]">{recurso.destacado && <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[#294A38]/20 px-2">Destacado</span>}<span>{tipo.nombre}</span><time dateTime={recurso.actualizado_en} className="font-normal tracking-normal text-[#746A64]">{fechaRecursoAfiliada(recurso.actualizado_en)}</time></div>
    <h2 className="mt-3 break-words text-xl font-semibold">{recurso.titulo}</h2>
    {recurso.campana && <p className="mt-2 break-words text-xs font-medium text-[#746A64]">{recurso.campana}</p>}
    {recurso.cuerpo && <p className={`mt-4 whitespace-pre-wrap break-words text-sm leading-6 ${recurso.tipo === 'copy' ? 'rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4' : ''}`}>{largo && !abierto ? recurso.cuerpo.slice(0, 650) + '…' : recurso.cuerpo}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {largo && <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className={boton}>{abierto ? 'Mostrar menos' : 'Ver texto completo'}</button>}
      {recurso.tipo === 'copy' && <button type="button" onClick={() => void alCopiar(recurso)} className={`${boton} border-[#294A38]`}>Copiar texto completo</button>}
      {recurso.url && <a href={recurso.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={`${boton} border-[#294A38]`}>{recurso.tipo === 'video' ? 'Abrir video' : recurso.tipo === 'archivo' ? 'Abrir archivo' : 'Abrir enlace'}<ArrowIcon diagonal /><span className="sr-only">: {recurso.titulo} (se abre en otra pestaña)</span></a>}
    </div>
    {recurso.url && <p className="mt-3 break-all text-xs leading-5 text-[#746A64]">Destino externo: {new URL(recurso.url).hostname}. El acceso depende de los permisos de ese sitio.</p>}
  </article>
}
export default function AfiliadasCliente({ inicial }: { inicial: CatalogoAfiliadas }) {
  const [catalogo, setCatalogo] = useState(inicial), [busqueda, setBusqueda] = useState(''), [tipo, setTipo] = useState('todos'), [campana, setCampana] = useState('todas')
  const [cargando, setCargando] = useState(false), [error, setError] = useState(''), [copiado, setCopiado] = useState('')
  const recursos = catalogo.estado === 'lista' ? catalogo.recursos : []
  const visibles = filtrarRecursosAfiliadas(recursos, { busqueda, tipo, campana })
  async function actualizar() {
    if (cargando) return
    setCargando(true); setError('')
    try { const response = await fetch('/api/afiliadas', { cache: 'no-store' }), data: unknown = await response.json(); if (!response.ok || !esCatalogoAfiliadas(data)) throw new Error(); setCatalogo(data) }
    catch { setError('No pudimos actualizar los recursos. La lista anterior puede haber cambiado; reintentá antes de usarla.'); setCatalogo({ estado: 'error', mensaje: 'No pudimos comprobar los recursos publicados.' }) }
    finally { setCargando(false) }
  }
  async function copiar(recurso: RecursoAfiliada) {
    setCopiado('')
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(recurso.cuerpo); setCopiado(`Copiado: ${recurso.titulo}. Podés pegarlo y adaptarlo a tu voz.`) }
    catch { setCopiado('No pudimos copiar automáticamente. Abrí el texto completo y seleccionalo para copiarlo desde tu dispositivo.') }
  }
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211C19]">
    <header data-student-section-header="true" className="flex min-h-[76px] items-center justify-between gap-3 border-b border-[#E7DDD5] px-5 py-3 sm:px-8"><Link href="/inicio" aria-label="Socias Digitales, volver a Inicio"><Image src="/academy-horizontal-color.png" alt="Socias Digitales Academy" width={3922} height={1366} className="h-10 w-auto max-w-[160px] object-contain" /></Link><Link href="/inicio" className={`${boton} text-xs`}>Mi espacio<ArrowIcon /></Link></header>
    <main className="mx-auto min-w-0 max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Tu espacio de Afiliadas</p><h1 className="mt-2 text-4xl sm:text-5xl">Todo para salir a vender.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Los mensajes de Flor, copies y materiales para acompañar tus próximas ventas.</p></div><button type="button" onClick={() => void actualizar()} disabled={cargando} aria-busy={cargando} className={boton}>{cargando ? 'Actualizando…' : 'Actualizar recursos'}</button></div>
      {error && <p role="alert" className="mt-5 rounded-2xl border border-[#B01B30] bg-[#FFFDFA] p-4 text-sm leading-6">{error}</p>}
      <p role="status" aria-live="polite" className="mt-4 break-words text-sm font-medium text-[#294A38]">{copiado}</p>
      {catalogo.estado === 'error' ? <section className="mt-5 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h2 className="text-xl font-semibold">No pudimos reunir tus recursos</h2><p role="alert" className="mt-3 text-sm leading-6 text-[#746A64]">{catalogo.mensaje}</p><button type="button" onClick={() => void actualizar()} disabled={cargando} className={`${boton} mt-4`}>Reintentar</button></section> : <>
        <section aria-label="Encontrar recursos de Afiliadas" className="mt-5 grid min-w-0 gap-4 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:grid-cols-3 sm:p-5"><label className="min-w-0 text-xs font-medium">Buscar recurso<input type="search" value={busqueda} maxLength={200} onChange={e => setBusqueda(e.target.value)} className={campo} placeholder="Tema, mensaje o campaña" /></label><label className="min-w-0 text-xs font-medium">Tipo de material<select value={tipo} onChange={e => setTipo(e.target.value)} className={campo}><option value="todos">Todos los materiales</option>{TIPOS_RECURSO_AFILIADA.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label><label className="min-w-0 text-xs font-medium">Campaña<select value={campana} onChange={e => setCampana(e.target.value)} className={campo}><option value="todas">Todas las campañas</option>{campanasAfiliadas(recursos).map(c => <option key={c} value={c}>{c}</option>)}</select></label></section>
        {catalogo.limitado && <p className="mt-3 text-xs leading-5 text-[#746A64]">Mostrando los primeros 200 recursos, con destacados primero. Los filtros se aplican a esta lista.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-[#746A64]">{visibles.length} {visibles.length === 1 ? 'recurso disponible' : 'recursos disponibles'} en esta vista</p>{(busqueda || tipo !== 'todos' || campana !== 'todas') && <button type="button" onClick={() => { setBusqueda(''); setTipo('todos'); setCampana('todas') }} className={boton}>Limpiar filtros</button>}</div>
        <section aria-label="Recursos para vender" className="mt-4 space-y-4">{visibles.map(r => <TarjetaRecurso key={r.id} recurso={r} alCopiar={copiar} />)}{visibles.length === 0 && <article className="rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6 sm:p-8"><NavigationIcon name="productos" /><h2 className="mt-3 text-xl font-semibold">{recursos.length ? 'Probá otra búsqueda' : 'Este espacio ya es tuyo.'}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#746A64]">{recursos.length ? 'No hay recursos que coincidan con estos filtros.' : 'Acá vas a encontrar los materiales que Flor publique para sus Afiliadas. Por ahora no hay recursos publicados.'}</p></article>}</section>
      </>}
    </main>
  </div>
}
