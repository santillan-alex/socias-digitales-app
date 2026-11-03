'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TIPOS_ACCESO, tipoAcceso, contarTipos, filtrarUsuarias, type TipoAcceso } from '@/lib/admin-usuarias'
import { versionFicha } from '@/lib/admin-profile-update'

interface Alumna {
  id: string
  nombre: string
  avatar_url: string | null
  progreso: number
  rol: string
  tipo_usuario: string | null
  desafio_socias_habilitada: boolean
  desafio_socias_estado: string
  desafio_socias_habilitada_at: string | null
  desafio_socias_habilitada_por: string | null
  estado: string
  plan: string
  whatsapp: string | null
  pais: string | null
  created_at: string
  ultimo_acceso: string | null
  email?: string | null
  email_confirmado?: boolean | null
  cuenta_encontrada?: boolean | null
}

interface Stats {
  totalAlumnas: number
  activas: number
  nuevasHoy: number
  nuevasMes: number
  canceladas: number
  pausadas: number
  mrr: number
  facturacionHistorica: number
  afiliadasActivas: number
  ventasMes: number
  comisionesMes: number
  retencion: number
  solicitudesDesafioPendientes: number
  fechaReferencia: number
}

interface Props {
  alumnas: Alumna[]
  stats: Stats
  errorDirectorio?: boolean
}

function diasSinIngresar(ultimoAcceso: string | null, fechaReferencia: number) {
  if (!ultimoAcceso) return '—'
  const diff = fechaReferencia - new Date(ultimoAcceso).getTime()
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
  return dias === 0 ? 'Hoy' : `${dias}d`
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: '2-digit' })
}

function etiquetaTipoUsuario(tipo: string | null | undefined) {
  if (tipo === 'desafio') return 'Desafío Socias'
  if (tipo === 'socia') return 'Socia'
  return 'Gratuito'
}

function EmailCuenta({ alumna, errorDirectorio }: { alumna: Alumna; errorDirectorio: boolean }) {
  const estado = errorDirectorio ? 'Estado del email sin verificar'
    : alumna.cuenta_encontrada === false ? 'Cuenta de acceso no encontrada'
    : alumna.email_confirmado === true ? 'Email confirmado'
    : alumna.email_confirmado === false ? 'Email sin confirmar'
    : 'Estado del email sin verificar'
  const confirmado = !errorDirectorio && alumna.cuenta_encontrada !== false && alumna.email_confirmado === true
  return <div className="mt-1 min-w-0">
    <p className="break-all text-xs leading-5 text-[#746A64]">{alumna.email || 'Email no disponible'}</p>
    <p className={`mt-0.5 text-[11px] leading-5 ${confirmado ? 'text-[#294A38]' : 'text-[#746A64]'}`}>{estado}</p>
  </div>
}

