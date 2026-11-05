'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ubicacionClase } from '@/lib/class-management'

export interface EstadisticaClase {clase_id:string;iniciadas:number;completadas:number}
export default function ClassProgressAdmin({clases,estadisticas,error}:{clases:{id:string;titulo:string;modulo:string;activo:boolean}[];estadisticas:EstadisticaClase[];error:boolean}) {
  const [programa,setPrograma]=useState('Todos')
  const programas=[...new Set(clases.filter(c=>c.activo).map(c=>ubicacionClase(c.modulo).programa))]
  const visibles=clases.filter(c=>c.activo && (programa==='Todos'||ubicacionClase(c.modulo).programa===programa))
  return <section aria-labelledby="seguimiento-clases-titulo">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.18em] text-[#294A38]">Actividad de alumnas</p><h2 id="seguimiento-clases-titulo" className="mt-2 font-serif text-3xl">Cómo avanzan en sus clases.</h2><p className="mt-3 max-w-xl text-xs leading-5 text-[#746A64]">Actividad registrada desde que se habilitó el seguimiento. “Completada” es una marca de la alumna, no una certificación. No incluye administradores ni la cuenta de prueba.</p></div><label className="min-w-0 text-xs text-[#746A64]">Programa<select value={programa} onChange={e=>setPrograma(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-[#D8CFC8] bg-[#FAF7F3] px-3 py-3 text-base text-[#211C19]"><option>Todos</option>{programas.map(p=><option key={p}>{p}</option>)}</select></label></div>
    {error?<p role="alert" className="mt-5 rounded-xl border border-[#EC9BB6] bg-[#FAF7F3] p-5 text-sm">No pudimos cargar el seguimiento. Recargá para ver los datos; no mostramos ceros como si fueran resultados reales.</p>:<div className="mt-6 grid gap-3 lg:grid-cols-2">{visibles.map(c=>{
      const s=estadisticas.find(v=>v.clase_id===c.id)
      if (!s) return <article key={c.id} className="rounded-[22px] border border-[#EC9BB6] bg-[#FAF7F3] p-5"><h3 className="font-semibold">{c.titulo}</h3><p className="mt-3 text-sm text-[#746A64]">No pudimos comprobar el resumen de esta clase.</p><Link href={`/admin/lanzamiento?clase=${c.id}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#294A38] underline underline-offset-4">Ver seguimiento detallado</Link></article>
      const porcentaje=s.iniciadas?Math.round(s.completadas/s.iniciadas*100):0
      return <article key={c.id} className="rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5"><p className="text-[10px] font-medium uppercase tracking-[.14em] text-[#746A64]">{ubicacionClase(c.modulo).programa} · {ubicacionClase(c.modulo).seccion}</p><h3 className="mt-2 font-semibold leading-snug">{c.titulo}</h3><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="font-impact text-3xl font-semibold">{s.iniciadas}</p><p className="mt-1 text-xs text-[#746A64]">Iniciaron o marcaron</p></div><div><p className="font-impact text-3xl font-semibold text-[#294A38]">{s.completadas}</p><p className="mt-1 text-xs text-[#746A64]">Completaron</p></div></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#E7DDD5]" role="progressbar" aria-label={`Completaron ${c.titulo}`} aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[#294A38]" style={{width:`${porcentaje}%`}} /></div><p className="mt-2 text-xs text-[#746A64]">{s.iniciadas?`${porcentaje}% de quienes registraron actividad`:'Todavía sin actividad registrada'}</p><Link href={`/admin/lanzamiento?clase=${c.id}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#294A38] underline underline-offset-4">Ver alumnas</Link></article>
    })}</div>}
    {!error && visibles.length===0 && <p className="mt-5 rounded-xl border border-[#E7DDD5] p-6 text-sm text-[#746A64]">No hay clases publicadas en este programa.</p>}
  </section>
}
