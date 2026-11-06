'use client'

import { useState } from 'react'
import Link from 'next/link'
import NavigationIcon from '@/components/NavigationIcon'
import CommerceAdminPreview from './CommerceAdminPreview'
import CommerceAffiliatePreview from './CommerceAffiliatePreview'
import CommerceBuyerPreview from './CommerceBuyerPreview'
import { commerceButton as boton, type CommercePreviewProduct } from './commerce-preview'

type Vista = 'afiliada' | 'flor' | 'compradora'

export default function CommerceStructurePreview({ productos }: { productos: CommercePreviewProduct[] }) {
  const [vista, setVista] = useState<Vista>('afiliada')
  const [productoId, setProductoId] = useState<string | null>(productos[0]?.id ?? null)
  const producto = productos.find(p => p.id === productoId) ?? productos[0]
  const esCompradora = vista === 'compradora'
  return <div className={`platform-design ${esCompradora ? '' : vista === 'flor' ? 'platform-design--admin' : 'platform-design--member'}`}>
    <div className="min-h-screen bg-[#F4EFEA] text-[#211C19]">
      <p className="border-b border-[#E7DDD5] bg-[#F4CAD8] px-4 py-2.5 text-center text-[11px] leading-5 text-[#294A38]">Propuesta visual · Afiliadas / Productos</p>
      <header className="sticky top-0 z-40 border-b border-[#E7DDD5] bg-[#FAF7F3] px-4 py-3 sm:px-7"><div className="mx-auto flex max-w-[1400px] min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center justify-between gap-4"><img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" className="h-11 w-auto max-w-[160px] object-contain" /><p className="text-right text-[10px] leading-5 text-[#746A64] sm:hidden">Vista previa</p></div><div className="flex min-w-0 flex-wrap gap-2" aria-label="Elegir experiencia de la muestra">{([{ id: 'afiliada', texto: 'Afiliada' }, { id: 'flor', texto: 'Flor' }, { id: 'compradora', texto: 'Compradora' }] as const).map(v => <button key={v.id} type="button" aria-pressed={vista === v.id} onClick={() => setVista(v.id)} className={`${boton} flex-1 sm:flex-none ${vista === v.id ? '!border-[#294A38] !bg-[#294A38] !text-white' : ''}`}>{v.texto}</button>)}</div></div></header>
      <div className={`mx-auto grid max-w-[1400px] min-w-0 ${!esCompradora ? 'lg:grid-cols-[220px_minmax(0,1fr)]' : ''}`}>
        {!esCompradora && <aside className="hidden min-w-0 border-r border-[#E7DDD5] bg-[#FAF7F3] px-5 py-7 lg:block"><div className="sticky top-[108px]"><p className="px-3 text-[10px] font-semibold uppercase tracking-[.22em] text-[#746A64]">{vista === 'flor' ? 'Panel de Flor' : 'Mi espacio'}</p><div aria-label="Ubicación propuesta en la plataforma" className="mt-5 space-y-2 text-sm text-[#746A64]">{vista === 'flor' ? <><p className="flex min-h-11 items-center gap-3 px-3"><NavigationIcon name="inicio" />Vista general</p><p className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#294A38]">Alumnas y accesos</p><p className="flex min-h-11 items-center gap-3 px-3"><NavigationIcon name="productos" />Afiliadas</p><p className="rounded-xl bg-[#F4CAD8] px-4 py-3 font-semibold text-[#211C19]">Productos y permisos</p><p className="px-4 py-3">Recursos y campañas</p><p className="px-4 py-3">Pedidos y comisiones</p></> : <><p className="flex min-h-11 items-center gap-3 px-3"><NavigationIcon name="inicio" />Inicio</p><p className="flex min-h-11 items-center gap-3 rounded-xl bg-[#F4CAD8] px-3 py-3 font-semibold text-[#211C19]"><NavigationIcon name="productos" />Afiliadas</p><p className="flex min-h-11 items-center gap-3 px-3"><NavigationIcon name="perfil" />Mi perfil</p><p className="flex min-h-11 items-center gap-3 px-3"><NavigationIcon name="notificaciones" />Notificaciones</p></>}</div></div></aside>}
        <main className={`w-full min-w-0 px-4 py-7 sm:px-7 sm:py-9 ${esCompradora ? 'mx-auto max-w-[1100px]' : ''}`}>
          {vista === 'afiliada' ? <CommerceAffiliatePreview productos={productos} verCompradora={p => { setProductoId(p.id); setVista('compradora') }} /> : vista === 'flor' ? <CommerceAdminPreview productos={productos} /> : <><div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#E7DDD5] bg-[#FAF7F3] p-3"><p className="text-xs leading-5 text-[#746A64]">Vista del comprador</p><label className="flex min-w-0 flex-wrap items-center gap-2 text-xs">Producto<select value={producto?.id ?? ''} onChange={e => setProductoId(e.target.value)} className="min-h-11 w-full min-w-0 max-w-[260px] rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-2 text-base sm:w-auto">{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label></div>{producto ? <CommerceBuyerPreview key={producto.id} producto={producto} /> : <section className="rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><h1 className="font-serif text-3xl">Sin productos</h1></section>}</>}
        </main>
      </div>
      <footer className="border-t border-[#E7DDD5] px-5 py-5 text-center text-[11px] leading-6 text-[#746A64]"><p>Vista previa · Compras desactivadas</p><Link href="/admin/afiliadas" prefetch={false} className="mt-2 inline-flex min-h-11 items-center font-medium text-[#294A38] underline underline-offset-4">Volver al Panel de Flor</Link></footer>
    </div>
  </div>
}
