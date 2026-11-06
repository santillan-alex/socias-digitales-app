'use client'

import { useState } from 'react'
import type { CommercePreviewProduct } from './commerce-preview'

export default function CommerceProductImage({ producto, className = '' }: { producto: CommercePreviewProduct; className?: string }) {
  const [fallida, setFallida] = useState<string | null>(null)
  return <div className={`relative flex aspect-[4/3] min-w-0 items-center justify-center overflow-hidden rounded-[20px] border border-[#E7DDD5] bg-[#F4EFEA] ${className}`}>
    {producto.imagenUrl && fallida !== producto.imagenUrl ? <img src={producto.imagenUrl} alt={producto.nombre} className="h-full w-full object-contain p-5" loading="lazy" onError={() => setFallida(producto.imagenUrl)} referrerPolicy="no-referrer" /> : <div className="flex flex-col items-center px-6 py-8 text-center text-[#746A64]">
      <svg aria-hidden="true" width="94" height="94" viewBox="0 0 96 96" fill="none"><path d="M20 33h56l5 47H15l5-47Z" fill="#F4CAD8" stroke="#294A38" strokeWidth="1.5" /><path d="M33 35V24a15 15 0 0 1 30 0v11" stroke="#294A38" strokeWidth="2" strokeLinecap="round" /><path d="M25 42h46M30 70h36" stroke="#EC9BB6" strokeWidth="1.5" /><circle cx="48" cy="54" r="5" fill="#294A38" /></svg>
      <p className="mt-3 text-xs">Imagen pendiente</p>
    </div>}
  </div>
}
