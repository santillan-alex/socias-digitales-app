'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { precioProducto } from '@/lib/product-money'

interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  subtipo: string | null
  marca: string | null
  precio: number
  moneda: string
  comision_pct: number
  imagen_url: string | null
  link_compra: string | null
}

interface LinkAfiliada {
  id: string
  producto_id: string
  codigo: string
  clicks: number
  ventas: number
}

interface Props {
  productos: Producto[]
  misLinks: LinkAfiliada[]
  userId: string
  cotizacion: number | null
}

const TIPO_EMOJI: Record<string, string> = { fisico: '📦', digital: '💻' }
const SUBTIPO_LABEL: Record<string, string> = {
  ebook: 'Ebook',
  membresia: 'Membresía',
  producto_fisico: 'Producto físico',
  otro: 'Digital',
}

export default function ProductosCliente({ productos, misLinks, userId, cotizacion }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [filtro, setFiltro] = useState<'todos' | 'fisico' | 'digital'>('todos')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [generando, setGenerando] = useState<string | null>(null)

  const linksMap = Object.fromEntries(misLinks.map(l => [l.producto_id, l]))

  async function generarLink(productoId: string) {
    setGenerando(productoId)
    await supabase.rpc('generar_link_afiliada', { p_afiliada_id: userId, p_producto_id: productoId })
    setGenerando(null)
    router.refresh()
  }

  function copiarLink(codigo: string, productoId: string) {
    const url = `${window.location.origin}/ref/${codigo}`
    navigator.clipboard.writeText(url)
    setCopiado(productoId)
    setTimeout(() => setCopiado(null), 2000)
  }

  const filtrados = productos.filter(p => filtro === 'todos' || p.tipo === filtro)

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-rose-600">Socias Digitales</h1>
        <div className="flex items-center gap-4">
          <Link href="/perfil" className="text-sm text-gray-500 hover:text-gray-800">Mi perfil</Link>
          <Link href="/clases" className="text-sm text-rose-600 hover:text-rose-800 font-medium">Clases</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Catálogo de productos</h2>
          <p className="text-gray-500 text-sm mt-1">Generá tu link único para cada producto y empezá a ganar comisiones</p>
        </div>

        {/* Mis stats de afiliada */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-rose-500">{misLinks.length}</p>
            <p className="text-xs text-gray-400 mt-1">Links activos</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-rose-500">{misLinks.reduce((a, l) => a + l.clicks, 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Clicks totales</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-rose-500">{misLinks.reduce((a, l) => a + l.ventas, 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Ventas totales</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          {(['todos', 'digital', 'fisico'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filtro === f ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-rose-300'}`}>
              {f === 'todos' ? 'Todos' : f === 'digital' ? '💻 Digitales' : '📦 Físicos'}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrados.map(p => {
            const link = linksMap[p.id]
            const comisionEstimada = p.precio * p.comision_pct / 100

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                {/* Imagen */}
                <div className="h-44 bg-gradient-to-br from-rose-100 to-pink-200 relative flex items-center justify-center overflow-hidden">
                  {p.imagen_url
                    ? <img src={p.imagen_url} className="w-full h-full object-cover" alt="" />
                    : <span className="text-6xl">{TIPO_EMOJI[p.tipo]}</span>
                  }
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.tipo === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.subtipo ? SUBTIPO_LABEL[p.subtipo] : p.tipo}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{p.nombre}</h3>
                    {p.marca && <p className="text-xs text-rose-500 font-medium mt-0.5">{p.marca}</p>}
                    {p.descripcion && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.descripcion}</p>}
                  </div>

                  {/* Precio y comisión */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-gray-900">{precioProducto(p.precio, p.moneda)}</span>
                      {p.moneda === 'USD' && cotizacion !== null && (
                        <p className="text-xs text-gray-400">Aprox. {precioProducto(p.precio * cotizacion, 'ARS')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-green-600 font-bold block">{precioProducto(comisionEstimada, p.moneda)}</span>
                      <span className="text-xs text-gray-400">comisión estimada por venta ({p.comision_pct}%)</span>
                    </div>
                  </div>

                  {/* Link de afiliada */}
                  {link ? (
                    <div className="space-y-2">
                      <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 truncate font-mono">
                          /ref/{link.codigo}
                        </span>
                        <button onClick={() => copiarLink(link.codigo, p.id)}
                          className={`text-xs font-medium flex-shrink-0 px-2 py-1 rounded transition-colors ${copiado === p.id ? 'text-green-600' : 'text-rose-600 hover:text-rose-800'}`}>
                          {copiado === p.id ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span>👆 {link.clicks} clicks</span>
                        <span>💰 {link.ventas} ventas</span>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => generarLink(p.id)} disabled={generando === p.id}
                      className="w-full py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-semibold rounded-xl transition-colors">
                      {generando === p.id ? 'Generando...' : '🔗 Obtener mi link'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
