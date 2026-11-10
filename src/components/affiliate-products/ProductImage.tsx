'use client'

import { useState } from 'react'
import NavigationIcon from '@/components/NavigationIcon'

export const botonProducto = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] transition-colors hover:border-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:cursor-not-allowed disabled:opacity-50'
export const campoProducto = 'mt-2 block min-h-11 w-full min-w-0 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-base text-[#211C19] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294A38] disabled:opacity-60'

export default function ProductImage({ src, nombre, className = '' }: { src: string | null; nombre: string; className?: string }) {
  const [fallo, setFallo] = useState(false)
  return <div className={`flex aspect-[4/3] min-w-0 items-center justify-center rounded-[20px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 ${className}`}>{src && !fallo ? <img src={src} alt={nombre} loading="lazy" referrerPolicy="no-referrer" onError={() => setFallo(true)} className="h-full max-h-full w-full min-w-0 object-contain" /> : <div className="flex flex-col items-center gap-3 text-[#746A64]"><NavigationIcon name="productos" /><span className="text-xs">Sin imagen</span></div>}</div>
}
