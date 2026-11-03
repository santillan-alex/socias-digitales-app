'use client'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import InvitationLinks from '@/components/InvitationLinks'

import { useState } from 'react'

type Resultado = { email: string; ok: boolean; mensaje: string }

export default function InvitarCliente() {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [error, setError] = useState('')

  const emails = texto
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'))

  async function enviar() {
    if (emails.length === 0) return
    setEnviando(true)
    setResultados([])
    setError('')
    try {
      const res = await fetch('/api/invitar-alumnas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudieron enviar las invitaciones.')
      setResultados(data.resultados ?? [])
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos conectar con el servidor.')
    } finally {
      setEnviando(false)
    }
  }

  const exitosas = resultados.filter(r => r.ok).length
  const fallidas = resultados.filter(r => !r.ok).length

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#171413]">
      <nav data-admin-section-header="true" className="flex items-center justify-between border-b border-[#e7ddd5] px-6 py-4">
        <img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
        <a href="/admin" className="text-sm font-medium text-[#294A38]">← Volver al panel</a>
      </nav>
      <AdminSectionMenu />

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8 sm:px-8">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#294A38]">Tu comunidad</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em]">Invitaciones</h1>
        </header>
        <InvitationLinks />
        <details className="rounded-2xl border border-[#EC9BB6]/50 bg-white p-5 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-[#294A38]">Enviar invitaciones al Desafío por email</summary>
          <p className="mt-3 text-sm leading-6 text-[#655B56]">Pegá los emails y les llegará una invitación para crear su cuenta del Desafío Socias.</p>
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="emails-invitaciones" className="mb-2 block text-sm font-medium text-[#171413]">
              Emails (uno por línea, o separados por coma)
            </label>
            <textarea
              id="emails-invitaciones"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={10}
              placeholder={"alumna1@gmail.com\nalumna2@gmail.com\nalumna3@hotmail.com"}
              className="w-full resize-none rounded-xl border border-[#e7ddd5] bg-[#FAF7F3] px-4 py-3 text-sm text-[#171413] focus:outline-none focus:ring-2 focus:ring-[#EC9BB6]"
            />
          </div>

          {emails.length > 0 && (
            <p className="text-sm text-gray-500">
              {emails.length} email{emails.length !== 1 ? 's' : ''} detectado{emails.length !== 1 ? 's' : ''}
            </p>
          )}

          <button
            onClick={enviar}
            disabled={enviando || emails.length === 0}
            className="w-full rounded-full bg-[#294A38] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#203a2c] disabled:opacity-50"
          >
            {enviando ? `Enviando invitaciones...` : `Enviar ${emails.length} invitación${emails.length !== 1 ? 'es' : ''}`}
          </button>
        </div>

        {error && <p role="alert" className="rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] px-4 py-3 text-sm text-[#211c19]">{error}</p>}

        {resultados.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
            <div className="flex gap-4 mb-2">
              {exitosas > 0 && <span className="text-sm font-bold text-green-600">✓ {exitosas} enviadas</span>}
              {fallidas > 0 && <span className="text-sm font-bold text-red-500">✗ {fallidas} con error</span>}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {resultados.map(r => (
                <div key={r.email} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${r.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="font-medium text-gray-700">{r.email}</span>
                  <span className={r.ok ? 'text-green-600' : 'text-red-500'}>{r.ok ? '✓ Enviada' : `✗ ${r.mensaje}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </details>
      </main>
    </div>
  )
}
