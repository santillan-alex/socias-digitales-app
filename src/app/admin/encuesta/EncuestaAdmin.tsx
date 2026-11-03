'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import NavigationIcon from '@/components/NavigationIcon'
import PerfilEncuesta from './PerfilEncuesta'
import { TIPOS_ACCESO } from '@/lib/admin-usuarias'
import { filtrarEncuesta, resumenEncuesta, SURVEY_DEFAULT_FILTERS, SURVEY_SHEET_URL, urlExportarEncuesta, type SurveyFilters, type SurveyGroup, type SurveyRow } from '@/lib/survey'

function Distribucion({ title, groups, base }: { title: string; groups: SurveyGroup[]; base: number }) {
  return <article className="min-w-0 rounded-[24px] border border-[#EC9BB6]/45 bg-[#FFFDFA] p-5 sm:p-6">
    <div className="flex items-baseline justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><span className="shrink-0 text-xs text-[#746a64]">Base: {base}</span></div>
    {!base ? <p className="mt-6 text-sm text-[#746a64]">Sin respuestas en esta selección.</p> : <ul className="mt-6 space-y-4">{groups.map((g, i) => <li key={g.label}>
      <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words leading-5">{g.label}</span><span className="shrink-0 tabular-nums"><strong className="font-impact font-semibold">{g.count}</strong><span className="ml-2 text-xs text-[#746a64]">{g.percent.toLocaleString('es-AR')}%</span></span></div>
      <div aria-hidden="true" className="mt-2 h-2.5 overflow-hidden rounded-full border border-[#e7ddd5]/50 bg-[#F4EFEA]"><div className={`h-full rounded-full ${g.label === 'Sin respuesta' ? 'bg-[#e7ddd5]' : i % 3 === 0 ? 'bg-[#294A38]' : i % 3 === 1 ? 'bg-[#EC9BB6]' : 'bg-[#F4CAD8]'}`} style={{ width: `${g.percent}%` }} /></div>
    </li>)}</ul>}
  </article>
}
const nombresEstado = { completa: 'Completa', en_curso: 'En curso', anterior: 'Perfil anterior' }
const fecha = (value: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))

export default function EncuestaAdmin({ rows, actualizado, errorCarga = false }: { rows: SurveyRow[]; actualizado: string; errorCarga?: boolean }) {
  const router = useRouter()
  const [filters, setFilters] = useState<SurveyFilters>({ ...SURVEY_DEFAULT_FILTERS })
  const [vista, setVista] = useState<'resumen' | 'respuestas' | 'preguntas'>('resumen')
  const [busqueda, setBusqueda] = useState('')
  const [pending, startTransition] = useTransition()
  const fechaIncorrecta = Boolean(filters.desde && filters.hasta && filters.desde > filters.hasta)
  const seleccion = filtrarEncuesta(rows, filters), resumen = resumenEncuesta(seleccion)
  const reales = filtrarEncuesta(rows, SURVEY_DEFAULT_FILTERS).length
  const listado = seleccion.filter(r => `${r.nombre} ${r.pais || ''}`.toLocaleLowerCase('es-AR').includes(busqueda.trim().toLocaleLowerCase('es-AR')))
  const campo = 'mt-2 block w-full min-w-0 rounded-xl border border-[#e7ddd5] bg-white px-3 py-2.5 text-base text-[#211c19]'
  function filtro<K extends keyof SurveyFilters>(key: K, value: SurveyFilters[K]) { setFilters(prev => ({ ...prev, [key]: value })) }
  const disponible = !errorCarga && !fechaIncorrecta
  return <div className="min-h-screen bg-[#F4EFEA] text-[#211c19]" data-platform-role="admin">
    <header data-admin-section-header="true" className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#e7ddd5] px-5 py-3 sm:px-8"><Link href="/admin" aria-label="Panel de Flor"><Image src="/academy-horizontal-color.png" width={156} height={48} alt="Socias Digitales Academy" className="h-11 w-auto object-contain" /></Link><Link href="/admin" className="text-sm font-medium text-[#294A38]">← Panel de Flor</Link></header>
    <AdminSectionMenu />
    <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Conocé a tu comunidad</p><h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">Encuesta</h1><p className="mt-2 text-sm text-[#746a64]">Perfil de las alumnas · respuestas actuales</p></div><button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#294A38]/30 bg-[#FFFDFA] px-5 py-2.5 text-sm font-medium text-[#294A38] disabled:opacity-50"><NavigationIcon name="encuesta" />{pending ? 'Actualizando…' : 'Actualizar datos'}</button></div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-[#746a64]">{pending ? 'Consultando las respuestas guardadas…' : errorCarga ? 'No se pudieron cargar las respuestas.' : `Actualizado: ${fecha(actualizado)} · hora Argentina`}</p>
      {errorCarga && <div role="alert" className="mt-5 rounded-[20px] border border-[#EC9BB6] bg-[#F4CAD8]/40 p-5 text-sm">No pudimos cargar toda la encuesta. No se muestran totales parciales ni ceros ficticios. Usá «Actualizar datos» para reintentar.</div>}
      <section className="mt-6 rounded-[22px] border border-[#EC9BB6]/45 bg-[#FAF7F3] p-4 sm:p-5" aria-label="Filtros de la encuesta">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="min-w-0 text-xs font-medium text-[#746a64]">Tipo de acceso<select aria-label="Tipo de acceso" value={filters.tipo} onChange={e => filtro('tipo', e.target.value as SurveyFilters['tipo'])} className={campo}><option value="todas">Todas las alumnas</option>{TIPOS_ACCESO.map(t => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-[#746a64]">Estado de encuesta<select aria-label="Estado de encuesta" value={filters.estadoEncuesta} onChange={e => filtro('estadoEncuesta', e.target.value as SurveyFilters['estadoEncuesta'])} className={campo}><option value="todas">Todos los estados</option><option value="completa">Completa</option><option value="en_curso">En curso</option><option value="anterior">Perfil anterior</option></select></label>
          <label className="min-w-0 text-xs font-medium text-[#746a64]">Registro desde<input aria-label="Registro desde" type="date" value={filters.desde} onChange={e => filtro('desde', e.target.value)} className={campo} /></label>
          <label className="min-w-0 text-xs font-medium text-[#746a64]">Registro hasta<input aria-label="Registro hasta" type="date" value={filters.hasta} onChange={e => filtro('hasta', e.target.value)} className={campo} /></label>
        </div>
        <div className="mt-3 flex justify-end"><button type="button" onClick={() => { setFilters({ ...SURVEY_DEFAULT_FILTERS }); setBusqueda('') }} className="min-h-11 px-2 text-sm font-medium text-[#294A38] underline underline-offset-4">Limpiar filtros</button></div>
        {fechaIncorrecta && <p role="alert" className="mt-2 text-sm text-[#B01B30]">La fecha «desde» no puede ser posterior a «hasta».</p>}
      </section>
      <section aria-label="Resumen de encuestas" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Alumnas seleccionadas', value: resumen.total, note: 'Alumnas reales', tone: 'bg-[#F4CAD8] border-[#EC9BB6]/40' },
        { label: 'Encuestas completas', value: resumen.completas, note: resumen.total ? `${Math.round(resumen.completas * 100 / resumen.total)}% de la selección` : 'Sin base para calcular', tone: 'bg-[#EC9BB6] border-[#EC9BB6]' },
        { label: 'En curso', value: resumen.enCurso, note: 'Bienvenida pendiente', tone: 'bg-[#FFFDFA] border-[#EC9BB6]/45' },
        { label: 'Perfiles anteriores', value: resumen.anteriores, note: 'Sin encuesta completada', tone: 'bg-[#FAF7F3] border-[#EC9BB6]/45' },
      ].map(k => <article key={k.label} className={`min-w-0 rounded-[22px] border p-4 sm:p-5 ${k.tone}`}><p className="text-[10px] font-medium uppercase tracking-[.12em] text-[#655B56]">{k.label}</p><p className="mt-3 font-impact text-4xl font-semibold tabular-nums">{disponible ? k.value : '—'}</p><p className="mt-2 text-xs leading-5 text-[#655B56]">{k.note}</p></article>)}</section>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#746a64]"><p>{errorCarga ? 'Base no disponible' : `${reales} alumnas reales · administradoras excluidas`}</p><p>Los campos opcionales sin dato no se interpretan como «No».</p></div>
      <div className="mt-6 flex flex-wrap gap-2 border-b border-[#e7ddd5] pb-3" role="group" aria-label="Vista de la encuesta">{([{ id: 'resumen', label: 'Resumen visual' }, { id: 'respuestas', label: 'Respuestas' }, { id: 'preguntas', label: 'Preguntas' }] as const).map(t => <button key={t.id} type="button" aria-pressed={vista === t.id} onClick={() => setVista(t.id)} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium ${vista === t.id ? 'border-[#294A38] bg-[#294A38] text-white' : 'border-[#e7ddd5] bg-[#FFFDFA] text-[#746a64]'}`}>{t.label}</button>)}</div>
      {disponible && vista === 'resumen' && <>
        <PerfilEncuesta rows={seleccion} />
        <div className="mb-4 mt-7"><h2 className="text-xl font-semibold">Todas las respuestas, en perspectiva</h2><p className="mt-2 text-sm leading-6 text-[#746a64]">Estas distribuciones incluyen todos los perfiles seleccionados, también los que siguen en curso. Los datos faltantes quedan visibles.</p></div>
        <section aria-label="Gráficos de las respuestas" className="grid gap-4 lg:grid-cols-2"><Distribucion title="Edades" groups={resumen.edades} base={resumen.total} /><Distribucion title="Ingresos actuales" groups={resumen.ingresos} base={resumen.total} /><Distribucion title="Ocupación" groups={resumen.ocupaciones} base={resumen.total} /><Distribucion title="¿Son mamás?" groups={resumen.maternidad} base={resumen.total} /><Distribucion title="País" groups={resumen.paises} base={resumen.total} /><Distribucion title="Provincia / estado" groups={resumen.provincias} base={resumen.total} /></section>
      </>}
      {disponible && vista === 'respuestas' && <section className="mt-5" aria-label="Respuestas de las alumnas"><label className="block text-sm font-medium">Buscar alumna o país<input aria-label="Buscar respuestas" value={busqueda} onChange={e => setBusqueda(e.target.value)} className={`${campo} max-w-lg`} /></label><p className="mt-3 text-xs text-[#746a64]">{listado.length} de {resumen.total} en esta selección</p><div className="mt-4 space-y-3">{listado.map(r => <details key={r.id} className="rounded-[20px] border border-[#EC9BB6]/45 bg-[#FFFDFA] p-4 sm:p-5"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><span className="min-w-0 break-words text-sm font-semibold">{r.nombre}{r.prueba ? ' · Prueba' : ''}</span><span className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-[#e7ddd5] px-3 py-1">{TIPOS_ACCESO.find(t => t.id === r.tipo)?.etiqueta}</span><span className="rounded-full bg-[#F4CAD8] px-3 py-1">{nombresEstado[r.estadoEncuesta]}</span><span aria-hidden="true" className="text-[#294A38]">+</span></span></summary><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[
        ['Edad', r.edad === null ? null : `${r.edad} años`], ['País', r.pais], ['Provincia / estado', r.provincia], ['Ocupación', r.ocupacion], ['Título profesional', r.titulo_profesional], ['¿Es mamá?', r.es_mama === null ? null : r.es_mama ? 'Sí' : 'No'], ['Ingresos actuales', r.ingresos_actuales], ['Encuesta completada', r.completado_at ? fecha(r.completado_at) : null],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-[#746a64]">{label}</dt><dd className="mt-1 break-words text-sm">{value || 'Sin respuesta'}</dd></div>)}</dl></details>)}</div>{!listado.length && <p className="mt-4 rounded-[20px] border border-[#e7ddd5] bg-white p-6 text-sm text-[#746a64]">No hay respuestas con estos filtros.</p>}</section>}
      {disponible && vista === 'preguntas' && <section className="mt-5 rounded-[24px] border border-[#EC9BB6]/45 bg-[#FFFDFA] p-5 sm:p-6" aria-label="Cobertura de preguntas"><h2 className="text-xl font-semibold">Qué información tenemos</h2><p className="mt-2 text-sm text-[#746a64]">«Con dato» mide información disponible. «Contestada» incluye la elección de no informar un campo opcional.</p><ul className="mt-5 divide-y divide-[#e7ddd5]">{resumen.cobertura.map(p => <li key={p.campo} className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center"><div className="min-w-0"><h3 className="text-sm font-medium">{p.pregunta}</h3><p className="mt-1 text-xs text-[#746a64]">{p.opcional ? 'Opcional' : 'Obligatoria'}{p.campo === 'titulo_profesional' ? ' · solo cuando corresponde' : ''}</p></div><div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 text-xs tabular-nums"><span><strong className="font-impact font-semibold">{p.conDatos}/{p.total}</strong> con dato</span><span><strong className="font-impact font-semibold">{p.contestadas}/{p.total}</strong> contestadas</span></div></li>)}</ul></section>}
      <section className="mt-7 flex flex-col justify-between gap-4 rounded-[24px] border border-[#EC9BB6]/55 bg-[#F4CAD8]/35 p-5 sm:p-6 lg:flex-row lg:items-center" aria-label="Respaldo de la encuesta"><div className="min-w-0"><h2 className="text-lg font-semibold">Respuestas y respaldo</h2><p className="mt-2 text-sm leading-6 text-[#746a64]">Los gráficos consultan la plataforma. El Sheet es una copia manual; no tiene sincronización automática.</p></div><div className="flex shrink-0 flex-col gap-3 sm:flex-row"><a href={SURVEY_SHEET_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#294A38]/30 bg-[#FFFDFA] px-5 py-3 text-sm font-medium text-[#294A38]">Abrir Sheet <NavigationIcon name="encuesta" /></a>{disponible ? <a href={urlExportarEncuesta(filters)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-medium text-white" download>Descargar respuestas ↓</a> : <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e7ddd5] px-5 py-3 text-sm text-[#746a64]">Exportación no disponible</span>}</div></section>
    </main>
  </div>
}
