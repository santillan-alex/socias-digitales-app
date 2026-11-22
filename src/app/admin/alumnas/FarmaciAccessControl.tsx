'use client'

import { useEffect, useRef, useState } from 'react'

const endpoint = '/api/admin/farmaci/acceso'
type Acceso = { habilitada: boolean; elegible: boolean }
const boton = 'inline-flex min-h-11 items-center rounded-full border border-[#294A38] px-4 py-2 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50'

async function leerRespuesta(response: Response): Promise<Acceso> {
  const data = await response.json()
  if (!response.ok || typeof data.habilitada !== 'boolean' || typeof data.elegible !== 'boolean')
    throw new Error(typeof data.error === 'string' ? data.error : 'No pudimos comprobar el acceso.')
  return { habilitada: data.habilitada, elegible: data.elegible }
}

export default function FarmaciAccessControl({ perfilId }: { perfilId: string }) {
  const [acceso, setAcceso] = useState<Acceso | null>(null), [estado, setEstado] = useState('')
  const [ocupado, setOcupado] = useState(true), [intento, setIntento] = useState(0)
  const solicitud = useRef<AbortController | null>(null), mutando = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    async function leer() {
      try {
        const datos = await leerRespuesta(await fetch(endpoint + '?perfilId=' + encodeURIComponent(perfilId), { cache: 'no-store', signal: controller.signal }))
        if (!controller.signal.aborted) setAcceso(datos)
      } catch (error) {
        if (!controller.signal.aborted) setEstado(error instanceof Error ? error.message : 'No pudimos comprobar el acceso.')
      } finally { if (!controller.signal.aborted) setOcupado(false) }
    }
    void leer()
    return () => { controller.abort(); solicitud.current?.abort() }
  }, [perfilId, intento])

  async function cambiar() {
    if (!acceso || mutando.current || ocupado) return
    const habilitada = !acceso.habilitada
    if (!habilitada && !window.confirm('¿Quitar el acceso a Socias Farmaci? Sus avances quedan guardados.')) return
    const controller = new AbortController()
    solicitud.current = controller
    mutando.current = true; setOcupado(true); setEstado('')
    try {
      const datos = await leerRespuesta(await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfilId, habilitada }), signal: controller.signal }))
      if (!controller.signal.aborted) { setAcceso(datos); setEstado(datos.habilitada ? 'Acceso habilitado.' : 'Acceso retirado. Se conservaron sus avances.') }
    } catch (error) {
      if (!controller.signal.aborted) { setAcceso(null); setEstado(error instanceof Error ? error.message : 'No pudimos confirmar el cambio.') }
    } finally {
      mutando.current = false
      if (!controller.signal.aborted) setOcupado(false)
    }
  }

  return <section aria-label="Acceso Socias Farmaci" className="mt-5 space-y-3 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4" aria-busy={ocupado}>
    <h3 className="text-base font-semibold">Socias Farmaci</h3>
    <p className="text-sm leading-6 text-[#746A64]">Permite ver clases exclusivas. No cambia el plan ni los otros accesos.</p>
    {acceso ? <><p className="text-sm">{acceso.habilitada ? acceso.elegible ? 'Habilitado' : 'Asignado, pero la cuenta no está activa' : 'Sin habilitar'}</p>
      <button type="button" className={boton} disabled={ocupado || !acceso.elegible && !acceso.habilitada} onClick={() => void cambiar()}>{acceso.habilitada ? 'Quitar acceso Farmaci' : 'Habilitar acceso Farmaci'}</button></> :
      ocupado ? <p className="text-sm">Comprobando acceso…</p> :
      <button type="button" className={boton} onClick={() => { setEstado(''); setOcupado(true); setIntento(n => n + 1) }}>Volver a comprobar</button>}
    {estado && <p role={acceso ? 'status' : 'alert'} className="text-sm leading-6">{estado}</p>}
  </section>
}
