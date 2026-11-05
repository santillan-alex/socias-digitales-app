'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ArrowIcon from '@/components/ArrowIcon'
import { esDirectorioAlumnas, filtrarDirectorioAlumnas, resumirDirectorioAlumnas, type CuentaDirectorioAlumna, type DirectorioAlumnas } from '@/lib/admin-student-directory'

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-3 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const campo = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'
type TipoFiltro = 'todas' | 'socia' | 'desafio' | 'gratuito' | 'sin_tipo'
type EstadoFiltro = 'todas' | 'activa' | 'pausada' | 'cancelada' | 'sin_estado'
type AfiliadasFiltro = 'todas' | 'habilitadas' | 'sin_acceso' | 'sin_comprobar'

function nombreTipo(tipo: string | null) {
  return tipo === 'socia' ? 'Socias Digitales' : tipo === 'desafio' ? 'Desafío Socias' : tipo === 'gratuito' ? 'Gratuito' : 'Tipo por revisar'
}
function nombreEstado(estado: string | null) {
  return estado === 'activa' ? 'Activa' : estado === 'pausada' ? 'Pausada' : estado === 'cancelada' ? 'Cancelada' : 'Estado por revisar'
}
function fecha(valor: string | null, conHora = false) {
  if (!valor || !Number.isFinite(Date.parse(valor))) return 'Sin registro'
  return new Date(valor).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}) })
}
function ultimoIngreso(cuenta: CuentaDirectorioAlumna, conHora = false) {
  return cuenta.cuenta_encontrada === null ? 'Sin comprobar' : fecha(cuenta.ultimo_acceso, conHora)
}
function Iniciales({ nombre }: { nombre: string | null }) {
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4CAD8] text-xs font-semibold text-[#211C19]">{(nombre ?? '').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('es-AR') || 'SD'}</span>
}
function EstadoCuenta({ cuenta }: { cuenta: CuentaDirectorioAlumna }) {
  return <span className="inline-flex items-center gap-2 text-xs font-medium"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${cuenta.estado === 'activa' ? 'bg-[#294A38]' : cuenta.estado === 'pausada' ? 'bg-[#EC9BB6]' : 'bg-[#746A64]'}`} />{nombreEstado(cuenta.estado)}</span>
}
function AccesosCuenta({ cuenta }: { cuenta: CuentaDirectorioAlumna }) {
  return <div className="flex min-w-0 flex-wrap gap-2">
    <span className="rounded-full border border-[#EC9BB6] bg-[#F4CAD8] px-2.5 py-1 text-xs font-medium text-[#211C19]">{nombreTipo(cuenta.tipo_usuario)}</span>
    {cuenta.afiliadas_habilitada === true && <span className="rounded-full border border-[#294A38] bg-[#294A38] px-2.5 py-1 text-xs font-medium text-white">Afiliada</span>}
    {cuenta.afiliadas_habilitada === null && <span className="rounded-full border border-[#E7DDD5] px-2.5 py-1 text-xs text-[#746A64]">Afiliadas sin comprobar</span>}
    {cuenta.tipo_usuario === 'desafio' && cuenta.desafio_socias_habilitada !== true && <span className="rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-2.5 py-1 text-xs text-[#746A64]">{cuenta.desafio_socias_habilitada === null ? 'Desafío sin comprobar' : 'Desafío sin habilitar'}</span>}
  </div>
}
function EmailCuenta({ cuenta }: { cuenta: CuentaDirectorioAlumna }) {
  const estado = cuenta.cuenta_encontrada === false ? 'Cuenta de ingreso no encontrada' : cuenta.email_confirmado === true ? 'Email confirmado' : cuenta.email_confirmado === false ? 'Email sin confirmar' : 'Email sin comprobar'
  return <div className="min-w-0"><p className="break-all text-xs leading-5 text-[#746A64]">{cuenta.email || 'Email no disponible'}</p><p className={`mt-0.5 text-[11px] leading-5 ${cuenta.email_confirmado === true ? 'text-[#294A38]' : 'text-[#746A64]'}`}>{estado}</p></div>
}

export default function AlumnasDirectorio({ inicial }: { inicial: DirectorioAlumnas }) {
  const [directorio, setDirectorio] = useState(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<TipoFiltro>('todas')
  const [estado, setEstado] = useState<EstadoFiltro>('todas')
  const [afiliadas, setAfiliadas] = useState<AfiliadasFiltro>('todas')
  const [cargando, setCargando] = useState(false)
  const [seleccionada, setSeleccionada] = useState<CuentaDirectorioAlumna | null>(null)
  const dialogo = useRef<HTMLDialogElement | null>(null)
  const origenFicha = useRef<HTMLButtonElement | null>(null)
  const enCurso = useRef(false)
  const peticion = useRef<AbortController | null>(null)
  useEffect(() => () => peticion.current?.abort(), [])

  const cuentas = directorio.estado === 'lista' ? directorio.cuentas : []
  const resumen = resumirDirectorioAlumnas(directorio)
  const visibles = filtrarDirectorioAlumnas(cuentas, { busqueda, tipo, estado, afiliadas })
  const hayFiltros = Boolean(busqueda || tipo !== 'todas' || estado !== 'todas' || afiliadas !== 'todas')

  function limpiar() { setBusqueda(''); setTipo('todas'); setEstado('todas'); setAfiliadas('todas') }
  function elegirResumen(id: 'total' | 'socias' | 'desafio' | 'gratuitas' | 'afiliadas') {
    limpiar()
    if (id === 'socias') setTipo('socia')
    if (id === 'desafio') setTipo('desafio')
    if (id === 'gratuitas') setTipo('gratuito')
    if (id === 'afiliadas') setAfiliadas('habilitadas')
  }
  function verFicha(cuenta: CuentaDirectorioAlumna, origen: HTMLButtonElement) {
    origenFicha.current = origen
    setSeleccionada(cuenta)
    if (dialogo.current && !dialogo.current.open) dialogo.current.showModal()
  }
  function cerrarFicha() { dialogo.current?.close() }
  async function actualizar() {
    if (enCurso.current) return
    enCurso.current = true; setCargando(true); cerrarFicha(); setSeleccionada(null)
    const controller = new AbortController(); peticion.current = controller
    const limite = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch('/api/admin/alumnas', { cache: 'no-store', signal: controller.signal })
      const data: unknown = await response.json()
      if (!response.ok || !esDirectorioAlumnas(data)) throw new Error('read_failed')
      if (!controller.signal.aborted) setDirectorio(data)
    } catch {
      setDirectorio({ estado: 'error', mensaje: 'No pudimos comprobar las alumnas y sus accesos. Volvé a intentar para ver la información actualizada.' })
    } finally { window.clearTimeout(limite); peticion.current = null; enCurso.current = false; setCargando(false) }
  }

  const tarjetas = [
    { id: 'total' as const, titulo: 'Todas las alumnas', valor: resumen?.total, nota: 'Personas, sin duplicados', tono: 'border-[#EC9BB6] bg-[#FFFDFA] text-[#211C19]' },
    { id: 'socias' as const, titulo: 'Socias', valor: resumen?.socias, nota: 'Socias Digitales', tono: 'border-[#EC9BB6] bg-[#EC9BB6] text-[#211C19]' },
    { id: 'desafio' as const, titulo: 'Desafío', valor: resumen?.desafio, nota: 'Desafío Socias', tono: 'border-[#EC9BB6] bg-[#F4CAD8] text-[#211C19]' },
    { id: 'afiliadas' as const, titulo: 'Afiliadas', valor: resumen?.afiliadas, nota: 'Permiso habilitado', tono: 'border-[#294A38] bg-[#294A38] text-white' },
    { id: 'gratuitas' as const, titulo: 'Gratuitas', valor: resumen?.gratuitas, nota: 'Acceso gratuito', tono: 'border-[#E7DDD5] bg-[#FAF7F3] text-[#211C19]' },
  ]

  return <main className="mx-auto min-w-0 max-w-7xl px-5 py-7 text-[#211C19] sm:px-8 sm:py-9">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Alumnas y accesos</p><h1 className="mt-2 text-4xl sm:text-5xl">Todas las alumnas</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Tu comunidad, sus cuentas y sus accesos en un mismo lugar.</p></div>
      <button type="button" onClick={() => void actualizar()} disabled={cargando} aria-busy={cargando} className={boton}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
    </div>
    {directorio.estado === 'error' ? <section className="mt-6 rounded-[24px] border border-[#EC9BB6] bg-[#FFFDFA] p-6"><h2 className="text-xl font-semibold">No pudimos reunir las alumnas</h2><p role="alert" className="mt-3 text-sm leading-6 text-[#746A64]">{directorio.mensaje}</p><button type="button" disabled={cargando} onClick={() => void actualizar()} className={`${boton} mt-5`}>Reintentar</button></section> : <>
      {directorio.limitado && <p role="alert" className="mt-5 rounded-2xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm leading-6">Esta lectura alcanzó el límite de cuentas. La lista y sus filtros son parciales; los totales quedan sin confirmar.</p>}
      {directorio.errorIdentidades && <p role="alert" className="mt-5 rounded-2xl border border-[#EC9BB6] bg-[#FAF7F3] p-4 text-sm leading-6">No pudimos comprobar los emails y los últimos ingresos. Podés consultar las cuentas y volver a actualizar; esto no significa que falte confirmar un email.</p>}
      {directorio.errorAfiliadas && <p role="alert" className="mt-5 rounded-2xl border border-[#EC9BB6] bg-[#FAF7F3] p-4 text-sm leading-6">Los permisos de Afiliadas están sin comprobar. No los contamos como deshabilitados; actualizá para consultar su estado.</p>}
      <section aria-label="Resumen de alumnas y accesos" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {tarjetas.map(t => <button key={t.id} type="button" disabled={t.valor == null} onClick={() => elegirResumen(t.id)} aria-label={`Ver ${t.titulo}: ${t.valor == null ? 'sin confirmar' : t.valor}`} className={`min-h-32 min-w-0 rounded-[22px] border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:cursor-default sm:p-5 ${t.id === 'total' ? 'col-span-2 md:col-span-4 xl:col-span-1' : ''} ${t.tono}`}><span className="block text-[10px] font-semibold uppercase tracking-[.14em]">{t.titulo}</span><span className="mt-3 block font-impact text-4xl font-semibold tabular-nums">{t.valor ?? '—'}</span><span className="mt-2 block text-xs leading-5">{t.valor == null ? 'Sin confirmar' : t.nota}</span></button>)}
      </section>
      <p className="mt-3 text-xs leading-5 text-[#746A64]">Afiliadas es un acceso adicional: una Socia puede estar en ambos grupos y aparece una sola vez en la lista.</p>
      {resumen && <p className="mt-2 text-xs leading-5 text-[#746A64]">{resumen.activas} activas · {resumen.pausadas} pausadas · {resumen.canceladas} canceladas{resumen.sin_tipo > 0 ? ` · ${resumen.sin_tipo} con tipo por revisar` : ''}{resumen.sin_estado > 0 ? ` · ${resumen.sin_estado} con estado por revisar` : ''}</p>}
      <section aria-label="Filtrar alumnas" className="mt-6 grid min-w-0 gap-4 rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-medium">Buscar alumna<input type="search" value={busqueda} maxLength={200} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre, email, WhatsApp o país" className={campo} /></label>
        <label className="min-w-0 text-xs font-medium">Acceso principal<select value={tipo} onChange={e => setTipo(e.target.value as TipoFiltro)} className={campo}><option value="todas">Todos los accesos</option><option value="socia">Socias Digitales</option><option value="desafio">Desafío Socias</option><option value="gratuito">Gratuito</option><option value="sin_tipo">Tipo por revisar</option></select></label>
        <label className="min-w-0 text-xs font-medium">Afiliadas<select value={afiliadas} onChange={e => setAfiliadas(e.target.value as AfiliadasFiltro)} className={campo}><option value="todas">Todas</option><option value="habilitadas">Habilitadas</option><option value="sin_acceso">Sin habilitar</option><option value="sin_comprobar">Sin comprobar</option></select></label>
        <label className="min-w-0 text-xs font-medium">Estado de la cuenta<select value={estado} onChange={e => setEstado(e.target.value as EstadoFiltro)} className={campo}><option value="todas">Todos los estados</option><option value="activa">Activa</option><option value="pausada">Pausada</option><option value="cancelada">Cancelada</option><option value="sin_estado">Estado por revisar</option></select></label>
      </section>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-xs leading-5 text-[#746A64]">{visibles.length} {visibles.length === 1 ? 'alumna' : 'alumnas'} en esta vista{resumen ? ` · ${resumen.total} en total` : ''}</p>{hayFiltros && <button type="button" onClick={limpiar} className={boton}>Limpiar filtros</button>}</div>
      {visibles.length === 0 ? <section className="mt-4 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6 sm:p-8"><h2 className="text-xl font-semibold">{cuentas.length ? 'No hay coincidencias' : 'Todavía no hay alumnas para mostrar'}</h2><p className="mt-3 text-sm leading-6 text-[#746A64]">{cuentas.length ? 'Probá otro nombre o combiná otros filtros para encontrar a tu alumna.' : 'Las cuentas aparecerán acá cuando se registren en la plataforma.'}</p></section> : <>
        <section aria-label="Alumnas en tarjetas" className="mt-4 space-y-3 lg:hidden">
          {visibles.map(cuenta => <article key={cuenta.id} className="rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-4 sm:p-5"><div className="flex min-w-0 items-start gap-3"><Iniciales nombre={cuenta.nombre} /><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{cuenta.nombre || 'Sin nombre'}</h2><EmailCuenta cuenta={cuenta} /></div></div><div className="mt-4"><AccesosCuenta cuenta={cuenta} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><EstadoCuenta cuenta={cuenta} /><span className="break-words text-xs text-[#746A64]">{cuenta.pais || 'País sin completar'}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="min-w-0"><dt className="text-[#746A64]">Alta</dt><dd className="mt-1 break-words">{fecha(cuenta.created_at)}</dd></div><div className="min-w-0"><dt className="text-[#746A64]">Último ingreso</dt><dd className="mt-1 break-words">{ultimoIngreso(cuenta)}</dd></div></dl><button type="button" onClick={e => verFicha(cuenta, e.currentTarget)} className={`${boton} mt-4 w-full`}>Ver ficha<span className="sr-only"> de {cuenta.nombre || 'Sin nombre'}</span><ArrowIcon /></button></article>)}
        </section>
        <section aria-label="Directorio de alumnas" className="mt-4 hidden rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 lg:block"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Alumnas, accesos asignados y estado de cuenta</caption><thead><tr className="border-b border-[#E7DDD5] text-[10px] font-semibold uppercase tracking-[.14em] text-[#746A64]"><th scope="col" className="pb-3 pr-4">Alumna</th><th scope="col" className="pb-3 pr-4">Accesos</th><th scope="col" className="pb-3 pr-4">Estado</th><th scope="col" className="pb-3 pr-4">Último ingreso</th><th scope="col" className="pb-3"><span className="sr-only">Ficha</span></th></tr></thead><tbody className="divide-y divide-[#E7DDD5]">{visibles.map(cuenta => <tr key={cuenta.id}><th scope="row" className="max-w-[270px] py-4 pr-4 font-normal"><div className="flex min-w-0 items-start gap-3"><Iniciales nombre={cuenta.nombre} /><div className="min-w-0"><p className="break-words font-semibold">{cuenta.nombre || 'Sin nombre'}</p><EmailCuenta cuenta={cuenta} /><p className="mt-1 break-words text-xs text-[#746A64]">{cuenta.pais || 'País sin completar'}</p></div></div></th><td className="max-w-[240px] py-4 pr-4"><AccesosCuenta cuenta={cuenta} /></td><td className="py-4 pr-4"><EstadoCuenta cuenta={cuenta} /></td><td className="py-4 pr-4 text-xs leading-5 text-[#746A64]">{ultimoIngreso(cuenta, true)}</td><td className="py-4 text-right"><button type="button" onClick={e => verFicha(cuenta, e.currentTarget)} className={boton}>Ver ficha<span className="sr-only"> de {cuenta.nombre || 'Sin nombre'}</span><ArrowIcon /></button></td></tr>)}</tbody></table></div></section>
      </>}
    </>}
    <dialog ref={dialogo} aria-labelledby="ficha-directorio-titulo" onClose={() => { setSeleccionada(null); origenFicha.current?.focus() }} onClick={e => { if (e.target === e.currentTarget) cerrarFicha() }} className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-[#211C19] backdrop:bg-[#211C19]/60 sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#E7DDD5] bg-[#FFFDFA] pb-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#294A38]">Ficha de alumna</p><h2 id="ficha-directorio-titulo" className="mt-2 break-words text-xl font-semibold">{seleccionada?.nombre || 'Datos de la cuenta'}</h2></div><button type="button" autoFocus onClick={cerrarFicha} className={boton}>Cerrar</button></div>
      {seleccionada && <div className="min-w-0 pt-5"><AccesosCuenta cuenta={seleccionada} /><div className="mt-4"><EstadoCuenta cuenta={seleccionada} /></div><dl className="mt-5 grid min-w-0 gap-4 text-sm sm:grid-cols-2"><div className="min-w-0 sm:col-span-2"><dt className="text-xs text-[#746A64]">Email de acceso</dt><dd className="mt-1"><EmailCuenta cuenta={seleccionada} /></dd></div>{[
        ['WhatsApp', seleccionada.whatsapp || 'Sin completar'], ['País', seleccionada.pais || 'Sin completar'], ['Alta en la plataforma', fecha(seleccionada.created_at)], ['Último ingreso', ultimoIngreso(seleccionada, true)], ['Afiliadas', seleccionada.afiliadas_habilitada === null ? 'Sin comprobar' : seleccionada.afiliadas_habilitada ? 'Permiso habilitado' : 'Sin habilitar'], ...(seleccionada.tipo_usuario === 'desafio' ? [['Desafío Socias', seleccionada.desafio_socias_habilitada === null ? 'Sin comprobar' : seleccionada.desafio_socias_habilitada ? 'Habilitado' : 'Sin habilitar']] : []),
      ].map(([etiqueta, valor]) => <div key={etiqueta} className="min-w-0"><dt className="text-xs text-[#746A64]">{etiqueta}</dt><dd className="mt-1 break-words leading-6">{valor}</dd></div>)}</dl>
      {['pausada', 'cancelada'].includes(seleccionada.estado || '') && <p className="mt-5 rounded-2xl border border-[#EC9BB6] bg-[#F4EFEA] p-4 text-sm leading-6">La cuenta está {nombreEstado(seleccionada.estado).toLocaleLowerCase('es-AR')}. Los permisos asignados no significan que pueda entrar mientras su cuenta esté suspendida.</p>}
      <section className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><p className="text-xs leading-6 text-[#746A64]">Esta ficha reúne la información de la cuenta. Los cambios se gestionan desde sus apartados.</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/admin#acceso-actividad" className={boton}>Acceso y actividad<ArrowIcon /></Link><Link href="/admin/afiliadas/accesos" className={boton}>Gestionar Afiliadas<ArrowIcon /></Link>{seleccionada.tipo_usuario === 'socia' && <Link href="/admin/socias" className={boton}>Seguimiento de Socias<ArrowIcon /></Link>}</div></section>
      </div>}
    </dialog>
  </main>
}
