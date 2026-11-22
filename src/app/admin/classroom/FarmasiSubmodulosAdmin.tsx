'use client'

import { useRef, useState, type FormEvent } from 'react'
import { esListaSubmodulosFarmasi, type SubmoduloFarmasi } from '@/lib/farmasi-submodules'

type Accion = { accion: 'crear'; nombre: string } | { accion: 'mover'; id: string; direccion: 'arriba' | 'abajo' }
const boton = 'min-h-11 rounded-full border border-[#294A38]/30 px-4 py-2 text-sm font-medium text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 aria-disabled:opacity-50'

export default function FarmasiSubmodulosAdmin({ submodulos, errorCarga, alActualizar, alReintentar, alNuevaClase }: {
  submodulos: SubmoduloFarmasi[]
  errorCarga: boolean
  alActualizar: (submodulos: SubmoduloFarmasi[]) => void
  alReintentar: () => void
  alNuevaClase: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const ocupado = useRef(false)

  async function cambiar(cambio: Accion) {
    if (errorCarga || ocupado.current) return
    ocupado.current = true
    setGuardando(true); setMensaje(''); setError('')
    try {
      const respuesta = await fetch('/api/admin/farmasi/submodulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambio),
      })
      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(typeof datos?.error === 'string' ? datos.error : 'No pudimos guardar el cambio.')
      if (!esListaSubmodulosFarmasi(datos?.submodulos))
        throw new Error('No pudimos confirmar el cambio. Recargá antes de reintentar.')
      alActualizar(datos.submodulos)
      if (cambio.accion === 'crear') setNombre('')
      setMensaje(cambio.accion === 'crear' ? 'Submódulo creado.' : 'Orden actualizado.')
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos guardar el cambio.')
    } finally {
      ocupado.current = false
      setGuardando(false)
    }
  }

  function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (limpio) void cambiar({ accion: 'crear', nombre: limpio })
  }

  return <section aria-labelledby="farmasi-submodulos-titulo" className="mt-6 min-w-0 rounded-3xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id="farmasi-submodulos-titulo" className="font-serif text-2xl">Submódulos de Socias Farmasi</h2>
        <p className="mt-2 text-sm leading-6 text-[#655B56]">Organizá las clases exclusivas por tema. Podés elegir el submódulo desde la ficha de cada clase.</p>
      </div>
      <button type="button" onClick={alNuevaClase} className={boton}>Nueva clase Farmasi</button>
    </div>
    {errorCarga ? <div className="mt-4 flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-[#B01B30]">No pudimos cargar los submódulos. Las clases y sus accesos no cambiaron.</p>
      <button type="button" onClick={alReintentar} className={boton}>Reintentar</button>
    </div> : <div aria-busy={guardando}>
      <form onSubmit={crear} className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm">Nombre del submódulo
          <input required maxLength={75} value={nombre} onChange={e => setNombre(e.target.value)} disabled={guardando}
            className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base" />
        </label>
        <button type="submit" disabled={guardando || !nombre.trim()} className={boton}>Crear submódulo</button>
      </form>
      {!submodulos.length ? <p className="mt-4 text-sm text-[#655B56]">Todavía no creaste submódulos.</p> :
        <ol className="mt-4 grid gap-2" aria-label="Orden de los submódulos Farmasi">
          {submodulos.map((submodulo, i) => <li key={submodulo.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E7DDD5] bg-white p-3">
            <span className="min-w-0 flex-1 basis-32 break-words [overflow-wrap:anywhere] text-sm font-medium">{i + 1}. {submodulo.nombre}</span>
            <div className="flex max-w-full flex-wrap gap-2">
              {(['arriba', 'abajo'] as const).map(direccion => {
                const bloqueado = guardando || (direccion === 'arriba' ? i === 0 : i === submodulos.length - 1)
                return <button key={direccion} type="button" aria-disabled={bloqueado} aria-label={`Mover ${submodulo.nombre} ${direccion}`}
                  onClick={() => { if (!bloqueado) void cambiar({ accion: 'mover', id: submodulo.id, direccion }) }} className={boton}>
                  {direccion === 'arriba' ? '↑ Subir' : '↓ Bajar'}
                </button>
              })}
            </div>
          </li>)}
        </ol>}
    </div>}
    {guardando && <p role="status" className="mt-3 text-sm text-[#655B56]">Guardando cambios…</p>}
    {mensaje && <p role="status" className="mt-3 text-sm text-[#294A38]">{mensaje}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-[#B01B30]">{error}</p>}
  </section>
}
