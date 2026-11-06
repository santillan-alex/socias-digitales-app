'use client'

import { useState } from 'react'
import CommerceProductImage from './CommerceProductImage'
import { commerceButton as boton, type CommercePreviewProduct } from './commerce-preview'

export default function CommerceBuyerPreview({ producto }: { producto: CommercePreviewProduct }) {
  const [abierta, setAbierta] = useState<'entrega' | 'cambios' | null>(null)
  return <div className="min-w-0">
    <header className="border-b border-[#E7DDD5] pb-5"><p className="text-[10px] font-medium uppercase tracking-[.2em] text-[#294A38]">La selección de Flor</p></header>
    <div className="mt-6 grid min-w-0 gap-7 lg:grid-cols-2 lg:items-start">
      <CommerceProductImage producto={producto} className="aspect-square" />
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#746A64]">{producto.categoria}</p><h1 className="mt-3 break-words font-serif text-4xl sm:text-5xl">{producto.nombre}</h1>{producto.descripcion && <p className="mt-4 text-sm leading-7 text-[#746A64]">{producto.descripcion}</p>}<div className="mt-5 border-y border-[#E7DDD5] py-5"><p className="text-xs text-[#746A64]">Precio</p><p className="mt-2 font-impact text-2xl font-semibold">A confirmar</p></div>
        <section className="mt-5"><h2 className="text-sm font-semibold">Opciones</h2>{producto.variantes.length ? <ul className="mt-3 flex flex-wrap gap-2">{producto.variantes.map(v => <li key={v} className="rounded-xl border border-[#E7DDD5] bg-[#FAF7F3] px-4 py-3 text-sm">{v}</li>)}</ul> : <p className="mt-2 text-sm text-[#746A64]">A confirmar</p>}</section>
        <button type="button" disabled className={`${boton} mt-6 w-full !border-[#294A38] !bg-[#294A38] !text-white`}>Comprar</button>
      </div>
    </div>
    {producto.detalles.length > 0 && <section className="mt-7 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 sm:p-6"><h2 className="text-lg font-semibold">Detalles</h2><ul className="mt-4 space-y-3">{producto.detalles.map(t => <li key={t} className="text-sm leading-6 text-[#746A64]">· {t}</li>)}</ul></section>}
    <section aria-label="Información de compra" className="mt-5 space-y-3">{([{ id: 'entrega', titulo: 'Envíos' }, { id: 'cambios', titulo: 'Cambios y devoluciones' }] as const).map(f => <article key={f.id} className="rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3]"><button type="button" aria-expanded={abierta === f.id} aria-controls={`buyer-${f.id}`} onClick={() => setAbierta(abierta === f.id ? null : f.id)} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-[22px] p-5 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]">{f.titulo}<span aria-hidden="true" className="text-xl font-normal text-[#294A38]">{abierta === f.id ? '−' : '+'}</span></button>{abierta === f.id && <p id={`buyer-${f.id}`} className="px-5 pb-5 text-sm leading-7 text-[#746A64]">Información por confirmar.</p>}</article>)}</section>
  </div>
}
