'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import RegistrationPlane from '@/components/RegistrationPlane'
import { DESTINO_INGRESO_FARMASI, FLUJO_FARMASI, RUTA_FARMASI } from '@/lib/farmasi-registration'

export default function RegistroPage() {
  const pathname = usePathname()
  const esDesafio = pathname === '/registro/desafio'
  const esSocias = pathname === '/registro/socias'
  const esFarmasi = pathname === RUTA_FARMASI
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [requiereConfirmacion, setRequiereConfirmacion] = useState(false)
  const [registroEnviado, setRegistroEnviado] = useState(false)
  const [aceptaEmail, setAceptaEmail] = useState(false)

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMensaje('')
    setRequiereConfirmacion(false)
    setRegistroEnviado(false)

    try {
      const response = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email, password, acepta_email: aceptaEmail, tipo_usuario: esDesafio ? 'desafio' : 'gratuito', ...(esFarmasi ? { flujo: FLUJO_FARMASI } : {}) }) })
      const result = await response.json()
      if (!response.ok) { setRequiereConfirmacion(response.status === 502); setError(result.error || 'No pudimos crear la cuenta. Intentá nuevamente.'); return }
      setRequiereConfirmacion(true)
      setRegistroEnviado(true)
      setMensaje(esDesafio
        ? 'Revisá tu correo para confirmar la cuenta. Flor habilitará tu acceso al Desafío Socias; cuando lo haga, vas a recibir la bienvenida y podrás entrar a lanzamiento y clases.'
        : esFarmasi
          ? 'Confirmá tu correo para enviar tu solicitud a Socias Farmasi. Si ya tenés una cuenta confirmada, ingresá con tu contraseña.'
          : esSocias
          ? 'Revisá tu correo para confirmar la cuenta. Tu cuenta se crea con acceso gratuito; Flor activará tu plan Socias desde tu ficha.'
          : 'Revisá tu correo para confirmar la cuenta. Si ya te registraste y confirmaste antes, ingresá con tu contraseña desde el login.')
    } catch { setError('Revisá tu conexión e intentá nuevamente.') }
    finally { setLoading(false) }
  }

  async function reenviarConfirmacion() {
    if (!email) {
      setError('Escribí el email con el que creaste la cuenta para reenviar la confirmación.')
      return
    }

    setReenviando(true)
    setError('')
    try {
      const response = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, resend: true, ...(esFarmasi ? { flujo: FLUJO_FARMASI } : {}) }) })
      const result = await response.json()
      if (!response.ok) setError(result.error || 'No pudimos reenviar el correo.')
      else setMensaje('Si tu cuenta está pendiente, enviamos la confirmación. Revisá también Spam y Promociones. Si ya confirmaste, podés ingresar.')
    } catch { setError('Revisá tu conexión e intentá nuevamente.') }
    finally { setReenviando(false) }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F3] text-[#171413] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#F4CAD8] px-12 py-10 lg:flex xl:px-20">
        <Image src="/academy-stacked-color.png" alt="Socias Digitales Academy" width={420} height={280} priority className="h-auto w-52 object-contain object-left" />
        <div className="relative z-10 max-w-xl pb-10">
          <p className="mb-4 font-impact text-xs font-semibold uppercase tracking-[0.18em] text-[#294A38]">{esDesafio ? 'Desafío Socias' : esFarmasi ? 'Socias Farmasi' : 'Socias Digitales'}</p>
          <h1 className="font-serif text-5xl leading-[1.04] tracking-[-0.04em] text-[#171413] xl:text-6xl">
            Un paso a la vez. <span className="text-[#294A38]">A tu manera.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#51443F]">
            {esDesafio ? 'Registrate para participar del Desafío Socias.' : esSocias ? 'Creá tu cuenta para que Flor pueda habilitar tu plan Socias.' : esFarmasi ? 'Creá tu cuenta para solicitar acceso a Socias Farmasi.' : 'Creá tu cuenta gratuita y recibí la bienvenida.'}
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 text-center lg:hidden">
            <Image src="/academy-stacked-color.png" alt="Socias Digitales Academy" width={280} height={180} priority className="mx-auto h-auto w-44 object-contain" />
          </div>

          <div className="mb-8">
            <p className="mb-3 font-impact text-xs font-semibold uppercase tracking-[0.16em] text-[#294A38]">{esDesafio ? 'Desafío Socias' : esSocias ? 'Plan Socias' : esFarmasi ? 'Socias Farmasi' : 'Acceso gratuito'}</p>
            <h2 className="font-serif text-4xl leading-tight tracking-[-0.035em] text-[#171413]">Crear <span className="italic text-[#294A38]">cuenta.</span></h2>
            <p className="mt-3 text-sm leading-6 text-[#655B56]">{esSocias ? 'Completá tus datos. El plan Socias se activa cuando Flor lo habilita; registrarte no realiza una compra.' : esFarmasi ? 'Creá tu cuenta. Al confirmar tu email, tu solicitud se enviará a Flor para que la revise.' : 'Completá tus datos para registrarte.'}</p>
          </div>

          <form onSubmit={handleRegistro} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="mb-2 block text-sm font-medium text-[#3C332F]">Nombre completo</label>
              <input id="signup-name" type="text" required autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" className="w-full rounded-xl border border-[#D8CFC8] bg-white px-4 py-3.5 text-[#171413] outline-none transition focus:border-[#294A38] focus:ring-2 focus:ring-[#294A38]/10" />
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-[#3C332F]">Email</label>
              <input id="signup-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" className="w-full rounded-xl border border-[#D8CFC8] bg-white px-4 py-3.5 text-[#171413] outline-none transition focus:border-[#294A38] focus:ring-2 focus:ring-[#294A38]/10" />
            </div>

            <div>
              <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-[#3C332F]">Contraseña</label>
              <input id="signup-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full rounded-xl border border-[#D8CFC8] bg-white px-4 py-3.5 text-[#171413] outline-none transition focus:border-[#294A38] focus:ring-2 focus:ring-[#294A38]/10" />
            </div>

            {error && <p role="alert" className="rounded-xl border border-[#B01B30]/20 bg-[#F4CAD8]/35 px-4 py-3 text-sm text-[#7C1D2A]">{error}</p>}
            {(mensaje || requiereConfirmacion) && <div role="status" className="rounded-xl border border-[#294A38]/15 bg-[#F4EFEA] px-4 py-3 text-sm leading-6 text-[#294A38]">
              <p>{mensaje}</p>
              {requiereConfirmacion && <button type="button" onClick={reenviarConfirmacion} disabled={reenviando} className="mt-2 font-semibold underline underline-offset-4 disabled:opacity-60">
                {reenviando ? 'Reenviando…' : 'No me llegó: reenviar correo'}
              </button>}
            </div>}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#EC9BB6]/50 p-4 text-sm leading-6 text-[#51443F]">
              <input type="checkbox" checked={aceptaEmail} disabled={loading || registroEnviado} onChange={e => setAceptaEmail(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#294A38]" />
              <span>Acepto recibir por email avisos de clases, recordatorios y novedades de Socias Digitales.<span className="mt-1 block text-xs leading-5 text-[#655B56]">Es opcional. Podés cambiarlo desde tu perfil o darte de baja en cada correo.</span></span>
            </label>
            <p className="text-xs leading-5 text-[#655B56]">Los avisos también aparecen dentro de la plataforma. Los correos para confirmar o recuperar tu cuenta se envían aunque no marques esta casilla.</p>
            <div className={`sd-registration-submit ${registroEnviado ? 'sd-registration-success' : ''}`}>
              <button type="submit" disabled={loading || registroEnviado} className="mt-2 w-full rounded-xl bg-[#294A38] px-5 py-3.5 font-impact text-sm font-semibold text-white transition-colors hover:bg-[#203B2D] disabled:opacity-80">
                {loading ? 'Creando cuenta…' : registroEnviado ? 'Registro enviado ✓' : 'Crear mi cuenta'}
              </button>
              {registroEnviado && <RegistrationPlane />}
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-[#655B56]">
            ¿Ya tenés cuenta? <a href={esFarmasi ? DESTINO_INGRESO_FARMASI : '/login'} className="font-medium text-[#294A38] underline decoration-[#EC9BB6] underline-offset-4">Ingresá acá</a>
          </p>
          {!esDesafio && !esSocias && !esFarmasi && <p className="mt-3 text-center text-sm text-[#655B56]">¿Te inscribís al Desafío Socias? <a href="/registro/desafio" className="font-medium text-[#294A38] underline decoration-[#EC9BB6] underline-offset-4">Registrate por acá</a></p>}
        </div>
      </section>
    </main>
  )
}
