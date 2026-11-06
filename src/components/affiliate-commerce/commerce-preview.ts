// Contrato visual del prototipo. No representa precios, permisos o stock de Whop.
export interface CommercePreviewProduct {
  id: string
  nombre: string
  categoria: string
  descripcion: string
  imagenUrl: string | null
  variantes: string[]
  detalles: string[]
}

export const commerceButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] transition-colors hover:border-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:cursor-not-allowed disabled:opacity-60'
export const commerceInput = 'mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'

export function findPreviewProducts(productos: readonly CommercePreviewProduct[], busqueda: string, categoria: string) {
  const normalizar = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
  const palabras = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean)
  return productos.filter(p => (!categoria || p.categoria === categoria) && palabras.every(t => normalizar(`${p.nombre} ${p.categoria} ${p.descripcion}`).includes(t)))
}
