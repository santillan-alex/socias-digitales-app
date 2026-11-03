'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import ProximaClase from '@/app/inicio/ProximaClase'
import { AUDIENCIAS_AGENDA, validarHito, type HitoEditable, type AudienciaAgenda } from '@/lib/agenda-management'

type Formulario = { titulo: string; dia: string; hora: string; enlace: string; audiencias: AudienciaAgenda[] }
export default function AgendaAdmin() {
  const [form, setForm] = useState<Formulario>({ titulo: '', dia: '', hora: '', enlace: '', audiencias: ['desafio', 'socia'] })
  const [revision, setRevision] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<HitoEditable | null>(null)
  const [cargando, setCargando] = useState(true), [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(''), [error, setError] = useState('')
  const [ahora] = useState(() => Date.now())
  const aplicar = useCallback((data: { hito: HitoEditable; revision: string | null }) => {
    const h = data.hito
    setForm({ titulo: h.titulo, dia: h.fecha.slice(0, 10), hora: h.fecha.slice(11, 16), enlace: h.enlace || '', audiencias: h.audiencias })
    setRevision(data.revision); setGuardado(h)
  }, [])
  async function cargar() {
    setCargando(true); setError(''); setAviso('')
    try {
      const r = await fetch('/api/admin/agenda', { cache: 'no-store' }), data = await r.json()
      if (!r.ok) throw new Error(data.error)
      aplicar(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos cargar la agenda.') }
    finally { setCargando(false) }
  }
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/admin/agenda', { cache: 'no-store', signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data })
      .then(data => { if (!controller.signal.aborted) aplicar(data) })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No pudimos cargar la agenda.') })
      .finally(() => { if (!controller.signal.aborted) setCargando(false) })
    return () => controller.abort()
  }, [aplicar])
  async function guardar(publicado: boolean) {
    setOcupado(true); setError(''); setAviso('')
    try {
      validarHito({ ...form, publicado })
      const r = await fetch('/api/admin/agenda', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, hito: { ...form, publicado } }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      aplicar(data)
      setAviso(publicado ? 'Encuentro publicado. El banner y el contador se actualizan en las cuentas habilitadas (hasta un minuto).' : 'Encuentro guardado y oculto para las alumnas.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar. Comprobá el estado antes de reintentar.') }
    finally { setOcupado(false) }
  }
  let vista: HitoEditable | null = null
  try { vista = validarHito({ ...form, publicado: true }) } catch { /* Formulario aún incompleto. */ }
  return <main className="min-h-screen bg-[#F4EFEA] text-[#211C19]" data-platform-role="admin">
    <header data-admin-section-header="true" className="border-b border-[#E7DDD5] px-5 py-4"><a href="/admin" className="inline-flex min-h-11 items-center text-sm text-[#294A38]">← Panel de Flor</a></header>
    <AdminSectionMenu />
    <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Agenda</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h1 className="font-serif text-4xl font-semibold sm:text-5xl">Próximo hito</h1><span className="rounded-full border border-[#EC9BB6] bg-[#F4CAD8] px-4 py-2 text-xs font-semibold">{cargando ? 'Cargando…' : guardado?.publicado ? 'Publicado' : guardado ? 'Oculto' : 'Sin cargar'}</span></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Fecha, horario y acceso al próximo encuentro. Siempre en hora Argentina.</p>
      {error && <p role="alert" className="mt-5 rounded-2xl border border-[#B01B30]/35 bg-white p-4 text-sm text-[#B01B30]">{error}</p>}
      {aviso && <p role="status" className="mt-5 rounded-2xl border border-[#294A38]/25 bg-white p-4 text-sm text-[#294A38]">{aviso}</p>}
      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form className="min-w-0 space-y-5 rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-5 sm:p-7" onSubmit={e => { e.preventDefault(); void guardar(true) }}>
          <fieldset disabled={cargando || ocupado || !guardado} className="min-w-0 space-y-5 disabled:opacity-60">
            <label className="block text-sm font-medium">Título<input required maxLength={120} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base" /></label>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium">Fecha<input required type="date" min="2000-01-01" max="2099-12-31" value={form.dia} onChange={e => setForm({ ...form, dia: e.target.value })} className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base" /></label>
              <label className="block min-w-0 text-sm font-medium">Hora Argentina<input required type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base" /></label>
            </div>
            <label className="block text-sm font-medium">Enlace a la clase <span className="font-normal text-[#746A64]">(opcional)</span><input type="url" maxLength={2000} placeholder="https://…" value={form.enlace} onChange={e => setForm({ ...form, enlace: e.target.value })} className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base" /><span className="mt-2 block text-xs font-normal leading-5 text-[#746A64]">Si lo dejás vacío, “Entrar a la clase” queda deshabilitado.</span></label>
            <fieldset><legend className="text-sm font-medium">¿Quiénes lo ven?</legend><div className="mt-2 flex flex-wrap gap-x-6">{AUDIENCIAS_AGENDA.map(a => <label key={a} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.audiencias.includes(a)} onChange={e => setForm({ ...form, audiencias: e.target.checked ? [...form.audiencias, a] : form.audiencias.filter(x => x !== a) })} className="h-5 w-5 accent-[#294A38]" />{a === 'desafio' ? 'Desafío Socias habilitadas' : 'Socias activas'}</label>)}</div></fieldset>
            <div className="flex flex-wrap gap-3"><button type="submit" className="min-h-11 rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{ocupado ? 'Guardando…' : 'Publicar encuentro'}</button><button type="button" onClick={() => void guardar(false)} className="min-h-11 rounded-full border border-[#294A38]/30 px-5 py-3 text-sm font-medium text-[#294A38]">Guardar oculto</button></div>
          </fieldset>
          <button type="button" disabled={cargando || ocupado} onClick={() => { if (!guardado || window.confirm('¿Recargar la última versión? Se descartarán los cambios sin guardar.')) void cargar() }} className="min-h-11 text-sm font-medium text-[#294A38] underline underline-offset-4 disabled:opacity-50">{cargando ? 'Cargando agenda…' : 'Recargar última versión'}</button>
        </form>
        <aside className="min-w-0 space-y-4"><div className="rounded-3xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 sm:p-5"><h2 className="mb-4 text-sm font-semibold">Vista previa</h2>{vista ? <ProximaClase ahoraInicial={ahora} hitos={[vista]} /> : <p className="text-sm leading-6 text-[#746A64]">Completá título, fecha, hora y audiencia para ver el encuentro.</p>}</div><div className="rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-5"><h2 className="text-sm font-semibold">Comunicados, por separado</h2><p className="mt-2 text-sm leading-6 text-[#746A64]">Publicar acá actualiza la agenda, pero no envía emails ni push.</p><a href="/admin/notificaciones" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#294A38]">Ir a Notificaciones →</a></div></aside>
      </div>
    </div>
  </main>
}
