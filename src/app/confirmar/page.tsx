'use client'

import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { DESTINO_INGRESO_FARMASI, destinoConfirmacion, FLUJO_FARMASI } from '@/lib/farmasi-registration'
import { continuarAutenticacionFarmasi } from '@/lib/farmasi-request-client'
import { createClient } from '@/lib/supabase/client'

function suscribirFragmento(notificar: () => void) {
  window.addEventListener('hashchange', notificar)
  return () => window.removeEventListener('hashchange', notificar)
}

function esConfirmacionFarmasi() {
  return new URLSearchParams(window.location.hash.slice(1)).get('flow') === FLUJO_FARMASI
}

export default function ConfirmarPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const esFarmasi = useSyncExternalStore(suscribirFragmento, esConfirmacionFarmasi, () => false)
  async function confirmar() {
    setLoading(true)
    const params = new URLSearchParams(window.location.hash.slice(1))
    const tokenHash = params.get('token_hash')
    const flujo = params.get('flow')
    const recovery = flujo === 'recovery'
    const invite = flujo === 'invite'
    if (!tokenHash) { setError('El enlace no es válido. Pedí otro correo desde el registro.'); setLoading(false); return }
    try {
      const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type: recovery ? 'recovery' : invite ? 'invite' : 'email' })
      if (error) { setError('El enlace venció o ya fue usado. Pedí otro correo desde Ingresar → Reenviar confirmación.'); return }
      window.history.replaceState(null, '', '/confirmar')
      window.location.replace(flujo === FLUJO_FARMASI ? await continuarAutenticacionFarmasi() : destinoConfirmacion(flujo))
    } catch {
      setError('No pudimos conectar. Volvé a intentar; si el enlace venció, reenviá la confirmación desde Ingresar.')
    } finally {
      setLoading(false)
    }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#FAF7F3] px-5 text-[#171413]">
    <section className="w-full max-w-md text-center">
      <Image src="/academy-stacked-color.png" alt="Socias Digitales Academy" width={280} height={180} priority className="mx-auto mb-8 h-auto w-48" />
      <h1 className="font-serif text-4xl">Confirmá tu cuenta</h1>
      <p className="mt-4 text-sm text-[#655B56]">{esFarmasi ? 'Confirmá tu email para completar tu inscripción a Socias Farmasi. Flor revisará tu solicitud antes de habilitar las clases.' : 'Un último paso para verificar tu email.'}</p>
      {error && <p role="alert" className="mt-5 text-sm text-[#B01B30]">{error}</p>}
      <button onClick={confirmar} disabled={loading} className="mt-7 w-full rounded-xl bg-[#294A38] px-6 py-4 font-semibold text-white disabled:opacity-60">{loading ? 'Confirmando…' : esFarmasi ? 'Confirmar inscripción Farmasi' : 'Confirmar mi cuenta'}</button>
      <a href={esFarmasi ? DESTINO_INGRESO_FARMASI : '/login'} className="mt-5 block text-sm text-[#294A38] underline">Ya confirmé: ingresar</a>
    </section>
  </main>
}
