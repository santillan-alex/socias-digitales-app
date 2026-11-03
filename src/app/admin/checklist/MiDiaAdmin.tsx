'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import { nombreDia, fechaDiaValida, progresoDia, type ResumenDia } from '@/lib/my-day'

interface Cuenta { id: string; nombre: string | null; estado: string | null; habilitada: boolean }
export default function MiDiaAdmin({ socias, resumen, fecha, errorCarga = false }: { socias: Cuenta[]; resumen: ResumenDia[]; fecha: string; errorCarga?: boolean }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [cambios, setCambios] = useState<Record<string, boolean>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const bloqueo = useRef(false)
  const habilitada = (s: Cuenta) => cambios[s.id] ?? s.habilitada
  const visibles = socias.filter(s => (s.nombre ?? '').toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')) && (filtro === 'todas' || habilitada(s) === (filtro === 'habilitadas')))
  const conAgenda = resumen.filter(r => socias.some(s => s.id === r.alumna_id))
  const total = conAgenda.reduce((n, r) => n + Number(r.total), 0)
  const completas = conAgenda.reduce((n, r) => n + Number(r.completadas), 0)
  async function cambiar(s: Cuenta) {
    if (bloqueo.current) return
    bloqueo.current = true; setOcupado(s.id); setError(''); setMensaje('')
    const activar = !habilitada(s)
    try {
      const response = await fetch('/api/admin/checklist/acceso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuaria_id: s.id, habilitada: activar }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'No pudimos cambiar el acceso.')
      setCambios(prev => ({ ...prev, [s.id]: activar })); setMensaje(activar ? 'Mi día habilitado para esta Socia.' : 'Acceso a Mi día cerrado. Sus tareas se conservan.'); router.refresh()
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No pudimos conectarnos. Comprobá el acceso antes de reintentar.') }
    finally { setOcupado(null); bloqueo.current = false }
  }
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211c19]">
    <header data-admin-section-header="true" className="flex h-[76px] items-center justify-between border-b border-[#e7ddd5] px-5 sm:px-8"><Link href="/admin"><img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" className="h-11 w-auto" /></Link><Link href="/admin" className="text-sm text-[#294A38]">← Panel de Flor</Link></header><AdminSectionMenu />
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Seguimiento de Socias</p><h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Mi día</h1><p className="mt-2 text-sm first-letter:uppercase text-[#746a64]">{nombreDia(fecha)}</p></div><label className="text-xs text-[#746a64]">Fecha <input type="date" min="2000-01-01" max="2099-12-31" value={fecha} disabled={Boolean(ocupado)} onChange={e => { if (fechaDiaValida(e.target.value)) router.push(`/admin/checklist?fecha=${e.target.value}`) }} className="ml-2 rounded-full border border-[#e7ddd5] bg-white px-3 py-2 text-sm" /></label></div>
      {errorCarga && <p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">No pudimos cargar toda la información. <button type="button" onClick={() => router.refresh()} className="underline">Reintentar</button></p>}{error && <p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">{error}</p>}{mensaje && <p role="status" className="mt-5 text-sm text-[#294A38]">{mensaje}</p>}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de agenda">{[
        { titulo: 'Accesos habilitados', valor: socias.filter(s => habilitada(s) && s.estado === 'activa').length, fondo: 'bg-[#F4CAD8] border-[#EC9BB6]/60' },
        { titulo: 'Socias con tareas', valor: conAgenda.length, fondo: 'bg-white border-[#e7ddd5]' },
        { titulo: 'Tareas del día', valor: total, fondo: 'bg-[#FAF7F3] border-[#e7ddd5]' },
        { titulo: 'Completadas', valor: completas, fondo: 'bg-[#F4CAD8] border-[#EC9BB6]/60' },
      ].map(x => <article key={x.titulo} className={`rounded-[22px] border p-5 ${x.fondo}`}><h2 className="text-[10px] uppercase tracking-[.14em] text-[#655B56]">{x.titulo}</h2><p className="mt-3 font-impact text-3xl font-semibold tabular-nums">{errorCarga ? '—' : x.valor}</p></article>)}</section>
      <p className="mt-3 text-xs leading-5 text-[#746a64]">Actividad declarada por las Socias para esta fecha. Las tareas archivadas no cuentan. Esta vista muestra progreso, no el contenido de sus tareas personales.</p>
      <section className="mt-7 rounded-[24px] border border-[#e7ddd5] bg-[#FAF7F3] p-5 sm:p-7" aria-labelledby="accesos-mi-dia"><h2 id="accesos-mi-dia" className="text-xl font-semibold">Accesos y actividad</h2><p className="mt-2 text-sm text-[#746a64]">El permiso de Mi día es independiente de Métricas y Resultados.</p><div className="mt-4 flex flex-wrap gap-3"><label className="sr-only" htmlFor="buscar-agenda">Buscar Socia</label><input id="buscar-agenda" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar Socia" className="rounded-full border border-[#e7ddd5] bg-white px-4 py-2 text-sm" /><label className="sr-only" htmlFor="filtrar-agenda">Filtrar accesos</label><select id="filtrar-agenda" value={filtro} onChange={e => setFiltro(e.target.value)} className="rounded-full border border-[#e7ddd5] bg-white px-4 py-2 text-sm"><option value="todas">Todos los accesos</option><option value="habilitadas">Habilitados</option><option value="cerradas">Sin acceso</option></select></div>
        <div className="mt-5 space-y-3">{visibles.map(s => { const r = resumen.find(d => d.alumna_id === s.id); const hechas = Number(r?.completadas ?? 0), tareas = Number(r?.total ?? 0), porcentaje = progresoDia(hechas, tareas); return <article key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[#e7ddd5] bg-white p-4"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{s.nombre || 'Socia'}</h3><p className="mt-1 text-xs text-[#746a64]">{habilitada(s) ? 'Habilitado' : 'Sin acceso'}{s.estado !== 'activa' ? ' · Cuenta no activa' : ''}</p></div><div className="flex items-center gap-3"><div className="w-28"><p className="text-xs text-[#746a64]">{errorCarga ? 'No disponible' : tareas ? `${hechas} de ${tareas} tareas` : 'Sin tareas'}</p><div role="progressbar" aria-label={`Progreso de ${s.nombre || 'Socia'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje ?? 0} aria-valuetext={tareas ? `${hechas} de ${tareas}` : 'Sin tareas'} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F4EFEA]"><div className="h-full rounded-full bg-[#294A38]" style={{ width: `${porcentaje ?? 0}%` }} /></div></div><button type="button" disabled={Boolean(ocupado) || errorCarga || (!habilitada(s) && s.estado !== 'activa')} onClick={() => cambiar(s)} className="rounded-full border border-[#294A38]/30 px-4 py-2 text-sm font-medium text-[#294A38] disabled:opacity-50">{ocupado === s.id ? 'Guardando…' : habilitada(s) ? 'Cerrar acceso' : 'Habilitar Mi día'}</button></div></article> })}</div>
        {!errorCarga && !visibles.length && <p className="mt-5 text-sm text-[#746a64]">{socias.length ? 'No hay cuentas con estos filtros.' : <>Todavía no hay cuentas con el plan Socias. <Link href="/admin" className="text-[#294A38] underline">Asignar plan en Acceso y actividad</Link></>}</p>}
      </section>
    </main>
  </div>
}
