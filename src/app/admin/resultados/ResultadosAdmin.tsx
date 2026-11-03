'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import NavigationIcon from '@/components/NavigationIcon'
import ResultsDashboard from '@/components/ResultsDashboard'
import { Estado, Captura } from '@/app/resultados/ResultadosCliente'
import { ESTADO_RESULTADO, resumenResultados, dineroResultado, type Resultado, type EstadoResultado } from '@/lib/results'

export interface AccesoResultados { id: string; nombre: string | null; habilitada: boolean; estado: string | null }
export default function ResultadosAdmin({ resultados, socias, periodoActual, errorCarga = false }: { resultados: Resultado[]; socias: AccesoResultados[]; periodoActual:string; errorCarga?: boolean }) {
  const router = useRouter()
  const [estado, setEstado] = useState('todos')
  const [tipo, setTipo] = useState('todos')
  const [pais, setPais] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [cambios, setCambios] = useState<Record<string, EstadoResultado>>({})
  const [accesos, setAccesos] = useState<Record<string, boolean>>({})
  const [alumnaTablero,setAlumnaTablero] = useState('todas')
  const [capturaLista,setCapturaLista] = useState<string|null>(null)
  const bloqueo = useRef(false)
  const actuales = resultados.map(r => ({ ...r, estado: cambios[r.id] ?? r.estado }))
  const resumen = resumenResultados(actuales)
  const detalle = actuales.find(r => r.id === abierto)
  const paises = [...new Set(resultados.map(r => r.pais).filter((p): p is string => Boolean(p)))]
  const tipos = [...new Set(resultados.map(r => r.tipo))]
  const alumnasTablero = [...new Map(resultados.filter(r=>r.alumna_id).map(r=>[r.alumna_id!,r.perfiles?.nombre || 'Alumna'])).entries()]
  const filtrados = actuales.filter(r => (estado === 'todos' || r.estado === estado) && (tipo === 'todos' || r.tipo === tipo) && (!pais || r.pais === pais) && `${r.perfiles?.nombre ?? ''} ${r.descripcion ?? ''}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')))
  async function revisar(r: Resultado, nuevo: EstadoResultado) {
    if (bloqueo.current) return
    bloqueo.current = true; setOcupado(r.id); setError(''); setMensaje('')
    try {
      const response = await fetch('/api/admin/resultados', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, estado: nuevo, anterior: r.estado }) })
      const data = await response.json()
      if (!response.ok || !data.ok) { if (response.status === 409) { setCambios({}); router.refresh() } throw new Error(data.error || 'No pudimos guardar la revisión.') }
      setCambios(prev => ({ ...prev, [r.id]: nuevo })); setMensaje('Revisión guardada.'); router.refresh()
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No pudimos conectarnos. Reintentá la revisión.') }
    finally { setOcupado(null); bloqueo.current = false }
  }
  async function cambiarAcceso(socia: AccesoResultados) {
    if (bloqueo.current) return
    const habilitada = !(accesos[socia.id] ?? socia.habilitada)
    bloqueo.current = true; setOcupado(socia.id); setError(''); setMensaje('')
    try {
      const response = await fetch('/api/admin/resultados/acceso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuaria_id: socia.id, habilitada }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'No pudimos cambiar el acceso.')
      setAccesos(prev => ({ ...prev, [socia.id]: habilitada })); setMensaje(habilitada ? 'Acceso a Resultados habilitado.' : 'Acceso a Resultados cerrado.'); router.refresh()
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No pudimos conectarnos. El acceso no cambió.') }
    finally { setOcupado(null); bloqueo.current = false }
  }
  const selector = 'rounded-full border border-[#e7ddd5] bg-white px-4 py-2 text-sm'
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211c19]">
    <header data-admin-section-header="true" className="flex h-[76px] items-center justify-between border-b border-[#e7ddd5] px-5 sm:px-8"><Link href="/admin"><img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" className="h-11 w-auto" /></Link><Link href="/admin" className="text-sm text-[#294A38]">← Panel de Flor</Link></header>
    <AdminSectionMenu />
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Seguimiento de Socias</p><h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Resultados</h1>
      {errorCarga && <p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">No pudimos cargar toda la información. <button type="button" onClick={() => router.refresh()} className="underline">Reintentar</button></p>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">{error}</p>}
      {mensaje && <p role="status" className="mt-5 rounded-xl border border-[#294A38]/30 bg-white p-4 text-sm">{mensaje}</p>}
      <section aria-label="Resumen de resultados" className="mt-6 grid gap-3 sm:grid-cols-3">{[{ nombre: 'En revisión', valor: resumen.pendientes, fondo: 'bg-[#EC9BB6] border-[#EC9BB6]' }, { nombre: 'Resultados aprobados', valor: resumen.aprobados, fondo: 'bg-white border-[#e7ddd5]' }, { nombre: 'Comisiones reportadas aprobadas', valor: dineroResultado(resumen.monto), fondo: 'bg-[#F4CAD8] border-[#EC9BB6]/50' }].map(s => <article key={s.nombre} className={`rounded-[22px] border p-5 ${s.fondo}`}><p className="text-[10px] uppercase tracking-[.15em] text-[#655B56]">{s.nombre}</p><p className="mt-3 font-impact text-3xl font-semibold tabular-nums">{errorCarga ? '—' : s.valor}</p></article>)}</section>
      <div className="mt-7 rounded-[22px] border border-[#e7ddd5] bg-[#FAF7F3] p-5"><label className="block text-sm font-medium">Tablero de<select value={alumnaTablero} onChange={e=>setAlumnaTablero(e.target.value)} className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#e7ddd5] bg-white px-3 py-3 text-base sm:max-w-sm"><option value="todas">Comunidad · Total de las cuentas</option>{alumnasTablero.map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}</select></label><p className="mt-2 text-xs leading-6 text-[#746a64]">El total de la comunidad no representa los ingresos personales de Flor. Elegí una cuenta para ver sus resultados. La cuenta de prueba sigue excluida.</p></div>
      <ResultsDashboard key={alumnaTablero} resultados={alumnaTablero==='todas'?actuales:actuales.filter(r=>r.alumna_id===alumnaTablero)} periodoActual={periodoActual} errorCarga={errorCarga} comunidad={alumnaTablero==='todas'} />
      <h2 className="mt-10 text-xl font-semibold">Revisión de comprobantes</h2>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="buscar-resultados">Buscar alumna o resultado</label><input id="buscar-resultados" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar alumna o resultado" className={selector} />
        <label className="sr-only" htmlFor="estado-resultados">Estado</label><select id="estado-resultados" value={estado} onChange={e => setEstado(e.target.value)} className={selector}><option value="todos">Todos los estados</option>{Object.entries(ESTADO_RESULTADO).map(([id,s]) => <option key={id} value={id}>{s.nombre}</option>)}</select>
        <label className="sr-only" htmlFor="tipo-resultados">Tipo</label><select id="tipo-resultados" value={tipo} onChange={e => setTipo(e.target.value)} className={selector}><option value="todos">Todos los tipos</option>{tipos.map(t => <option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select>
        {paises.length > 0 && <label className="text-xs">País <select value={pais} onChange={e => setPais(e.target.value)} className={selector}><option value="">Todos</option>{paises.map(p => <option key={p}>{p}</option>)}</select></label>}
      </div>
      {detalle && <section aria-label="Revisar resultado" className="mt-5 rounded-[24px] border border-[#EC9BB6] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{detalle.perfiles?.nombre || 'Alumna'} · {detalle.mes || 'Resultado'}</h2><button type="button" onClick={() => setAbierto(null)} className="text-sm underline">Cerrar detalle</button></div>
        <div className="mt-4 grid gap-6 md:grid-cols-2"><div><Estado estado={detalle.estado} />{detalle.monto !== null && <p className="mt-4 font-impact text-3xl font-semibold">{dineroResultado(Number(detalle.monto))}</p>}{detalle.titulo && <h3 className="mt-3 font-semibold">{detalle.titulo}</h3>}<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{detalle.descripcion}</p>{detalle.estrategia && <p className="mt-3 text-sm text-[#746a64]">{detalle.estrategia}</p>}<p className="mt-3 text-xs text-[#746a64]">{detalle.pais ? detalle.pais + ' · ' : ''}{new Date(detalle.created_at).toLocaleDateString('es-AR')}</p></div>{detalle.archivo_url && <Captura key={detalle.id} id={detalle.id} onReady={lista=>setCapturaLista(lista?detalle.id:null)} />}</div>
        {detalle.archivo_url && capturaLista!==detalle.id && <p className="mt-4 text-sm text-[#746a64]">Esperá a que se abra el comprobante antes de aprobar. Si falla, reintentá la captura.</p>}
        {!detalle.archivo_url && <p className="mt-4 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">Esta carga histórica no tiene comprobante. No se puede aprobar; la alumna debe enviar una nueva carga con su captura. No se borró el registro original.</p>}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-[#e7ddd5] pt-5">{(['aprobado','rechazado','pendiente'] as const).filter(e => e !== detalle.estado).map(e => <button key={e} type="button" disabled={Boolean(ocupado) || errorCarga || (e==='aprobado' && (!detalle.archivo_url || capturaLista!==detalle.id))} onClick={() => revisar(detalle,e)} className={`rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-50 ${e === 'aprobado' ? 'border-[#294A38] bg-[#294A38] text-white' : 'border-[#e7ddd5] bg-[#FAF7F3]'}`}>{ocupado === detalle.id ? 'Guardando…' : e === 'aprobado' ? 'Aprobar' : e === 'rechazado' ? 'Rechazar' : 'Volver a revisión'}</button>)}</div>
      </section>}
      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Resultados recibidos">{filtrados.map(r => <article key={r.id} className="flex flex-col rounded-[22px] border border-[#e7ddd5] bg-white p-5">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4CAD8] text-sm font-semibold">{(r.perfiles?.nombre || 'S').slice(0,1)}</span><h2 className="text-sm font-semibold">{r.perfiles?.nombre || 'Alumna'}</h2></div>
        <div className="mt-4"><Estado estado={r.estado} /></div>{r.monto !== null && <p className="mt-4 font-impact text-2xl font-semibold">{dineroResultado(Number(r.monto))}</p>}<p className="mt-3 line-clamp-3 break-words text-sm leading-6">{r.descripcion || r.titulo}</p><p className="mt-3 text-xs text-[#746a64]">{r.mes} {r.archivo_url ? '· Con captura' : ''}</p>
        <button type="button" aria-expanded={abierto === r.id} onClick={() => { setAbierto(r.id); if(abierto!==r.id) setCapturaLista(null); setError(''); setMensaje('') }} className="mt-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-[#294A38]"><NavigationIcon name="resultados" />Revisar resultado</button>
      </article>)}</section>
      {!errorCarga && !filtrados.length && <p className="mt-5 rounded-[22px] border border-[#e7ddd5] bg-white p-8 text-center text-sm text-[#746a64]">No hay resultados con estos filtros.</p>}
      <section className="mt-8 rounded-[24px] border border-[#e7ddd5] bg-[#FAF7F3] p-5 sm:p-7" aria-labelledby="acceso-resultados">
        <h2 id="acceso-resultados" className="text-xl font-semibold">Accesos a Resultados</h2><p className="mt-2 text-sm text-[#746a64]">Habilitá este módulo a cada Socia. Los demás módulos mantienen su acceso actual.</p>
        {!errorCarga && !socias.length && <p className="mt-4 text-sm">Todavía no hay cuentas con el plan Socias. <Link href="/admin" className="font-medium text-[#294A38] underline">Asignar plan en Acceso y actividad</Link></p>}
        <div className="mt-4 space-y-3">{socias.map(s => { const habilitada = accesos[s.id] ?? s.habilitada; return <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7ddd5] bg-white p-4"><div><p className="text-sm font-semibold">{s.nombre || 'Socia'}</p><p className="mt-1 text-xs text-[#746a64]">{habilitada ? 'Habilitado' : 'Sin acceso'}{s.estado !== 'activa' ? ' · Cuenta no activa' : ''}</p></div><button type="button" disabled={Boolean(ocupado) || errorCarga || (!habilitada && s.estado !== 'activa')} onClick={() => cambiarAcceso(s)} className="rounded-full border border-[#294A38]/30 px-4 py-2 text-sm font-medium text-[#294A38] disabled:opacity-50">{ocupado === s.id ? 'Guardando…' : habilitada ? 'Cerrar acceso' : 'Habilitar Resultados'}</button></div> })}</div>
      </section>
    </main>
  </div>
}
