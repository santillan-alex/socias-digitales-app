'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FarmaciAccessControl from '../alumnas/FarmaciAccessControl'

export type SolicitudFarmasi = { id: string; nombre: string; email: string; fecha: string; activa: boolean }
export type SolicitudesFarmasi = { filas: SolicitudFarmasi[]; hayMas: boolean; pagina: number } | null

const horaArgentina = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' })

export default function FarmasiSolicitudes({ solicitudes }: { solicitudes: SolicitudesFarmasi }) {
  const router = useRouter()
  const [aprobada, setAprobada] = useState(false)
  const [revisando, setRevisando] = useState<string | null>(null)
  return <section aria-labelledby="solicitudes-farmasi" className="rounded-[24px] border border-[#F4CAD8] bg-white p-5 sm:p-6">
    <h2 id="solicitudes-farmasi" className="font-serif text-2xl text-[#171413]">Solicitudes de Socias Farmasi</h2>
    <p className="mt-2 text-sm leading-6 text-[#655B56]">Las inscripciones llegan como Farmasi pendiente. Revisá que el correo corresponda a una alumna Farmasi y aceptá su solicitud para habilitar solo ese acceso.</p>
    {aprobada && <p role="status" className="mt-3 text-sm text-[#294A38]">Acceso Farmasi habilitado.</p>}
    {!solicitudes ? <p role="alert" className="mt-4 text-sm text-[#7C1D2A]">No pudimos verificar las solicitudes. Volvé a cargar esta página.</p>
      : !solicitudes.filas.length ? <p className="mt-4 text-sm text-[#655B56]">No hay solicitudes pendientes.</p>
        : <ul className="mt-4 grid min-w-0 gap-3">{solicitudes.filas.map(fila => <li key={fila.id} className="min-w-0 rounded-2xl border border-[#E7DDD5] bg-white p-4">
          <p className="break-words font-semibold">{fila.nombre}</p>
          <p className="break-all text-sm text-[#655B56]">{fila.email}</p>
          <p className="mt-1 text-xs text-[#655B56]">Solicitó acceso el <time dateTime={fila.fecha}>{horaArgentina.format(new Date(fila.fecha))}</time></p>
          {fila.activa ? <details name="solicitudes-farmasi" className="mt-2" onToggle={event => {
            const abierta = event.currentTarget.open
            setRevisando(actual => abierta ? fila.id : actual === fila.id ? null : actual)
          }}>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#294A38]">Revisar acceso</summary>
            {revisando === fila.id && <FarmaciAccessControl esSolicitud perfilId={fila.id} alCambiar={habilitada => { setAprobada(habilitada); router.refresh() }} />}
          </details> : <p className="mt-2 text-sm text-[#655B56]">No se comprobó una cuenta activa con correo confirmado. Por ahora no se puede habilitar.</p>}
        </li>)}</ul>}
    {solicitudes && (solicitudes.pagina > 1 || solicitudes.hayMas) && <nav aria-label="Páginas de solicitudes Farmasi" className="mt-4 flex flex-wrap gap-2">
      {solicitudes.pagina > 1 && <a href={`?farmasiPagina=${solicitudes.pagina - 1}#solicitudes-farmasi`} className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-[#294A38]">Anteriores</a>}
      {solicitudes.hayMas && <a href={`?farmasiPagina=${solicitudes.pagina + 1}#solicitudes-farmasi`} className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-[#294A38]">Siguientes</a>}
    </nav>}
  </section>
}
