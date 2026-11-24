'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { validarOfertaSocias, type OfertaSocias } from '@/lib/socias-offer'

const inputStyle = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#D8CFC8] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'
export default function OfertaSociasEditor() {
  const [oferta, setOferta] = useState<OfertaSocias>({ precioTexto: null, accionUrl: null })
  const [revision, setRevision] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [comprobada, setComprobada] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardada, setGuardada] = useState(false)
  const cambios = useRef(false)
  const montado = useRef(true)
  const leer = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/admin/configuracion/socias', { cache: 'no-store', signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar la propuesta.')
      const leida = validarOfertaSocias(data.oferta)
      if (data.revision !== null && typeof data.revision !== 'string') throw new Error('No pudimos comprobar la versión de la propuesta.')
      if (montado.current && !signal?.aborted) { setOferta(leida); setRevision(data.revision); setComprobada(true); cambios.current = false }
    } catch (cause) {
      if (montado.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : 'No pudimos cargar la propuesta.')
    } finally { if (montado.current && !signal?.aborted) setCargando(false) }
  }, [])
  const cargar = useCallback(async () => {
    setCargando(true); setError(''); setComprobada(false); setGuardada(false)
    await leer()
  }, [leer])
  useEffect(() => {
    montado.current = true
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) void leer(controller.signal) })
    return () => { montado.current = false; controller.abort() }
  }, [leer])
  function editar(campo: keyof OfertaSocias, valor: string) {
    cambios.current = true; setGuardada(false)
    setOferta(prev => ({ ...prev, [campo]: valor || null }))
  }
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (!comprobada || guardando || cargando) return
    let validada: OfertaSocias
    try { validada = validarOfertaSocias(oferta) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisá la propuesta.'); return }
    setGuardando(true); setError(''); setGuardada(false)
    try {
      const response = await fetch('/api/admin/configuracion/socias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oferta: validada, revision }) })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409 && montado.current) setComprobada(false)
        throw new Error(data.error || 'No pudimos guardar. Revisá el estado antes de reintentar.')
      }
      const confirmada = validarOfertaSocias(data.oferta)
      if (typeof data.revision !== 'string' || JSON.stringify(confirmada) !== JSON.stringify(validada)) throw new Error('No pudimos confirmar el guardado. Recargá para comprobar el estado.')
      if (montado.current) { setOferta(confirmada); setRevision(data.revision); cambios.current = false; setGuardada(true) }
    } catch (cause) { if (montado.current) setError(cause instanceof Error ? cause.message : 'No pudimos guardar la propuesta.') }
    finally { if (montado.current) setGuardando(false) }
  }
  return <section aria-labelledby="oferta-socias-titulo" className="rounded-[24px] border border-[#EC9BB6] bg-[#FAF7F3] p-5 text-[#211C19] sm:p-6">
    <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Planes y upgrades</p>
    <h2 id="oferta-socias-titulo" className="mt-2 text-xl font-semibold">Propuesta de Socias Digitales</h2>
    <p className="mt-2 text-sm leading-6 text-[#746A64]">La ven las alumnas que todavía no tienen el plan Socias. El precio y el botón se actualizan desde acá.</p>
    {cargando ? <p role="status" className="mt-5 text-sm">Cargando propuesta…</p> : <form onSubmit={guardar} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Precio y condiciones
        <input className={inputStyle} value={oferta.precioTexto ?? ''} onChange={e => editar('precioTexto', e.target.value)} maxLength={120} disabled={guardando} readOnly={!comprobada} aria-describedby="ayuda-precio-socias" />
      </label>
      <p id="ayuda-precio-socias" className="text-xs leading-5 text-[#746A64]">Se muestra exactamente como lo escribas. Si lo dejás vacío, no se publica ningún precio.</p>
      <label className="block text-sm font-medium">Enlace de inscripción o contacto
        <input type="url" className={inputStyle} value={oferta.accionUrl ?? ''} onChange={e => editar('accionUrl', e.target.value)} maxLength={1500} placeholder="https://" disabled={guardando} readOnly={!comprobada} aria-describedby="ayuda-enlace-socias" />
      </label>
      <p id="ayuda-enlace-socias" className="text-xs leading-5 text-[#746A64]">Usá el enlace vigente para este upgrade. Hasta que lo agregues, el botón de inscripción queda deshabilitado. Guardar esta propuesta no cambia planes ni confirma pagos.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!comprobada || guardando} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar propuesta'}</button>
        <Link href="/socias" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8CFC8] bg-[#FFFDFA] px-5 py-3 text-sm font-medium text-[#294A38]">Ver propuesta</Link>
      </div>
      {guardada && <p role="status" className="text-sm font-medium text-[#294A38]">Propuesta actualizada.</p>}
    </form>}
    {error && <div className="mt-4"><p role="alert" className="text-sm leading-6 text-[#B01B30]">{error}</p><button type="button" disabled={guardando || cargando} onClick={() => { if (!cambios.current || window.confirm('¿Recargar la propuesta guardada y descartar los cambios de este formulario?')) void cargar() }} className="mt-2 min-h-11 rounded-lg px-1 text-sm font-medium text-[#294A38] underline underline-offset-4">Recargar propuesta</button></div>}
  </section>
}
