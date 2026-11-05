'use client'
import AdminSectionMenu from '@/components/AdminSectionMenu'

interface Metrica {
  id: string
  alumna_id: string
  tipo_trafico: string
  inversion: number
  personas_grupo: number
  personas_seguimiento: number
  ventas_realizadas: number
  objetivo_septiembre: number
  actualizado_en: string
  perfiles: {
    nombre: string
    email: string
    instagram: string | null
    pais: string | null
    telefono: string | null
    created_at: string
  } | null
}

interface Afiliada {
  id: string
  nombre: string
  email: string
  instagram: string | null
  pais: string | null
  telefono: string | null
  created_at: string
}

interface Props {
  metricas: Metrica[]
  afiliadas: Afiliada[]
}

export default function AdminLanzamientoCliente({ metricas, afiliadas }: Props) {

  const metricasUnicas = metricas.filter((metrica, index, lista) =>
    lista.findIndex(item => item.alumna_id === metrica.alumna_id) === index
  )

  const total = {
    grupo: metricasUnicas.reduce((a, m) => a + (m.personas_grupo || 0), 0),
    seguimiento: metricasUnicas.reduce((a, m) => a + (m.personas_seguimiento || 0), 0),
    ventas: metricasUnicas.reduce((a, m) => a + (m.ventas_realizadas || 0), 0),
    inversion: metricasUnicas.reduce((a, m) => a + (m.inversion || 0), 0),
  }

  function exportarCSV() {
    const filas = [
      ['Nombre', 'Email', 'Instagram', 'País', 'Registrada', 'Tráfico', 'Inversión USD', 'En grupo', 'En seguimiento', 'Ventas', 'Objetivo USD']
    ]

    afiliadas.forEach(a => {
      const m = metricasUnicas.find(x => x.alumna_id === a.id)
      filas.push([
        a.nombre || '',
        a.email || '',
        a.instagram ? `@${a.instagram}` : '',
        a.pais || '',
        new Date(a.created_at).toLocaleDateString('es-AR'),
        m?.tipo_trafico || '',
        m?.inversion?.toString() || '0',
        m?.personas_grupo?.toString() || '0',
        m?.personas_seguimiento?.toString() || '0',
        m?.ventas_realizadas?.toString() || '0',
        m?.objetivo_septiembre?.toString() || '0',
      ])
    })

    const csv = filas.map(f => f.map(v => {
      const texto = String(v ?? '')
      const seguro = /^[\s]*[=+@-]/.test(texto) ? `'${texto}` : texto
      return `"${seguro.replaceAll('"', '""')}"`
    }).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `afiliadas-lanzamiento-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen" style={{ background: '#f5f0eb' }}>
      <nav data-admin-section-header="true" className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Panel admin</a>
      </nav>
      <AdminSectionMenu />

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-semibold" style={{ color: '#211c19' }}>Registro del lanzamiento anterior</h2>
            <p className="text-sm text-gray-500 mt-1">{afiliadas.length} afiliadas registradas · {metricasUnicas.length} con métricas cargadas</p>
          </div>
          <button onClick={exportarCSV}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm"
            style={{ background: '#294A38' }}>
            Descargar CSV
          </button>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total en grupo', value: total.grupo, emoji: '👥', color: '#337357' },
            { label: 'En seguimiento', value: total.seguimiento, emoji: '🎯', color: '#E27396' },
            { label: 'Ventas totales', value: total.ventas, emoji: '🏆', color: '#d97706' },
            { label: 'Inversión total', value: `$${total.inversion.toFixed(0)}`, emoji: '💰', color: '#7c3aed' },
          ].map(({ label, value, emoji, color }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm p-5 text-center">
              <p className="text-2xl mb-1">{emoji}</p>
              <p className="text-3xl font-black" style={{ color }}>{value}</p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabla afiliadas */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Todas las afiliadas</h2>
          </div>
          {afiliadas.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p>Ninguna afiliada registrada todavía.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Afiliada</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Tráfico</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Inversión</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Grupo</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Seguimiento</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Ventas</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Objetivo</th>
                  </tr>
                </thead>
                <tbody>
                  {afiliadas.map(a => {
                    const m = metricasUnicas.find(x => x.alumna_id === a.id)
                    return (
                      <tr key={a.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-800">{a.nombre || '—'}</p>
                          <p className="text-xs text-gray-400">{a.email}</p>
                          {a.instagram && <p className="text-xs text-gray-400">@{a.instagram}</p>}
                          {a.pais && <p className="text-xs text-gray-400">📍 {a.pais}</p>}
                          <p className="text-xs text-gray-300 mt-0.5">Registro: {new Date(a.created_at).toLocaleDateString('es-AR')}</p>
                        </td>
                        <td className="text-center px-4 py-4">
                          {m ? (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full"
                              style={{
                                background: m.tipo_trafico === 'pago' ? '#fef3c7' : '#f0fdf4',
                                color: m.tipo_trafico === 'pago' ? '#d97706' : '#337357',
                              }}>
                              {m.tipo_trafico === 'pago' ? '💰 Pago' : '🌱 Orgánico'}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="text-center px-4 py-4 font-semibold text-gray-700">
                          {m?.inversion ? `$${m.inversion}` : '—'}
                        </td>
                        <td className="text-center px-4 py-4">
                          <span className="text-lg font-black" style={{ color: '#337357' }}>{m?.personas_grupo ?? '—'}</span>
                        </td>
                        <td className="text-center px-4 py-4">
                          <span className="text-lg font-black" style={{ color: '#E27396' }}>{m?.personas_seguimiento ?? '—'}</span>
                        </td>
                        <td className="text-center px-4 py-4">
                          <span className="text-lg font-black" style={{ color: '#d97706' }}>{m?.ventas_realizadas ?? '—'}</span>
                        </td>
                        <td className="text-center px-4 py-4">
                          {m?.objetivo_septiembre ? (
                            <div>
                              <p className="text-xs text-gray-400">${m.objetivo_septiembre}</p>
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