export default function AdminDashboard({ alumnas, stats, errorDirectorio = false }: Props) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState<TipoAcceso | 'todas'>('todas')
  const [alumnaSeleccionada, setAlumnaSeleccionada] = useState<Alumna | null>(null)
  const [editando, setEditando] = useState<Partial<Alumna>>({})
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [errorFicha, setErrorFicha] = useState('')
  const [mensajeFicha, setMensajeFicha] = useState('')
  const operacionEnCurso = useRef(false)

  const alumnasFiltradas = filtrarUsuarias(alumnas, { busqueda, estado: filtroEstado, tipo: filtroTipo })
  const cantidadesTipo = contarTipos(alumnas)
  const baseTipos = filtrarUsuarias(alumnas, { busqueda, estado: filtroEstado, tipo: 'todas' })
  const cantidadesFiltroTipo = contarTipos(baseTipos)
  const baseEstados = filtrarUsuarias(alumnas, { busqueda, estado: 'todas', tipo: filtroTipo })

  function filtrarDesdeResumen(tipo: TipoAcceso) {
    setFiltroTipo(tipo)
    setFiltroEstado('todas')
    setBusqueda('')
    document.getElementById('acceso-actividad')?.scrollIntoView({ block: 'start' })
  }

  const inactivasMes = alumnas.filter(a => {
    if (!a.ultimo_acceso) return true
    return stats.fechaReferencia - new Date(a.ultimo_acceso).getTime() > 30 * 24 * 60 * 60 * 1000
  }).length
  const perfilesIncompletos = alumnas.filter(a => !a.nombre?.trim() || !a.pais).length
  const activasPct = stats.totalAlumnas ? Math.round((stats.activas / stats.totalAlumnas) * 100) : 0

  function abrirFicha(alumna: Alumna) {
    if (operacionEnCurso.current) return
    setAlumnaSeleccionada(alumna)
    setEditando({ ...alumna })
    setErrorFicha('')
    setMensajeFicha('')
    setConfirmarEliminar(false)
  }

  async function guardarFicha() {
    if (!alumnaSeleccionada || operacionEnCurso.current) return
    operacionEnCurso.current = true
    setGuardando(true)
    setErrorFicha('')
    try {
      const cambios = {
        nombre: editando.nombre ?? '', whatsapp: editando.whatsapp ?? null, pais: editando.pais ?? null,
        estado: editando.estado ?? alumnaSeleccionada.estado,
        tipo_usuario: editando.tipo_usuario ?? tipoAcceso(alumnaSeleccionada),
      }
      const respuesta = await fetch(`/api/admin/usuarias/${alumnaSeleccionada.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cambios, esperado: versionFicha(alumnaSeleccionada) }),
        signal: AbortSignal.timeout(20_000),
      })
      const resultado = await respuesta.json()
      if (!respuesta.ok || resultado.ok !== true || resultado.perfil?.id !== alumnaSeleccionada.id) throw new Error(resultado.error || 'No pudimos confirmar el guardado. Recargá la ficha antes de reintentar.')
      setAlumnaSeleccionada(null)
      setMensajeFicha('Ficha guardada. El acceso fue actualizado manualmente; esto no confirma un pago ni envía una bienvenida.')
      router.refresh()
    } catch (error) { setErrorFicha(error instanceof Error && !['TypeError', 'SyntaxError', 'TimeoutError', 'AbortError'].includes(error.name) ? error.message : 'No pudimos confirmar el guardado. Tus cambios siguen acá; recargá la ficha para comprobar su estado antes de reintentar.') }
    finally { operacionEnCurso.current = false; setGuardando(false) }
  }

  async function eliminarAlumna() {
    if (!alumnaSeleccionada || operacionEnCurso.current) return
    operacionEnCurso.current = true
    setEliminando(true)
    setErrorFicha('')
    try {
      const respuesta = await fetch('/api/eliminar-alumna', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alumnaSeleccionada.id }),
        signal: AbortSignal.timeout(20_000),
      })
      const resultado = await respuesta.json()
      if (!respuesta.ok || resultado.ok !== true) throw new Error(resultado.error || 'No pudimos confirmar la eliminación. Recargá la lista antes de reintentar.')
      setConfirmarEliminar(false)
      setAlumnaSeleccionada(null)
      setMensajeFicha('Cuenta eliminada. La eliminación no se puede deshacer desde la plataforma.')
      router.refresh()
    } catch (error) { setErrorFicha(error instanceof Error && !['TypeError', 'SyntaxError', 'TimeoutError', 'AbortError'].includes(error.name) ? error.message : 'No pudimos confirmar la eliminación. Revisá la conexión y recargá la lista antes de reintentar.') }
    finally { operacionEnCurso.current = false; setEliminando(false) }
  }

  return (
    <div className="admin-dashboard min-h-screen bg-[#FAF7F3] text-[#211c19]">
      <div className="mx-auto max-w-[1160px]">
        <main className="min-w-0 space-y-4 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#294A38]">Vista general</p><h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Panel de Flor</h1></div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Usuarias', value: stats.totalAlumnas, note: `+${stats.nuevasMes} este mes`, tone: 'bg-[#F4CAD8] border-transparent' },
              { label: 'Alumnas activas', value: stats.activas, note: `${activasPct}% del total`, tone: 'bg-[#EC9BB6] border-transparent' },
              { label: 'Solicitudes pendientes', value: stats.solicitudesDesafioPendientes, note: 'Desafío Socias', tone: 'bg-[#F4EFEA] border-[#EC9BB6]/55' },
              { label: 'Ventas del mes', value: stats.ventasMes, note: 'Registradas en la plataforma', tone: 'bg-[#294A38] text-white border-transparent' },
            ].map(kpi => <article key={kpi.label} className={`rounded-[22px] border p-5 ${kpi.tone}`}><p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-65">{kpi.label}</p><p className="mt-3 font-impact text-4xl font-semibold tracking-[-0.04em]">{kpi.value}</p><p className="mt-2 text-xs font-medium opacity-65">{kpi.note}</p></article>)}
          </section>

          <section aria-label="Alumnas por tipo de acceso" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TIPOS_ACCESO.map(tipo => <button key={tipo.id} type="button" onClick={() => filtrarDesdeResumen(tipo.id)} aria-label={`Ver ${tipo.etiqueta}: ${cantidadesTipo[tipo.id]}`} className="flex items-center justify-between gap-4 rounded-[20px] border border-[#EC9BB6]/55 bg-[#F4EFEA] px-5 py-4 text-left transition-colors hover:bg-[#F4CAD8]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294A38]">
              <span className="text-sm font-medium">{tipo.etiqueta}</span>
              <span className="font-impact text-3xl font-semibold tabular-nums text-[#294A38]">{cantidadesTipo[tipo.id]}</span>
            </button>)}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-[24px] border border-[#EC9BB6]/55 bg-[#F4EFEA] p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#746a64]">Estado de la comunidad</p><h2 className="mt-1.5 font-serif text-2xl font-semibold">Actividad de alumnas</h2></div><span className="font-impact text-sm font-semibold text-[#294A38]">{stats.totalAlumnas}</span></div>
              <div className="mt-6 flex h-5 overflow-hidden rounded-full bg-white"><div className="bg-[#294A38] transition-all" style={{ width: `${activasPct}%` }} /><div className="bg-[#EC9BB6] transition-all" style={{ width: `${100 - activasPct}%` }} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white px-4 py-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#294A38]"/><span className="text-xs font-semibold">Activas</span></div><p className="mt-2 font-impact text-2xl font-semibold">{stats.activas}</p></div><div className="rounded-xl bg-white px-4 py-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#EC9BB6]"/><span className="text-xs font-semibold">Otras</span></div><p className="mt-2 font-impact text-2xl font-semibold">{Math.max(stats.totalAlumnas - stats.activas, 0)}</p></div></div>
            </article>
            <article className="rounded-[24px] bg-[#F4CAD8] p-5 sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#746a64]">Requieren atención</p><p className="mt-2 font-impact text-4xl font-semibold">{inactivasMes + stats.solicitudesDesafioPendientes}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FAF7F3] text-[#294A38]" aria-hidden="true">!</span></div>
              <div className="mt-5 space-y-2 text-sm"><a href="/admin/desafio" className="flex items-center justify-between rounded-xl bg-[#FAF7F3]/75 px-4 py-3"><span>Solicitudes pendientes</span><strong className="font-impact">{stats.solicitudesDesafioPendientes}</strong></a><div className="flex items-center justify-between rounded-xl bg-[#FAF7F3]/75 px-4 py-3"><span>Sin ingreso reciente</span><strong className="font-impact">{inactivasMes}</strong></div><div className="flex items-center justify-between rounded-xl bg-[#FAF7F3]/75 px-4 py-3"><span>Perfil por completar</span><strong className="font-impact">{perfilesIncompletos}</strong></div></div>
            </article>
          </section>

          <section id="acceso-actividad" className="scroll-mt-5 rounded-[24px] bg-white p-5 sm:p-6">
            {mensajeFicha && <p role="status" className="mb-4 rounded-xl border border-[#294A38]/25 bg-[#F4EFEA] px-4 py-3 text-sm leading-6 text-[#294A38]">{mensajeFicha}</p>}
            {errorDirectorio && <div role="alert" className="mb-4 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8]/35 p-4 text-sm leading-6 text-[#655B56]"><p className="font-semibold text-[#211C19]">No pudimos consultar el directorio de cuentas.</p><p className="mt-1">La lista de alumnas sigue disponible, pero el estado del email no está verificado. No significa que la cuenta no exista o que falte confirmar el correo.</p><a href="/admin" className="mt-2 inline-flex min-h-11 items-center font-semibold text-[#294A38] underline underline-offset-4">Recargar directorio</a></div>}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#746a64]">Usuarias</p><h2 className="mt-1 font-serif text-2xl font-semibold">Acceso y actividad</h2></div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href="/api/exportar-alumnas" download className="text-sm font-medium text-[#294A38]">Descargar lista&nbsp; ↓</a>
                <input type="text" aria-label="Buscar alumnas por nombre, email o país" placeholder="Nombre, email o país" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="min-w-0 w-full rounded-full border-0 bg-[#F4EFEA] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EC9BB6] sm:w-auto" />
              </div>
            </div>

            <div role="group" aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-1.5 rounded-2xl border border-[#EC9BB6]/40 bg-[#F4EFEA] p-1 sm:w-fit sm:rounded-full">
          {[
            { label: 'Todas', valor: 'todas', count: baseEstados.length },
            { label: 'Activas', valor: 'activa', count: baseEstados.filter(a => a.estado === 'activa').length },
            { label: 'Pausadas', valor: 'pausada', count: baseEstados.filter(a => a.estado === 'pausada').length },
            { label: 'Canceladas', valor: 'cancelada', count: baseEstados.filter(a => a.estado === 'cancelada').length },
          ].map(f => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtroEstado === f.valor}
              onClick={() => setFiltroEstado(f.valor)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                filtroEstado === f.valor
                  ? 'bg-[#294A38] text-white'
                  : 'text-[#746a64] hover:bg-white'
              }`}
            >
              {f.label} <span className="ml-1 opacity-70">({f.count})</span>
            </button>
          ))}
            </div>

            <div role="group" aria-label="Filtrar por tipo de acceso" className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-medium text-[#746a64]">Tipo de acceso</span>
              {[{ id: 'todas' as const, etiqueta: 'Todos', cantidad: baseTipos.length }, ...TIPOS_ACCESO.map(tipo => ({ ...tipo, cantidad: cantidadesFiltroTipo[tipo.id] }))].map(tipo => <button key={tipo.id} type="button" aria-pressed={filtroTipo === tipo.id} onClick={() => setFiltroTipo(tipo.id)} className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${filtroTipo === tipo.id ? 'border-[#294A38] bg-[#294A38] text-white' : 'border-[#EC9BB6]/55 bg-[#FAF7F3] text-[#655B56] hover:bg-[#F4CAD8]/40'}`}>{tipo.etiqueta} <span className="ml-1 tabular-nums opacity-75">({tipo.cantidad})</span></button>)}
              <span role="status" aria-live="polite" className="ml-auto text-xs text-[#746a64]">{alumnasFiltradas.length} de {stats.totalAlumnas} alumnas</span>
            </div>

            <div className="mt-4 space-y-3 md:hidden" aria-label="Alumnas en vista móvil">
              {alumnasFiltradas.map(alumna => <article key={alumna.id} className="rounded-[18px] border border-[#e7ddd5] bg-[#FAF7F3] p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {alumna.avatar_url ? <img src={alumna.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4CAD8] text-xs font-semibold">{(alumna.nombre || 'SD').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>}
                  <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{alumna.nombre || 'Sin nombre'}</h3><EmailCuenta alumna={alumna} errorDirectorio={errorDirectorio} /><p className="mt-1 text-xs text-[#746a64]">{alumna.whatsapp || 'Sin teléfono'}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-[#e7ddd5] px-2.5 py-1 text-xs capitalize">{alumna.estado || 'activa'}</span><span className="rounded-full bg-[#F4CAD8] px-2.5 py-1 text-xs">{etiquetaTipoUsuario(tipoAcceso(alumna))}</span></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[#746a64]">País</dt><dd className="mt-1">{alumna.pais || '—'}</dd></div><div><dt className="text-[#746a64]">Ingreso</dt><dd className="mt-1">{formatFecha(alumna.created_at)}</dd></div><div><dt className="text-[#746a64]">Actividad</dt><dd className="mt-1">{diasSinIngresar(alumna.ultimo_acceso, stats.fechaReferencia)}</dd></div><div><dt className="text-[#746a64]">Progreso</dt><dd className="mt-1 tabular-nums">{alumna.progreso ?? 0}%</dd></div></dl>
                <button type="button" onClick={() => abrirFicha(alumna)} className="mt-4 w-full rounded-full border border-[#294A38]/30 px-4 py-3 text-sm font-semibold text-[#294A38]">Ver ficha</button>
              </article>)}
              {!alumnasFiltradas.length && <p className="py-6 text-center text-sm text-[#746a64]">No hay alumnas que coincidan</p>}
            </div>
            <div className="sd-scroll-table mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[860px] text-sm"><thead><tr className="border-b border-[#e7ddd5] text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#746a64]"><th className="pb-3">Alumna</th><th className="pb-3">Estado</th><th className="pb-3">Tipo</th><th className="pb-3">País</th><th className="pb-3">Ingreso</th><th className="pb-3">Actividad</th><th className="pb-3">Progreso</th><th className="pb-3"></th></tr></thead><tbody className="divide-y divide-[#e7ddd5]">
                {alumnasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#746a64]">
                      No hay alumnas que coincidan
                    </td>
                  </tr>
                ) : alumnasFiltradas.map(alumna => (
                  <tr key={alumna.id} className="bg-white transition-colors hover:bg-[#F4CAD8]/20">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        {alumna.avatar_url ? (
                          <img src={alumna.avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="font-impact flex h-9 w-9 items-center justify-center rounded-full bg-[#F4CAD8] text-xs font-semibold">{(alumna.nombre || 'SD').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
                        )}
                        <div>
                          <p className="font-semibold text-[#211c19]">{alumna.nombre || 'Sin nombre'}</p>
                          <EmailCuenta alumna={alumna} errorDirectorio={errorDirectorio} />
                          {alumna.whatsapp && <p className="mt-0.5 text-xs text-[#746a64]">{alumna.whatsapp}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5"><span className="flex items-center gap-2 text-xs font-medium text-[#211c19]"><span className={`h-2 w-2 rounded-full ${alumna.estado === 'activa' ? 'bg-[#294A38]' : alumna.estado === 'pausada' ? 'bg-[#EC9BB6]' : 'bg-[#211c19]/25'}`} />
                        {alumna.estado ?? 'activa'}</span>
                    </td>
                    <td className="py-3.5"><span className="rounded-full bg-[#F4EFEA] px-2.5 py-1 text-xs font-medium">{etiquetaTipoUsuario(tipoAcceso(alumna))}</span></td>
                    <td className="py-3.5 text-xs text-[#746a64]">{alumna.pais ?? '—'}</td>
                    <td className="py-3.5 text-xs text-[#746a64]">{formatFecha(alumna.created_at)}</td>
                    <td className="py-3.5 text-xs text-[#746a64]">{diasSinIngresar(alumna.ultimo_acceso, stats.fechaReferencia)}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#F4EFEA]">
                          <div className="h-full rounded-full bg-[#294A38]" style={{ width: `${Math.max(0, Math.min(Number(alumna.progreso ?? 0), 100))}%` }} />
                        </div>
                        <span className="font-impact text-xs font-semibold">{alumna.progreso ?? 0}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => abrirFicha(alumna)}
                        className="text-xs font-semibold text-[#294A38] hover:underline"
                      >
                        Ver ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody></table></div>
          </section>
        </main>
      </div>

      {/* Modal ficha de alumna */}
      {alumnaSeleccionada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ficha-alumna-titulo">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center gap-3">
              <h3 id="ficha-alumna-titulo" className="text-lg font-bold text-gray-900">Ficha de alumna</h3>
              <button type="button" aria-label="Cerrar ficha" disabled={guardando || eliminando} onClick={() => setAlumnaSeleccionada(null)} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 text-xl disabled:opacity-40">✕</button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-2">
                {alumnaSeleccionada.avatar_url ? (
                  <img src={alumnaSeleccionada.avatar_url} className="w-16 h-16 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-16 h-16 shrink-0 rounded-full bg-[#F4CAD8] flex items-center justify-center font-impact text-xl font-medium text-[#294A38]">{(alumnaSeleccionada.nombre || 'SD').split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}</div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{alumnaSeleccionada.nombre || 'Sin nombre'}</p>
                  <p className="text-sm text-gray-500">Desde {formatFecha(alumnaSeleccionada.created_at)}</p>
                </div>
              </div>

              <section aria-label="Cuenta de acceso" className="min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FAF7F3] p-4">
                <h4 className="text-xs font-semibold text-[#211C19]">Email de acceso · solo consulta</h4>
                <EmailCuenta alumna={alumnaSeleccionada} errorDirectorio={errorDirectorio} />
                <p className="mt-3 text-xs leading-5 text-[#746A64]">Un email confirmado verifica la dirección; no acredita un pago. Desde esta ficha no se envían correos ni se muestran o cambian contraseñas.</p>
              </section>

              <fieldset disabled={guardando || eliminando} className="grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
                {[
                  { label: 'Nombre', key: 'nombre', type: 'text' },
                  { label: 'WhatsApp', key: 'whatsapp', type: 'text' },
                  { label: 'País', key: 'pais', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key} className={key === 'nombre' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`ficha-${key}`} className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <input
                      id={`ficha-${key}`}
                      type={type}
                      value={(editando as Record<string, string>)[key] ?? ''}
                      onChange={e => setEditando(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor="ficha-estado" className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                  <select
                    id="ficha-estado"
                    value={editando.estado ?? 'activa'}
                    onChange={e => setEditando(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="activa">Activa</option>
                    <option value="pausada">Pausada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ficha-tipo" className="block text-xs font-medium text-gray-500 mb-1">Tipo de usuaria</label>
                  <select
                    id="ficha-tipo"
                    value={editando.tipo_usuario ?? tipoAcceso(alumnaSeleccionada)}
                    onChange={e => setEditando(prev => ({ ...prev, tipo_usuario: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="gratuito">Gratuito</option>
                    <option value="desafio">Desafío Socias</option>
                    <option value="socia">Socia</option>
                  </select>
                  {editando.tipo_usuario === 'desafio' && !alumnaSeleccionada.desafio_socias_habilitada && <p className="mt-2 text-xs leading-5 text-[#746a64]">Quedará pendiente. Flor habilita el acceso y envía la bienvenida desde Solicitudes del Desafío.</p>}
                </div>
              </fieldset>
              <div className="rounded-xl border border-[#EC9BB6]/50 bg-[#F4EFEA] p-4 text-sm leading-6 text-[#655B56]">
                <p><strong className="text-[#211c19]">Activación manual.</strong> Asignar Socia y Activa habilita sus clases privadas; no acredita un cobro ni crea una suscripción. Verificá el pago por separado.</p>
                <p className="mt-2">Pausar o cancelar suspende el contenido de pago sin borrar respuestas ni progreso. Los módulos con autorización propia se gestionan desde cada apartado.</p>
              </div>

              {/* Info de solo lectura */}
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Progreso del curso</p>
                  <p className="font-semibold text-gray-800">{alumnaSeleccionada.progreso ?? 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Último acceso</p>
                  <p className="font-semibold text-gray-800">{diasSinIngresar(alumnaSeleccionada.ultimo_acceso, stats.fechaReferencia)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Rol</p>
                  <p className="font-semibold text-gray-800">{etiquetaTipoUsuario(alumnaSeleccionada.tipo_usuario)}</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-100 space-y-3">
              {errorFicha && <p role="alert" className="rounded-xl border border-[#B01B30]/25 bg-[#F4CAD8]/30 px-4 py-3 text-sm leading-6 text-[#B01B30]">{errorFicha}</p>}
              <div className="flex gap-3">
                <button
                  disabled={guardando || eliminando}
                  onClick={() => setAlumnaSeleccionada(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarFicha}
                  disabled={guardando || eliminando}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
              {!confirmarEliminar ? (
                <button
                  disabled={guardando || eliminando}
                  onClick={() => setConfirmarEliminar(true)}
                  className="w-full border border-red-200 text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  🗑️ Eliminar alumna
                </button>
              ) : (
                <div className="bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-700 font-medium text-center">¿Segura? Esta acción no se puede deshacer.</p>
                  <div className="flex gap-2">
                    <button disabled={guardando || eliminando} onClick={() => setConfirmarEliminar(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
                    <button onClick={eliminarAlumna} disabled={guardando || eliminando} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-bold">
                      {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
