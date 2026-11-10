export function precioProducto(precio: number | null, moneda: string) {
  if (!['USD', 'ARS', 'MXN', 'EUR'].includes(moneda) || precio === null || precio === undefined || !Number.isFinite(Number(precio))) return 'Precio sin comprobar'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(Number(precio))
}

export function cotizacionProducto(valor: unknown): number | null {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? numero : null
}
