'use client'
import AdminSectionMenu from '@/components/AdminSectionMenu'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OfertaSociasEditor from './OfertaSociasEditor'

interface Props {
  cotizacion: number
}

export default function ConfiguracionAdmin({ cotizacion: cotizacionInicial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [cotizacion, setCotizacion] = useState(cotizacionInicial)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setError('')
    if (!Number.isFinite(cotizacion) || cotizacion <= 0) {
      setError('Ingresá una cotización mayor a cero.')
      return
    }
    setGuardando(true)
    setGuardado(false)
    try {
      const { error: causa } = await supabase.from('configuracion').upsert({ clave: 'cotizacion_dolar', valor: String(cotizacion), updated_at: new Date().toISOString() })
      if (causa) throw causa
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
      router.refresh()
    } catch {
      setError('No se pudo guardar la cotización. Intentá nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  // Ejemplos de precios con la cotización actual
  const ejemplos = [97, 47, 27, 17, 7]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</a>
        <h1 className="text-lg font-bold text-rose-600">Configuración</h1>
      </nav>
      <AdminSectionMenu />

      <div className="max-w-xl mx-auto px-4 py-10 space-y-6">

        <OfertaSociasEditor />

        {/* Cotización del dólar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cotización del dólar</h2>
            <p className="text-sm text-gray-500 mt-1">
              Esta cotización se aplica automáticamente a todos los productos para mostrar el precio en pesos.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                1 USD = cuántos ARS
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-medium">$</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cotizacion}
                  onChange={e => setCotizacion(Number(e.target.value))}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
                <span className="text-gray-400 font-medium">ARS</span>
              </div>
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-[#B01B30]">{error}</p>}
          <button
            onClick={guardar}
            disabled={guardando}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
              guardado
                ? 'bg-green-500 text-white'
                : 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white'
            }`}
          >
            {guardado ? '✓ Cotización actualizada' : guardando ? 'Guardando...' : 'Actualizar cotización'}
          </button>
        </div>

        {/* Preview de conversiones */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Vista previa de conversiones</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 border-b border-gray-100">
              <span>Precio USD</span>
              <span className="text-center">=</span>
              <span className="text-right">Precio ARS</span>
            </div>
            {ejemplos.map(usd => (
              <div key={usd} className="grid grid-cols-3 items-center py-2 border-b border-gray-50 last:border-0">
                <span className="font-semibold text-gray-800">USD ${usd}</span>
                <span className="text-center text-gray-300">→</span>
                <span className="text-right font-bold text-rose-600">
                  $ {(usd * cotizacion).toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
