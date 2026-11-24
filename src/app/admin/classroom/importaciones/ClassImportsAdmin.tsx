'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SECCIONES_CLASE, type SeccionClase } from '@/lib/class-management'
import AdminSectionMenu from '@/components/AdminSectionMenu'

interface Conexion {
  id: string; nombre: string; programa: string; seccion: SeccionClase; solo_farmaci: boolean
  creada: string; vencimiento: string; revocada: string | null; importaciones: number
}
interface Importacion {
  id: string; conexionId: string; claseId: string; titulo: string; programa: string; seccion: SeccionClase
  solo_farmaci: boolean; estado: 'preparando' | 'cargando' | 'lista'; creada: string; actualizada: string
}
const inputStyle = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#D8CFC8] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19]'
const fecha = (valor: string) => Number.isFinite(Date.parse(valor)) ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(valor)) : 'Sin comprobar'

export default function ClassImportsAdmin({ programas }: { programas: string[] }) {
  const [conexiones, setConexiones] = useState<Conexion[]>([])
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [nombre, setNombre] = useState('Grabaciones de Flor')
  const [programa, setPrograma] = useState('')
  const [seccion, setSeccion] = useState<SeccionClase>('Clases')
  const [farmasi, setFarmasi] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [comprobada, setComprobada] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [advertencia, setAdvertencia] = useState('')
  const [ahora, setAhora] = useState(0)
  const [secreto, setSecreto] = useState<{ id: string; clave: string; nombre: string } | null>(null)
  const [copia, setCopia] = useState('')
  const [porRevocar, setPorRevocar] = useState<string | null>(null)
  const montado = useRef(true)
  const secretoRef = useRef<HTMLElement | null>(null)
  const leer = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/admin/clases/importaciones', { cache: 'no-store', signal })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.conexiones) || !Array.isArray(data.importaciones)) throw new Error(data.error || 'No pudimos comprobar las conexiones.')
      if (montado.current && !signal?.aborted) { setConexiones(data.conexiones); setImportaciones(data.importaciones); setAdvertencia(data.advertencia || ''); setAhora(Date.now()); setComprobada(true) }
    } catch (cause) {
      if (montado.current && !signal?.aborted) { setError(cause instanceof Error ? cause.message : 'No pudimos cargar las conexiones.'); setConexiones([]); setImportaciones([]) }
    } finally { if (montado.current && !signal?.aborted) setCargando(false) }
  }, [])
  const cargar = useCallback(async () => { setCargando(true); setError(''); setComprobada(false); await leer() }, [leer])
  useEffect(() => { montado.current = true; const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void leer(controller.signal) }); return () => { montado.current = false; controller.abort() } }, [leer])
  useEffect(() => { if (secreto) secretoRef.current?.focus() }, [secreto])
  async function crear(event: React.FormEvent) {
    event.preventDefault()
    if (!comprobada || ocupado || secreto) return
    setOcupado(true); setError(''); setCopia('')
    try {
      const response = await fetch('/api/admin/clases/importaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'crear', nombre, programa, seccion, solo_farmaci: farmasi }) })
      const data = await response.json()
      if (!response.ok || typeof data.clave !== 'string' || !data.conexion?.id) throw new Error(data.error || 'No pudimos confirmar la conexión. Actualizá el historial antes de reintentar.')
      if (montado.current) { setSecreto({ id: data.conexion.id, clave: data.clave, nombre: data.conexion.nombre }); setConexiones(prev => [data.conexion, ...prev.filter(x => x.id !== data.conexion.id)]) }
    } catch (cause) { if (montado.current) { setError(cause instanceof Error ? cause.message : 'No pudimos crear la conexión.'); setComprobada(false) } }
    finally { if (montado.current) setOcupado(false) }
  }
  async function revocar(conexion: Conexion) {
    if (ocupado || porRevocar !== conexion.id) return
    setOcupado(true); setError('')
    try {
      const response = await fetch('/api/admin/clases/importaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revocar', id: conexion.id }) })
      const data = await response.json()
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'No pudimos desactivar la conexión.')
      if (montado.current) { if (secreto?.id === conexion.id) setSecreto(null); setPorRevocar(null); await cargar() }
    } catch (cause) { if (montado.current) setError(cause instanceof Error ? cause.message : 'No pudimos desactivar la conexión.') }
    finally { if (montado.current) setOcupado(false) }
  }
  async function copiarClave() {
    if (!secreto) return
    try { await navigator.clipboard.writeText(secreto.clave); if (montado.current) setCopia('Clave copiada. Guardala en la configuración privada de la automatización.') }
    catch { if (montado.current) setCopia('No pudimos copiarla. Seleccioná la clave y copiala manualmente.') }
  }
  return <main className="min-h-screen bg-[#F4EFEA] text-[#211C19]">
    <header className="border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-4 sm:px-8"><Link href="/admin/classroom" className="inline-flex min-h-11 items-center text-sm font-medium text-[#294A38]">← Clases</Link></header>
    <AdminSectionMenu />
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Formación y contenidos</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-serif text-4xl font-semibold tracking-[-.035em] sm:text-5xl">Grabaciones automáticas</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#746A64]">Recibí las grabaciones en el programa que elijas. Cada clase llega como borrador para que la revises y publiques.</p></div><button type="button" disabled={cargando || ocupado} onClick={() => void cargar()} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8CFC8] bg-[#FFFDFA] px-5 py-3 text-sm font-medium text-[#294A38] disabled:opacity-50">Actualizar</button></div>
      {error && <p role="alert" className="mt-5 rounded-2xl border border-[#B01B30] bg-[#FFFDFA] p-4 text-sm leading-6 text-[#B01B30]">{error}</p>}
      {advertencia && <p role="status" className="mt-5 rounded-2xl border border-[#EC9BB6] bg-[#FAF7F3] p-4 text-sm leading-6">{advertencia}</p>}
      {secreto && <section ref={secretoRef} tabIndex={-1} aria-labelledby="clave-nueva-titulo" className="mt-6 rounded-[24px] border border-[#294A38] bg-[#F4CAD8] p-5 focus:outline-none sm:p-7">
        <h2 id="clave-nueva-titulo" className="text-xl font-semibold">Conexión creada: {secreto.nombre}</h2><p className="mt-3 text-sm leading-6 text-[#294A38]">Esta clave se muestra una sola vez. Guardala en la automatización de Flor; permite cargar borradores únicamente en el programa elegido.</p>
        <code className="mt-4 block select-all rounded-xl border border-[#EC9BB6] bg-[#FFFDFA] p-4 text-sm [overflow-wrap:anywhere]">{secreto.clave}</code>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void copiarClave()} className="min-h-11 rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Copiar clave</button><button type="button" onClick={() => { setSecreto(null); setCopia('') }} className="min-h-11 rounded-full border border-[#294A38] bg-[#FAF7F3] px-5 py-3 text-sm font-medium text-[#294A38]">Ya la guardé</button></div>
        {copia && <p role="status" className="mt-3 text-sm leading-6 text-[#294A38]">{copia}</p>}
      </section>}
      <section aria-labelledby="nueva-conexion-titulo" className="mt-7 rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-5 sm:p-7">
        <h2 id="nueva-conexion-titulo" className="text-xl font-semibold">Conectar una fuente de grabaciones</h2>
        <p className="mt-2 text-sm leading-6 text-[#746A64]">Elegí el destino antes de crear la conexión. Después se agrega a la skill que Flor usa para descargar sus clases.</p>
        <form onSubmit={crear} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Nombre<input className={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} required disabled={ocupado || !comprobada || Boolean(secreto)} /></label>
          <label className="text-sm font-medium">Programa<input list="programas-importacion" className={inputStyle} value={programa} onChange={e => setPrograma(e.target.value)} maxLength={75} required disabled={ocupado || !comprobada || Boolean(secreto)} /><datalist id="programas-importacion">{programas.map(x => <option key={x} value={x} />)}</datalist></label>
          <label className="text-sm font-medium">Sección<select className={inputStyle} value={seccion} onChange={e => setSeccion(e.target.value as SeccionClase)} disabled={ocupado || !comprobada || Boolean(secreto)}>{SECCIONES_CLASE.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="text-sm font-medium">Acceso<select className={inputStyle} value={farmasi ? 'farmasi' : 'socias'} onChange={e => setFarmasi(e.target.value === 'farmasi')} disabled={ocupado || !comprobada || Boolean(secreto)}><option value="socias">Socias Digitales y Desafío</option><option value="farmasi">Solo Socias Farmasi</option></select></label>
          <div className="sm:col-span-2"><button type="submit" disabled={ocupado || !comprobada || Boolean(secreto)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{ocupado ? 'Guardando…' : 'Crear conexión'}</button><p className="mt-3 text-xs leading-5 text-[#746A64]">La conexión vence a los 90 días. Podés desactivarla antes; las clases ya cargadas se conservan.</p></div>
        </form>
      </section>
      <section aria-labelledby="conexiones-titulo" className="mt-8"><h2 id="conexiones-titulo" className="text-xl font-semibold">Mis conexiones</h2>
        {cargando ? <p role="status" className="mt-4 text-sm text-[#746A64]">Cargando conexiones…</p> : comprobada && !conexiones.length ? <p className="mt-4 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-sm leading-6 text-[#746A64]">Todavía no hay una fuente conectada.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{conexiones.map(conexion => { const activa = !conexion.revocada && Date.parse(conexion.vencimiento) > ahora; return <article key={conexion.id} className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words text-base font-semibold [overflow-wrap:anywhere]">{conexion.nombre}</h3><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${activa ? 'bg-[#F4CAD8] text-[#294A38]' : 'bg-[#F4EFEA] text-[#746A64]'}`}>{conexion.revocada ? 'Desactivada' : activa ? 'Activa' : 'Vencida'}</span></div><p className="mt-3 break-words text-sm leading-6 text-[#746A64]">{conexion.programa} · {conexion.seccion}</p><p className="mt-1 text-xs leading-5 text-[#746A64]">{conexion.solo_farmaci ? 'Socias Farmasi' : 'Socias Digitales y Desafío'} · Vence {fecha(conexion.vencimiento)}</p><p className="mt-2 text-xs text-[#746A64]">{conexion.importaciones} grabaciones recibidas</p>{activa && (porRevocar === conexion.id ? <div role="group" aria-label={`Confirmar desactivación de ${conexion.nombre}`} className="mt-4 rounded-xl border border-[#EC9BB6] bg-[#FAF7F3] p-4"><p className="text-sm leading-6">Dejará de recibir nuevas cargas. Las clases ya guardadas se conservan.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={ocupado} onClick={() => void revocar(conexion)} className="min-h-11 rounded-full bg-[#294A38] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Sí, desactivar</button><button type="button" disabled={ocupado} onClick={() => setPorRevocar(null)} className="min-h-11 rounded-full border border-[#D8CFC8] bg-[#FFFDFA] px-4 py-3 text-sm font-medium text-[#294A38]">Cancelar</button></div></div> : <button type="button" disabled={ocupado} onClick={() => setPorRevocar(conexion.id)} className="mt-3 min-h-11 rounded-lg px-1 text-sm font-medium text-[#294A38] underline underline-offset-4 disabled:opacity-50">Desactivar conexión</button>)}</article> })}</div>}
      </section>
      <section aria-labelledby="grabaciones-recibidas-titulo" className="mt-8"><h2 id="grabaciones-recibidas-titulo" className="text-xl font-semibold">Grabaciones recibidas</h2><p className="mt-2 text-sm leading-6 text-[#746A64]">Revisá el video y sus materiales en Clases antes de publicarlo.</p>
        {!cargando && comprobada && !importaciones.length ? <p className="mt-4 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-sm leading-6 text-[#746A64]">Las próximas grabaciones van a aparecer acá.</p> : <div className="mt-4 space-y-3">{importaciones.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="break-words text-base font-semibold [overflow-wrap:anywhere]">{item.titulo}</h3><p className="mt-2 break-words text-xs leading-5 text-[#746A64]">{item.programa} · {item.seccion} · {fecha(item.actualizada)}</p></div><span className={`w-fit shrink-0 rounded-full px-3 py-2 text-xs font-medium ${item.estado === 'lista' ? 'bg-[#F4CAD8] text-[#294A38]' : 'bg-[#F4EFEA] text-[#746A64]'}`}>{item.estado === 'lista' ? 'Borrador con video' : item.estado === 'cargando' ? 'Recibiendo video' : 'Preparando ficha'}</span></article>)}</div>}
        <Link href="/admin/classroom" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[#D8CFC8] bg-[#FAF7F3] px-5 py-3 text-sm font-medium text-[#294A38]">Ir a Clases</Link>
      </section>
    </div>
  </main>
}
