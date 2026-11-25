'use client'
import AdminSectionMenu from '@/components/AdminSectionMenu'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Inscripta {
  id: string
  nombre: string | null
  email: string
  created_at: string
  desafio_socias_habilitada: boolean
  desafio_socias_estado: string
  desafio_socias_bienvenida_enviada_at: string | null
  estrategia_habilitada: boolean
}

export default function AdminDesafio({ inscriptas }: { inscriptas: Inscripta[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroAcceso, setFiltroAcceso] = useState<'pendientes' | 'habilitadas' | 'rechazadas' | 'todas'>('pendientes')
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return inscriptas.filter(persona => {
      const coincideBusqueda = !q || `${persona.nombre ?? ''} ${persona.email}`.toLowerCase().includes(q)
      const coincideAcceso = filtroAcceso === 'todas'
        || (filtroAcceso === 'habilitadas' && persona.desafio_socias_habilitada)
        || (filtroAcceso === 'pendientes' && !persona.desafio_socias_habilitada && persona.desafio_socias_estado === 'pendiente')
        || (filtroAcceso === 'rechazadas' && ['rechazada', 'bloqueada'].includes(persona.desafio_socias_estado))
      return coincideBusqueda && coincideAcceso
    })
  }, [busqueda, filtroAcceso, inscriptas])

  async function ejecutar(perfilId: string, accion: 'habilitar' | 'bloquear' | 'rechazar' | 'reenviar_bienvenida') {
    setEnCurso(perfilId)
    setAviso('')
    try {
      const response = await fetch('/api/admin/desafio/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfilId, accion }),
      })
      const data = await response.json()
      if (!response.ok) setAviso(data.error ?? 'No se pudo actualizar el acceso.')
      else if (data.aviso) setAviso(data.aviso)
      else setAviso(data.emailEnviado ? 'Acceso actualizado y bienvenida enviada.' : 'Acceso actualizado.')
      router.refresh()
    } catch {
      setAviso('No pudimos conectar con el servidor. Intentá nuevamente.')
    } finally {
      setEnCurso(null)
    }
  }

  async function cambiarEstrategia(perfilId: string, habilitada: boolean) {
    if (enCurso) return
    setEnCurso(perfilId)
    setAviso('')
    try {
      const respuesta = await fetch('/api/admin/estrategia/acceso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfilId, habilitada }),
      })
      const datos = await respuesta.json()
      setAviso(respuesta.ok ? `Estrategia ${habilitada ? 'habilitada' : 'bloqueada'}. El acceso a las clases no cambió.` : datos.error ?? 'No pudimos cambiar el acceso.')
      router.refresh()
    } catch { setAviso('No pudimos conectar con el servidor.') }
    finally { setEnCurso(null) }
  }

  const habilitadas = inscriptas.filter(persona => persona.desafio_socias_habilitada).length
  const pendientes = inscriptas.filter(persona => !persona.desafio_socias_habilitada && persona.desafio_socias_estado === 'pendiente').length
  const rechazadas = inscriptas.filter(persona => ['rechazada', 'bloqueada'].includes(persona.desafio_socias_estado)).length

  return (
    <main className="min-h-screen px-5 py-8 md:px-10" style={{ background: '#F4EFEA', color: '#211c19' }}>
      <div className="mx-auto max-w-5xl">
        <nav className="sd-section-return mb-5 flex items-center justify-between">
          <a href="/admin" className="text-sm font-medium" style={{ color: '#294A38' }}>← Panel de Flor</a>
          <a href="/admin/classroom" className="text-sm text-neutral-500">Gestionar clases</a>
        </nav>
        <AdminSectionMenu />
        <header className="mt-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: '#294A38' }}>Desafío Socias</p>
            <h1 className="mt-2 text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)' }}>Solicitudes de Desafío</h1>
            <p className="mt-2 text-sm text-neutral-600">Revisá cada inscripción. Al habilitarla, se envía el email de bienvenida.</p>
          </div>
          <div className="rounded-2xl px-5 py-4" style={{ background: '#EC9BB6' }}>
            <span className="text-2xl font-bold">{pendientes}</span><span className="ml-2 text-sm">pendientes · {habilitadas} habilitadas</span>
          </div>
        </header>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EC9BB6] bg-[#FFFDFA] p-4"><p className="text-sm text-[#655B56]">¿Buscás una inscripción Farmasi? Esta página muestra solo Desafío Socias.</p><a href="/admin/invitar#solicitudes-farmasi" className="inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-4 py-2 text-sm font-semibold text-white">Revisar solicitudes Farmasi</a></section>
        <div className="my-6">
          <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar por nombre o email…"
            className="w-full max-w-md rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#294A38]" />
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar solicitudes">
            {([
              ['pendientes', `Pendientes · ${pendientes}`],
              ['habilitadas', `Habilitadas · ${habilitadas}`],
              ['rechazadas', `Rechazadas · ${rechazadas}`],
              ['todas', `Todas · ${inscriptas.length}`],
            ] as const).map(([valor, etiqueta]) => (
              <button key={valor} type="button" onClick={() => setFiltroAcceso(valor)}
                aria-pressed={filtroAcceso === valor}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${filtroAcceso === valor ? 'bg-[#294A38] text-white' : 'bg-white text-[#655B56]'}`}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        {aviso && <p role="status" className="mb-4 rounded-xl bg-white px-4 py-3 text-sm">{aviso}</p>}

        <section className="space-y-3">
          {filtradas.map(persona => {
            const busy = enCurso !== null
            return (
              <article key={persona.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{persona.nombre || 'Sin nombre'}</p>
                  <p className="truncate text-sm text-neutral-500">{persona.email || 'Email no disponible'}</p>
                  <p className="mt-1 text-xs text-neutral-400">Registro: {new Date(persona.created_at).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${persona.desafio_socias_habilitada ? 'bg-[#eaf1ec] text-[#294A38]' : 'bg-[#f5f0eb] text-neutral-600'}`}>
                    {persona.desafio_socias_habilitada ? 'Habilitada' : persona.desafio_socias_estado === 'rechazada' ? 'Rechazada' : persona.desafio_socias_estado === 'bloqueada' ? 'Bloqueada' : 'Pendiente'}
                  </span>
                  {persona.desafio_socias_habilitada ? (
                    <>
                      <span className="rounded-full border border-[#EC9BB6] px-3 py-1 text-xs">Estrategia: {persona.estrategia_habilitada ? 'habilitada' : 'bloqueada'}</span>
                      <button disabled={busy} onClick={() => cambiarEstrategia(persona.id, !persona.estrategia_habilitada)} className="rounded-full border border-[#294A38] px-4 py-2 text-xs font-semibold text-[#294A38] disabled:opacity-50">
                        {persona.estrategia_habilitada ? 'Bloquear estrategia' : 'Habilitar estrategia'}
                      </button>
                      {!persona.desafio_socias_bienvenida_enviada_at && (
                        <button disabled={busy} onClick={() => ejecutar(persona.id, 'reenviar_bienvenida')} className="rounded-full border border-[#294A38] px-4 py-2 text-xs font-semibold text-[#294A38] disabled:opacity-50">
                          {busy ? 'Enviando…' : 'Enviar bienvenida'}
                        </button>
                      )}
                      <button disabled={busy} onClick={() => ejecutar(persona.id, 'bloquear')} className="rounded-full border border-black/10 px-4 py-2 text-xs text-neutral-600 disabled:opacity-50">
                        Bloquear
                      </button>
                    </>
                  ) : persona.desafio_socias_estado === 'rechazada' || persona.desafio_socias_estado === 'bloqueada' ? (
                    <button disabled={busy} onClick={() => ejecutar(persona.id, 'habilitar')} className="rounded-full bg-[#294A38] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {busy ? 'Habilitando…' : 'Reactivar y habilitar'}
                    </button>
                  ) : (
                    <button disabled={busy} onClick={() => ejecutar(persona.id, 'habilitar')} className="rounded-full bg-[#294A38] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {busy ? 'Habilitando…' : 'Habilitar y dar bienvenida'}
                    </button>
                  )}
                  {!persona.desafio_socias_habilitada && persona.desafio_socias_estado === 'pendiente' && (
                    <button disabled={busy} onClick={() => ejecutar(persona.id, 'rechazar')} className="rounded-full border border-[#e7ddd5] px-4 py-2 text-xs text-[#746a64] disabled:opacity-50">Rechazar</button>
                  )}
                </div>
              </article>
            )
          })}
          {filtradas.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-500">{filtroAcceso === 'pendientes' && pendientes === 0 ? 'No hay solicitudes pendientes.' : 'No hay inscripciones que coincidan.'}</div>}
        </section>
      </div>
    </main>
  )
}
