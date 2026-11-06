'use client'

import { useRef, useState } from 'react'
import ArrowIcon from '@/components/ArrowIcon'
import NavigationIcon from '@/components/NavigationIcon'
import { commerceButton as boton, commerceInput as campo, findPreviewProducts, type CommercePreviewProduct } from './commerce-preview'

function ProductPhoto({ producto, compacta = false }: { producto: CommercePreviewProduct; compacta?: boolean }) {
  const [fallida, setFallida] = useState<string | null>(null)
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E7DDD5] bg-[#F4EFEA] ${compacta ? 'h-16 w-16' : 'aspect-square w-full max-w-48'}`}>
    {producto.imagenUrl && fallida !== producto.imagenUrl ? <img src={producto.imagenUrl} alt={producto.nombre} loading="lazy" referrerPolicy="no-referrer" onError={() => setFallida(producto.imagenUrl)} className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 p-3 text-center text-[#294A38]"><NavigationIcon name="productos" />{!compacta && <span className="text-xs">Foto pendiente</span>}</div>}
  </div>
}

function PendingBadge() {
  return <span className="inline-flex rounded-full border border-[#EC9BB6] bg-[#F4CAD8] px-3 py-1.5 text-xs font-medium text-[#294A38]">Pendiente</span>
}

export default function CommerceAdminPreview({ productos }: { productos: CommercePreviewProduct[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const dialogo = useRef<HTMLDialogElement | null>(null)
  const origenFicha = useRef<HTMLButtonElement | null>(null)
  const categorias = [...new Set(productos.map(p => p.categoria))].sort((a, b) => a.localeCompare(b, 'es-AR'))
  const seleccionada = productos.find(p => p.id === seleccionadoId) ?? null
  const visibles = findPreviewProducts(productos, busqueda, categoria === 'todas' ? '' : categoria)
  const hayFiltros = Boolean(busqueda || categoria !== 'todas')

  function limpiar() { setBusqueda(''); setCategoria('todas') }
  function abrirFicha(producto: CommercePreviewProduct, origen: HTMLButtonElement) {
    origenFicha.current = origen
    setSeleccionadoId(producto.id)
    if (dialogo.current && !dialogo.current.open) dialogo.current.showModal()
  }
  function cerrarFicha() { dialogo.current?.close() }

  return <section aria-labelledby="commerce-admin-titulo" className="min-w-0 text-[#211C19]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Catálogo</p><h1 id="commerce-admin-titulo" className="mt-2 font-serif text-4xl sm:text-5xl">Productos</h1></div>
      <span className="rounded-full border border-[#E7DDD5] bg-[#FAF7F3] px-3 py-2 text-xs leading-5 text-[#746A64]">Pendiente</span>
    </div>

    <section aria-label="Resumen del catálogo" className="mt-6 grid min-w-0 gap-3 sm:grid-cols-3">
      <article className="min-w-0 rounded-[22px] border border-[#EC9BB6] bg-[#F4CAD8] p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#294A38]">Productos</p><p className="mt-3 font-impact text-4xl font-semibold tabular-nums">{productos.length}</p></article>
      <article className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#746A64]">Precio y comisión</p><p className="mt-3 font-impact text-2xl font-semibold">A definir</p></article>
      <article className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#746A64]">Stock</p><p className="mt-3 font-impact text-2xl font-semibold text-[#294A38]">Pendiente</p></article>
    </section>

    <section aria-label="Filtrar catálogo de Afiliadas" className="mt-6 grid min-w-0 gap-4 rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)] sm:p-5">
      <label className="min-w-0 text-xs font-medium">Buscar producto<input type="search" maxLength={200} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre, categoría o descripción" className={campo} /></label>
      <label className="min-w-0 text-xs font-medium">Categoría<select value={categoria} onChange={e => setCategoria(e.target.value)} className={campo}><option value="todas">Todas las categorías</option>{categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
    </section>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-xs leading-5 text-[#746A64]">{visibles.length} {visibles.length === 1 ? 'producto' : 'productos'} en esta vista</p>{hayFiltros && <button type="button" onClick={limpiar} className={boton}>Limpiar filtros</button>}</div>

    {visibles.length === 0 ? <article className="mt-4 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6 sm:p-8"><h3 className="text-xl font-semibold">{productos.length ? 'No hay coincidencias' : 'Sin productos'}</h3></article> : <>
      <section aria-label="Productos en tarjetas" className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:hidden">
        {visibles.map(producto => <article key={producto.id} className="min-w-0 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5"><div className="flex min-w-0 items-start gap-3"><ProductPhoto producto={producto} compacta /><div className="min-w-0 flex-1"><p className="break-words text-[10px] font-semibold uppercase tracking-[.14em] text-[#746A64]">{producto.categoria}</p><h3 className="mt-2 break-words text-base font-semibold">{producto.nombre}</h3></div></div><div className="mt-4"><PendingBadge /></div><p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-[#746A64]">{producto.descripcion}</p><dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 text-xs"><div className="min-w-0"><dt className="text-[#746A64]">Precio y comisión</dt><dd className="mt-1 font-medium">A definir</dd></div><div className="min-w-0"><dt className="text-[#746A64]">Afiliadas</dt><dd className="mt-1 font-medium">Pendiente</dd></div></dl><button type="button" onClick={e => abrirFicha(producto, e.currentTarget)} className={`${boton} mt-5 w-full`}>Ver ficha<span className="sr-only"> de {producto.nombre}</span><ArrowIcon /></button></article>)}
      </section>
      <section aria-label="Catálogo de productos para Afiliadas" className="mt-4 hidden rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 lg:block"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Catálogo de productos</caption><thead><tr className="border-b border-[#E7DDD5] text-[10px] font-semibold uppercase tracking-[.14em] text-[#746A64]"><th scope="col" className="pb-3 pr-4">Producto</th><th scope="col" className="pb-3 pr-4">Precio / comisión</th><th scope="col" className="pb-3 pr-4">Afiliadas</th><th scope="col" className="pb-3 pr-4">Whop</th><th scope="col" className="pb-3"><span className="sr-only">Ficha</span></th></tr></thead><tbody className="divide-y divide-[#E7DDD5]">{visibles.map(producto => <tr key={producto.id}><th scope="row" className="max-w-[300px] py-4 pr-4 font-normal"><div className="flex min-w-0 items-center gap-3"><ProductPhoto producto={producto} compacta /><div className="min-w-0"><p className="break-words font-semibold">{producto.nombre}</p><p className="mt-1 break-words text-xs text-[#746A64]">{producto.categoria}</p></div></div></th><td className="py-4 pr-4 text-xs">A definir</td><td className="py-4 pr-4 text-xs">Pendiente</td><td className="py-4 pr-4"><PendingBadge /></td><td className="py-4 text-right"><button type="button" onClick={e => abrirFicha(producto, e.currentTarget)} className={boton}>Ver ficha<span className="sr-only"> de {producto.nombre}</span><ArrowIcon /></button></td></tr>)}</tbody></table></div></section>
    </>}



    <dialog ref={dialogo} aria-labelledby="commerce-admin-ficha-titulo" onClose={() => { setSeleccionadoId(null); if (origenFicha.current?.isConnected) origenFicha.current.focus({ preventScroll: true }) }} onClick={e => { if (e.target === e.currentTarget) cerrarFicha() }} className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-[#211C19] backdrop:bg-[#211C19]/60 sm:p-7" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#E7DDD5] bg-[#FFFDFA] pb-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#294A38]">Producto</p><h2 id="commerce-admin-ficha-titulo" className="mt-2 break-words text-xl font-semibold">{seleccionada?.nombre || 'Ficha del producto'}</h2></div><button type="button" autoFocus onClick={cerrarFicha} className={boton}>Cerrar</button></div>
      {seleccionada && <div className="min-w-0 space-y-4 pt-5">
        <section aria-label="Catálogo" className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:p-5"><h3 className="text-base font-semibold">Catálogo</h3><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]"><ProductPhoto producto={seleccionada} /><div className="min-w-0"><p className="text-xs font-medium text-[#294A38]">{seleccionada.categoria}</p><p className="mt-3 break-words text-sm leading-6">{seleccionada.descripcion}</p>{seleccionada.detalles.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-6 text-[#746A64]">{seleccionada.detalles.map((detalle, i) => <li key={`${i}:${detalle}`} className="break-words">{detalle}</li>)}</ul>}</div></div></section>
        <section aria-label="Variantes" className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-4 sm:p-5"><h3 className="text-base font-semibold">Variantes</h3>{seleccionada.variantes.length > 0 ? <ul className="mt-3 flex min-w-0 flex-wrap gap-2">{seleccionada.variantes.map((variante, i) => <li key={`${i}:${variante}`} className="max-w-full break-words rounded-xl border border-[#E7DDD5] bg-[#FAF7F3] px-3 py-2 text-xs leading-5">{variante}</li>)}</ul> : <p className="mt-3 text-sm font-medium">A definir</p>}<dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 border-t border-[#E7DDD5] pt-4 text-xs"><div className="min-w-0"><dt className="text-[#746A64]">SKU</dt><dd className="mt-1">Pendiente</dd></div><div className="min-w-0"><dt className="text-[#746A64]">Stock</dt><dd className="mt-1">Pendiente</dd></div></dl></section>
        <section aria-label="Comisión" className="min-w-0 rounded-[22px] border border-[#EC9BB6] bg-[#F4CAD8] p-4 sm:p-5"><h3 className="text-base font-semibold">Comisión</h3><dl className="mt-4 grid min-w-0 grid-cols-2 gap-4 text-sm"><div className="min-w-0"><dt className="text-xs text-[#294A38]">Precio</dt><dd className="mt-2 font-semibold">A definir</dd></div><div className="min-w-0"><dt className="text-xs text-[#294A38]">Comisión</dt><dd className="mt-2 font-semibold">A definir</dd></div></dl></section>
        <section aria-label="Afiliadas" className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-4 sm:p-5"><h3 className="text-base font-semibold">Afiliadas</h3><p className="mt-3 text-sm font-medium">Pendiente</p></section>
        <section aria-label="Materiales" className="min-w-0 rounded-[22px] border border-[#EC9BB6] bg-[#F4EFEA] p-4 sm:p-5"><h3 className="text-base font-semibold">Materiales</h3><ul className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">{['Copys y mensajes', 'Videos para anuncios', 'Fotos y archivos', 'Enlaces de apoyo'].map(nombre => <li key={nombre} className="min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] p-3"><p className="break-words text-xs font-medium">{nombre}</p><p className="mt-1 text-xs text-[#746A64]">Pendiente</p></li>)}</ul></section>
        <section aria-label="Whop" className="min-w-0 rounded-[22px] border border-[#294A38] bg-[#294A38] p-4 text-white sm:p-5"><h3 className="text-base font-semibold">Whop</h3><p className="mt-3 text-sm font-medium">Pendiente</p></section>
      </div>}
    </dialog>
  </section>
}
