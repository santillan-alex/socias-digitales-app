'use client'

import { useState } from 'react'

import { RUTA_FARMASI } from '@/lib/farmasi-registration'

export const invitationLinks = [
  { label: 'Gratuito', path: '/registro', note: 'Acceso libre a las funciones gratuitas.' },
  { label: 'Desafío Socias', path: '/registro/desafio', note: 'La solicitud queda pendiente de tu aprobación.' },
  { label: 'Socias', path: '/registro/socias', note: 'Crean su cuenta. Después activá Socias desde su ficha en Acceso y actividad.' },
  { label: 'Socias Farmasi', path: RUTA_FARMASI, note: 'Al registrarse y confirmar el email, se envía una solicitud de Farmasi. Aprobala en Invitaciones; después entrará a sus clases Farmasi desde este mismo enlace.' },
] as const

export default function InvitationLinks() {
  const [copiado, setCopiado] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function copiar(path: string) {
    setCopiado(null)
    setError('')
    try {
      await navigator.clipboard.writeText('https://app.sociasdigitales.com' + path)
      setCopiado(path)
    } catch {
      setError('No se pudo copiar automáticamente. Seleccioná el enlace y copialo.')
    }
  }

  return (
    <section aria-label="Enlaces de invitación" className="rounded-[24px] border border-[#F4CAD8] bg-white p-5 sm:p-6">
      <h2 className="font-serif text-2xl text-[#171413]">Invitá a tu comunidad</h2>
      <div className="mt-4 grid gap-3">
        {invitationLinks.map(item => (
          <div key={item.path} className="rounded-2xl border border-[#F4CAD8] bg-[#FAF7F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#171413]">{item.label}</h3>
              <button type="button" onClick={() => copiar(item.path)} aria-label={'Copiar enlace de ' + item.label} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#294A38] px-4 py-2 text-xs font-semibold text-white hover:bg-[#203B2D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294A38]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>
                {copiado === item.path ? 'Copiado ✓' : 'Copiar'}
              </button>
            </div>
            <input aria-label={'Enlace de ' + item.label} readOnly value={'https://app.sociasdigitales.com' + item.path} onFocus={event => event.currentTarget.select()} className="mt-3 w-full min-w-0 rounded-lg border border-[#F4CAD8] bg-white px-3 py-2 text-base text-[#294A38] sm:text-sm focus:outline-2 focus:outline-[#EC9BB6]" />
            <p className="mt-2 text-xs leading-5 text-[#655B56]">{item.note}</p>
          </div>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-[#294A38]">{error || (copiado ? 'Enlace copiado. Ya podés compartirlo.' : '')}</p>
    </section>
  )
}
