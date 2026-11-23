'use client'
import type { Clase } from './ClassroomCliente'
import { ordenarClases, SECCIONES_CLASE, ubicacionClase } from '@/lib/class-management'
import { resumenPrograma, tiempoClase, type ProgresoClase } from '@/lib/class-progress'
import ClassVideoThumbnail from '@/components/ClassVideoThumbnail'
import { coincideBusquedaClase } from '@/lib/class-library-filters'
import type { GrupoClasesFarmasi } from '@/lib/farmasi-class-groups'

function CollapseIndicator({ seccion = false }: { seccion?: boolean }) {
  return <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E7DDD5] bg-[#FFFDFA] text-[#294A38]">
    <svg viewBox="0 0 24 24" className={`h-5 w-5 transition-transform motion-reduce:transition-none ${seccion ? 'group-open/seccion:rotate-180' : 'group-open/programa:rotate-180'}`} fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
}

export default function ClassroomProgram({ programa, clases, progreso, buscar, esAdmin, tieneAcceso, cargando, abierto, onAbrir, idsVisibles, filtrandoAvance = false, errorProgreso = false, gruposFarmasi }: {
  programa: string; clases: Clase[]; progreso: ProgresoClase[]; buscar: string; esAdmin: boolean; tieneAcceso: boolean; cargando: boolean; abierto: boolean; onAbrir: (clase: Clase) => void
  idsVisibles?: string[]; filtrandoAvance?: boolean; errorProgreso?: boolean; gruposFarmasi?: GrupoClasesFarmasi[]
}) {
  const ordenadas = ordenarClases(clases)
  const ids = idsVisibles ? new Set(idsVisibles) : null
  const visibles = ordenadas.filter(c => ids ? ids.has(c.id) : coincideBusquedaClase(c.titulo, buscar))
  if (!visibles.length) return null
  const abrirCoincidencias = Boolean(buscar.trim()) || filtrandoAvance
  const resumen = resumenPrograma(clases.filter(c => (c.puede_ver ?? tieneAcceso) && (c.tiene_video_privado || c.vimeo_url)).map(c => c.id), progreso)
  const idsAsignados = gruposFarmasi ? new Set(gruposFarmasi.flatMap(grupo => grupo.claseIds)) : null
  function tarjetas(videos: Clase[], grupoCompleto?: Clase[]) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{videos.map(clase => {
      const orden = (grupoCompleto ?? ordenadas.filter(c => !idsAsignados?.has(c.id) && ubicacionClase(c.modulo).seccion === ubicacionClase(clase.modulo).seccion)).findIndex(c => c.id === clase.id) + 1
      const avance = progreso.find(p => p.clase_id === clase.id)
      const disponible = (clase.puede_ver ?? tieneAcceso) && Boolean(clase.vimeo_url || clase.tiene_video_privado)
      return <article key={clase.id} className="min-w-0 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-3">
        <div className="relative">
          <ClassVideoThumbnail id={clase.id} titulo={clase.titulo} disponible={disponible} esAdmin={esAdmin} revision={clase.miniatura_revision} />
          {disponible ? <button type="button" disabled={cargando} onClick={() => onAbrir(clase)} aria-label={`Reproducir ${clase.titulo}`} className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#294A38] text-white disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path d="m9 6 10 6-10 6V6Z" fill="currentColor" /></svg></button>
            : <a href="/inicio#plan-socias" aria-label={`Conocer el plan Socias para ${clase.titulo}`} className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#E7DDD5] bg-[#FAF7F3] text-[#294A38]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6"/></svg></a>}
        </div>
        <div className="px-1 pb-2 pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[.14em] text-[#746A64]">{String(orden).padStart(2, '0')} · {clase.acceso_gratuito ? 'Clase gratuita' : ubicacionClase(clase.modulo).seccion === 'Material de apoyo' ? 'Apoyo' : 'Clase grabada'}</p>
          <h3 className="mt-2 break-words font-impact text-sm font-semibold leading-snug">{clase.titulo}</h3>
          {clase.descripcion && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#746A64]">{clase.descripcion}</p>}
          {!disponible && <p className="mt-3 text-xs text-[#746A64]">Acceso con Socias Digitales</p>}
          {!esAdmin && disponible && <p className="mt-3 text-xs font-medium text-[#294A38]">{errorProgreso ? 'Progreso no disponible' : avance?.completada ? '✓ Completada' : avance && avance.posicion_seg > 0 ? `En curso · ${tiempoClase(avance.posicion_seg)}` : 'Pendiente'}</p>}
        </div>
      </article>
    })}</div>
  }
  function seccionVideos(id: string, nombre: string, videos: Clase[], abierta: boolean, grupoCompleto?: Clase[]) {
    return <details key={id} open={abierta} className="group/seccion rounded-2xl border border-[#E7DDD5] bg-[#F4EFEA] p-3 sm:p-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-xl text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] [&::-webkit-details-marker]:hidden"><span className="min-w-0 break-words [overflow-wrap:anywhere]">{nombre}<span className="ml-2 font-normal text-[#746A64]">· {videos.length}</span></span><CollapseIndicator seccion /></summary>
      <div className="mt-3">{videos.length ? tarjetas(videos, grupoCompleto) : <p className="py-3 text-sm text-[#746A64]">Todavía no hay contenido publicado en esta sección.</p>}</div>
    </details>
  }
  return <details open={abierto || abrirCoincidencias} className="group/programa rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:p-6">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] [&::-webkit-details-marker]:hidden">
      <div className="min-w-0"><h2 className="break-words font-impact text-lg font-semibold sm:text-xl">{programa}</h2><p className="mt-1 text-xs text-[#746A64]">{clases.length} {clases.length === 1 ? 'clase' : 'clases'}{!esAdmin && resumen.total > 0 ? errorProgreso ? ' · Progreso no disponible' : ` · ${resumen.completas} de ${resumen.total} completadas` : ''}</p></div>
      <CollapseIndicator />
    </summary>
    {!esAdmin && !errorProgreso && resumen.total > 0 && <div role="progressbar" aria-label={`Progreso en ${programa}`} aria-valuenow={resumen.porcentaje} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#E7DDD5]"><div className="h-full rounded-full bg-[#294A38]" style={{ width: `${resumen.porcentaje}%` }} /></div>}
    <div className="mt-5 space-y-4">
      {gruposFarmasi?.map(grupo => {
        const idsGrupo = new Set(grupo.claseIds)
        const videos = visibles.filter(c => idsGrupo.has(c.id))
        if (!videos.length) return null
        return seccionVideos(grupo.id, grupo.nombre, videos, true, ordenadas.filter(c => idsGrupo.has(c.id)))
      })}
      {programa === 'Bienvenida' && !gruposFarmasi ? tarjetas(visibles) : SECCIONES_CLASE.map(seccion => {
        const videos = visibles.filter(c => !idsAsignados?.has(c.id) && ubicacionClase(c.modulo).seccion === seccion)
        if ((abrirCoincidencias || gruposFarmasi) && !videos.length) return null
        return seccionVideos(seccion, seccion, videos, seccion === 'Clases' || abrirCoincidencias)
      })}
    </div>
  </details>
}
