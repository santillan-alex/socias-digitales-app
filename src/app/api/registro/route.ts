import { createHmac } from 'node:crypto'
import { EMAIL_HEADER } from '@/lib/email-brand'
import { NextResponse } from 'next/server'
import { createAdminClient, isAdminSupabaseConfigured } from '@/lib/supabase/admin'
import { enviarConfirmacion } from '@/lib/registration-mail'
import { FLUJO_FARMASI } from '@/lib/farmasi-registration'
import { normalizarNombre } from '@/lib/perfil-preguntas'

export const runtime = 'nodejs'
export const maxDuration = 60
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export async function POST(request: Request) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.sociasdigitales.com').replace(/\/$/, '')
  const origin = request.headers.get('origin')
  if (!origin || ![new URL(request.url).origin, site].includes(origin)) {
    return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 403 })
  }
  if (!isAdminSupabaseConfigured() || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'El envío no está disponible. Intentá nuevamente más tarde.' }, { status: 503 })
  }
  let input: Record<string, unknown>
  try { input = await request.json() } catch { return NextResponse.json({ error: 'Revisá tus datos.' }, { status: 400 }) }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const nombre = typeof input.nombre === 'string' ? normalizarNombre(input.nombre) : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const resend = input.resend === true
  const recovery = input.recovery === true
  const farmasi = !recovery && input.flujo === FLUJO_FARMASI
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || (!resend && !recovery && (nombre.length < 2 || nombre.length > 120 || password.length < 6 || password.length > 128))) {
    return NextResponse.json({ error: 'Revisá el nombre, email y contraseña (mínimo 6 caracteres).' }, { status: 400 })
  }
  const admin = createAdminClient()
  const hash = (value: string) => createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(value).digest('hex')
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { data: reservation, error: reserveError } = await admin.rpc('reserve_registration_mail', { p_email: email, p_email_hash: hash(`email:${email}`), p_ip_hash: hash(`ip:${ip}`) })
  if (reserveError) {
    console.error('registration_failed', { stage: 'reservation', code: reserveError.code })
    return NextResponse.json({ error: 'No pudimos procesar el registro. Intentá nuevamente.' }, { status: 503 })
  }
  if (!reservation?.allowed) return NextResponse.json({ error: 'Esperá un minuto antes de pedir otro correo.' }, { status: 429 })
  // Never reset a password, change a membership, or expose account existence.
  if ((!recovery && reservation.confirmed) || ((resend || recovery) && !reservation.exists) || (recovery && !reservation.confirmed)) return NextResponse.json({ ok: true })
  const { data, error } = await admin.auth.admin.generateLink(recovery
    ? { type: 'recovery', email, options: { redirectTo: `${site}/auth/callback?flow=recovery` } }
    : reservation.exists
    ? { type: 'magiclink', email, options: { redirectTo: `${site}/auth/callback` } }
    : { type: 'signup', email, password, options: { data: { nombre, tipo_usuario: input.tipo_usuario === 'desafio' ? 'desafio' : 'gratuito' }, redirectTo: `${site}/auth/callback` } })
  if (error || !data.properties?.hashed_token) {
    console.error('registration_failed', { stage: 'create_access', code: error?.code })
    return NextResponse.json({ error: 'No pudimos crear el acceso. Intentá nuevamente.' }, { status: 503 })
  }
  if (!reservation.exists && data.user?.id && !recovery && !resend) {
    const { error: consentError } = await admin.from('preferencias_email').insert({ usuaria_id: data.user.id, acepta_email: input.acepta_email === true, origen: 'registro' })
    // Missing preference means no optional marketing; never block the access email.
    if (consentError) console.warn('registration_consent_pending', { code: consentError.code })
  }
  // Fragment keeps the one-time token out of server request/access logs. A human
  // clicks Confirmar before consuming it, so email link scanners cannot burn it.
  const link = `${site}/confirmar#token_hash=${encodeURIComponent(data.properties.hashed_token)}${recovery ? '&flow=recovery' : farmasi ? '&flow=' + FLUJO_FARMASI : ''}`
  const challenge = data.user?.user_metadata?.tipo_usuario === 'desafio'
  const firstName = escapeHtml(normalizarNombre(data.user?.user_metadata?.nombre || nombre || 'Socia').split(' ')[0])
  const heading = recovery ? 'Recuperá tu acceso' : 'Confirmá tu cuenta'
  const description = recovery ? 'Recibimos un pedido para recuperar tu acceso. Desde este enlace podés elegir una contraseña nueva.' : challenge ? 'Confirmá tu email para completar tu registro al Desafío Socias. Flor revisará tu inscripción y te enviará la bienvenida cuando habilite tu acceso.' : 'Confirmá tu email para entrar a tu cuenta de Socias Digitales.'
  const html = `<div style="background:#FAF7F3;padding:32px 16px;font-family:Arial,sans-serif;color:#171413"><div style="max-width:560px;margin:auto">${EMAIL_HEADER}<h1 style="font-size:28px;color:#294A38">${heading}</h1><p>Hola, ${firstName}.</p><p>${description}</p><a href="${link}" style="display:block;text-align:center;background:#294A38;color:white;padding:18px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:18px;margin:28px 0">${recovery ? 'RECUPERAR MI ACCESO' : 'CONFIRMAR MI CUENTA'}</a><p style="font-size:13px;color:#655B56">Si no hiciste este pedido, ignorá este correo.</p><p>Un abrazo,<br>Flor</p></div></div>`
  try {
    const sent = await enviarConfirmacion({ from: process.env.RESEND_FROM || 'Flor · Socias Digitales <no-reply@sociasdigitales.com>', to: [email], subject: recovery ? 'Recuperá tu acceso · Socias Digitales' : challenge ? 'Confirmá tu registro al Desafío Socias' : 'Confirmá tu cuenta · Socias Digitales', html,
        text: `Hola, ${firstName}. ${heading}: ${link}\n${description}\nUn abrazo, Flor` }, process.env.RESEND_API_KEY!)
    if (!sent.ok) {
      console.error('registration_email_failed', { status: sent.status })
      return NextResponse.json({ error: 'Tu cuenta quedó guardada, pero no pudimos enviar el correo. Usá reenviar para intentarlo nuevamente.' }, { status: 502 })
    }
    console.info('registration_email_sent', { messageId: sent.messageId, attempts: sent.attempts })
    return NextResponse.json({ ok: true })
  } catch {
    console.error('registration_email_failed', { stage: 'unexpected' })
    return NextResponse.json({ error: 'Tu cuenta quedó guardada. Reintentá el envío del correo en un minuto.' }, { status: 502 })
  }
}
