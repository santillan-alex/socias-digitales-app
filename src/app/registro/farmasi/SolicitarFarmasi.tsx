'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { DESTINO_INGRESO_FARMASI } from '@/lib/farmasi-registration'

type Estado = 'lista' | 'admin' | 'inactiva' | 'sin_confirmar' | 'pendiente' | 'habilitada' | 'error'

const textos: Record<Estado, string> = {
  lista: 'Solicitá acceso a las clases de Socias Farmasi. Flor revisará tu solicitud; tus otros accesos no cambian.',
  admin: 'Tu cuenta es de administración. Podés gestionar las solicitudes desde Invitaciones.',
  inactiva: 'Para enviar una solicitud, tu cuenta tiene que estar activa. Si necesitás ayuda, contactá al equipo de Socias Digitales.',
  sin_confirmar: 'Confirmá el email de tu cuenta antes de solicitar acceso.',
  pendiente: 'Tu solicitud está pendiente. Cuando Flor la apruebe, vas a ver las clases disponibles en tu biblioteca.',
  habilitada: 'Tu acceso a Socias Farmasi está habilitado.',
  error: 'No pudimos comprobar el estado de tu solicitud. Volvé a cargar la página para intentarlo de nuevo.',
}

export default function SolicitarFarmasi({ inicial }: { inicial: Estado }) {
  const [estado, setEstado] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  async function solicitar() {
    if (enviando || estado !== 'lista') return
    setEnviando(true); setError('')
    try {
      const respuesta = await fetch('/api/farmasi/solicitud', { method: 'POST' })
      const dato = await respuesta.json()
      if (!respuesta.ok || !['pendiente', 'habilitada'].includes(dato.estado))
        throw new Error(typeof dato.error === 'string' ? dato.error : 'No pudimos enviar la solicitud.')
      setEstado(dato.estado)
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos enviar la solicitud. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const boton = 'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#294A38] px-5 py-3 font-semibold text-white hover:bg-[#203B2D] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60'
  return <main className="grid min-h-dvh place-items-center bg-[#FAF7F3] px-5 py-10 text-[#171413]">
    <section className="w-full max-w-md rounded-[24px] border border-[#F4CAD8] bg-white p-5 text-center sm:p-8" aria-labelledby="solicitar-farmasi">
      <Image src="/academy-stacked-color.png" alt="Socias Digitales Academy" width={280} height={180} priority className="mx-auto mb-8 h-auto w-40" />
      <h1 id="solicitar-farmasi" className="font-serif text-3xl sm:text-4xl">Socias Farmasi</h1>
      <p role="status" className="mt-4 text-sm leading-6 text-[#655B56]">{textos[estado]}</p>
      {error && <p role="alert" className="mt-5 text-sm text-[#7C1D2A]">{error}</p>}
      <div className="mt-6">
        {estado === 'lista' && <button type="button" disabled={enviando} onClick={() => void solicitar()} className={boton}>{enviando ? 'Enviando…' : 'Solicitar acceso Farmasi'}</button>}
        {estado === 'habilitada' && <Link className={boton} href="/classroom">Ver mis clases</Link>}
        {estado === 'pendiente' && <Link className={boton} href="/inicio">Ir a Inicio</Link>}
        {estado === 'admin' && <Link className={boton} href="/admin/invitar">Revisar solicitudes</Link>}
        {estado === 'sin_confirmar' && <Link className={boton} href={DESTINO_INGRESO_FARMASI}>Ir a Ingresar</Link>}
      </div>
    </section>
  </main>
}
