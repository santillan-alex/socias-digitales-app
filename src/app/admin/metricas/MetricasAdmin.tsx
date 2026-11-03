'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import { ResumenMetricas, EvolucionMetricas } from '@/components/MetricsVisuals'
import { ESTRATEGIAS_METRICAS, ultimasMetricas, claveCampana, calcularMetricas, dineroMetrica, fechaMetrica, type Metrica } from '@/lib/metrics'

interface Cuenta {id:string;nombre:string|null;estado:string|null;habilitada:boolean}
export default function MetricasAdmin({metricas,socias,errorCarga=false,limitado=false}:{
  metricas:Metrica[];socias:Cuenta[];errorCarga?:boolean;limitado?:boolean
}) {
  const router=useRouter()
  const [busqueda,setBusqueda]=useState('')
  const [estrategia,setEstrategia]=useState('todas')
  const [alumna,setAlumna]=useState('')
  const [seleccion,setSeleccion]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [mensaje,setMensaje]=useState('')
  const [ocupado,setOcupado]=useState<string|null>(null)
  const [cambios,setCambios]=useState<Record<string,boolean>>({})
  const bloqueo=useRef(false)
  const filtrar=(m:Metrica)=>(estrategia==='todas'||m.estrategia===estrategia) && (!alumna||m.alumna_id===alumna) && `${m.perfiles?.nombre ?? ''} ${m.campana}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es'))
  const visibles=metricas.filter(filtrar),ultimas=ultimasMetricas(visibles)
  const cuentas=[...new Map(metricas.map(m=>[m.alumna_id,m.perfiles?.nombre||'Socia'])).entries()]
  const detalle=ultimas.find(m=>claveCampana(m)===seleccion)
  const conocidas=ultimas.filter(m=>m.gasto_acumulado!==null)
  const gasto=conocidas.reduce((n,m)=>n+m.gasto_acumulado!,0)
  const comisiones=ultimas.map(calcularMetricas).filter(r=>r.comisiones!==null)
  const ingreso=comisiones.reduce((n,r)=>n+r.comisiones!,0)
  async function cambiarAcceso(s:Cuenta) {
    if(bloqueo.current)return
    const habilitada=!(cambios[s.id]??s.habilitada)
    bloqueo.current=true;setOcupado(s.id);setError('');setMensaje('')
    try {
      const response=await fetch('/api/admin/metricas/acceso',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuaria_id:s.id,habilitada})})
      const data=await response.json()
      if(!response.ok||!data.ok)throw new Error(data.error||'No pudimos cambiar el acceso.')
      setCambios(prev=>({...prev,[s.id]:habilitada}));setMensaje(habilitada?'Métricas habilitadas para esta Socia.':'Acceso a Métricas cerrado.');router.refresh()
    }catch(causa){setError(causa instanceof Error?causa.message:'No pudimos conectarnos. El acceso no cambió.')}
    finally{setOcupado(null);bloqueo.current=false}
  }
  const campo='rounded-full border border-[#e7ddd5] bg-white px-4 py-2 text-sm'
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211c19]">
    <header data-admin-section-header="true" className="flex h-[76px] items-center justify-between border-b border-[#e7ddd5] px-5 sm:px-8"><Link href="/admin"><img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" className="h-11 w-auto" /></Link><Link href="/admin" className="text-sm text-[#294A38]">← Panel de Flor</Link></header>
    <AdminSectionMenu />
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#294A38]">Seguimiento de Socias</p><h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Métricas</h1>
      {errorCarga && <p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">No pudimos cargar toda la información. <button type="button" onClick={()=>router.refresh()} className="underline">Reintentar</button></p>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">{error}</p>}{mensaje && <p role="status" className="mt-5 rounded-xl border border-[#294A38]/30 bg-white p-4 text-sm">{mensaje}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><label className="sr-only" htmlFor="buscar-metricas">Buscar alumna o campaña</label><input id="buscar-metricas" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar alumna o campaña" className={campo} /><label className="sr-only" htmlFor="estrategia-metricas">Estrategia</label><select id="estrategia-metricas" value={estrategia} onChange={e=>setEstrategia(e.target.value)} className={campo}><option value="todas">Todas las estrategias</option>{Object.entries(ESTRATEGIAS_METRICAS).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select><label className="sr-only" htmlFor="alumna-metricas">Alumna</label><select id="alumna-metricas" value={alumna} onChange={e=>setAlumna(e.target.value)} className={campo}><option value="">Todas las alumnas</option>{cuentas.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></div>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de campañas">{[
        {label:'Campañas visibles',valor:ultimas.length,nota:'Último registro de cada campaña',fondo:'bg-[#F4CAD8] border-[#EC9BB6]/60'},
        {label:'Ventas declaradas',valor:ultimas.reduce((n,m)=>n+m.ventas,0),nota:'Sin duplicar los análisis diarios',fondo:'bg-white border-[#e7ddd5]'},
        {label:'Gasto informado',valor:dineroMetrica(conocidas.length?gasto:null),nota:`${conocidas.length} de ${ultimas.length} campañas`,fondo:'bg-[#FAF7F3] border-[#e7ddd5]'},
        {label:'Comisiones estimadas',valor:dineroMetrica(comisiones.length?ingreso:null),nota:`${comisiones.length} de ${ultimas.length} campañas`,fondo:'bg-[#F4CAD8] border-[#EC9BB6]/60'},
      ].map(x=><article key={x.label} className={`min-w-0 rounded-[22px] border p-5 ${x.fondo}`}><p className="text-[10px] uppercase tracking-[.14em] text-[#655B56]">{x.label}</p><p className="mt-3 break-words font-impact text-2xl font-semibold tabular-nums">{errorCarga?'—':x.valor}</p><p className="mt-2 text-xs text-[#746a64]">{x.nota}</p></article>)}</section>
      <p className="mt-3 text-xs leading-5 text-[#746a64]">Datos declarados por las alumnas. Cada campaña usa su última fecha informada, no la suma del historial.{limitado?' Vista limitada a los últimos 1.000 análisis.':''}</p>
      {detalle && <section className="mt-6 rounded-[24px] border border-[#EC9BB6]/60 bg-[#FAF7F3] p-5" aria-label="Detalle de campaña"><div className="mb-4 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{detalle.perfiles?.nombre||'Socia'} · {detalle.campana}</h2><p className="mt-1 text-xs text-[#746a64]">{fechaMetrica(detalle.fecha)} · {ESTRATEGIAS_METRICAS[detalle.estrategia]}</p></div><button type="button" onClick={()=>setSeleccion(null)} className="text-sm underline">Cerrar detalle</button></div><ResumenMetricas datos={detalle} /><div className="mt-5"><EvolucionMetricas registros={metricas.filter(m=>claveCampana(m)===seleccion)} /></div></section>}
      <section className="mt-6" aria-labelledby="campanas-metricas"><h2 id="campanas-metricas" className="text-xl font-semibold">Campañas y evolución</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{ultimas.map(m=><article key={m.id} className="rounded-[22px] border border-[#e7ddd5] bg-white p-5"><p className="text-xs font-medium text-[#294A38]">{m.perfiles?.nombre||'Socia'}</p><h3 className="mt-2 text-base font-semibold">{m.campana}</h3><p className="mt-1 text-xs text-[#746a64]">{fechaMetrica(m.fecha)} · {ESTRATEGIAS_METRICAS[m.estrategia]}</p><dl className="mt-4 grid grid-cols-2 gap-3"><div><dt className="text-[10px] text-[#746a64]">Ventas</dt><dd className="font-impact text-xl font-semibold">{m.ventas}</dd></div><div><dt className="text-[10px] text-[#746a64]">Gasto real</dt><dd className="font-impact text-xl font-semibold">{dineroMetrica(m.gasto_acumulado)}</dd></div></dl><button type="button" onClick={()=>setSeleccion(claveCampana(m))} className="mt-4 text-sm font-semibold text-[#294A38] underline">Ver análisis y evolución</button></article>)}</div>
        {!errorCarga && !ultimas.length && <p className="mt-4 rounded-[22px] border border-[#e7ddd5] bg-white p-8 text-center text-sm text-[#746a64]">No hay análisis con estos filtros.</p>}
      </section>
      <section className="mt-8 rounded-[24px] border border-[#e7ddd5] bg-[#FAF7F3] p-5 sm:p-7" aria-labelledby="accesos-metricas"><h2 id="accesos-metricas" className="text-xl font-semibold">Accesos a Métricas</h2><p className="mt-2 text-sm text-[#746a64]">Este permiso es independiente de Resultados y los demás módulos.</p>{!errorCarga&&!socias.length&&<p className="mt-4 text-sm">Todavía no hay cuentas con el plan Socias. <Link href="/admin" className="text-[#294A38] underline">Asignar plan en Acceso y actividad</Link></p>}<div className="mt-4 space-y-3">{socias.map(s=>{const habilitada=cambios[s.id]??s.habilitada;return <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7ddd5] bg-white p-4"><div><p className="text-sm font-semibold">{s.nombre||'Socia'}</p><p className="mt-1 text-xs text-[#746a64]">{habilitada?'Habilitado':'Sin acceso'}{s.estado!=='activa'?' · Cuenta no activa':''}</p></div><button type="button" disabled={Boolean(ocupado)||errorCarga||(!habilitada&&s.estado!=='activa')} onClick={()=>cambiarAcceso(s)} className="rounded-full border border-[#294A38]/30 px-4 py-2 text-sm font-medium text-[#294A38] disabled:opacity-50">{ocupado===s.id?'Guardando…':habilitada?'Cerrar acceso':'Habilitar Métricas'}</button></div>})}</div></section>
    </main>
  </div>
}
