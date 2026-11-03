'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import ArrowIcon from '@/components/ArrowIcon'
import { cobroVencido, diasAcompanamiento, esCobroSocia, esDetalleSeguimiento, esListaSeguimiento, esPeriodoSocia,
  estadoAcompanamiento, ESTADOS_ACOMPANAMIENTO, ESTADOS_COBRO, fechaSeguimiento, fechaSeguimientoValida, finAcompanamiento,
  importeCobro, moverFechaSeguimiento, resumenSeguimiento, validarCobroSocia, validarPeriodoSocia,
  type CobroSocia, type DetalleSeguimiento, type ListaSeguimiento, type PeriodoSocia } from '@/lib/socia-followup'

const tarjeta = 'min-w-0 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 sm:p-6'
const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]'
const boton = `${control} border-[#E7DDD5] bg-[#FAF7F3] text-[#294A38]`
const principal = `${control} border-[#294A38] bg-[#294A38] text-white`
const campo = 'mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 py-3 text-base text-[#211C19] disabled:opacity-70 focus:outline-2 focus:outline-[#294A38]'
class ErrorPeticionSeguimiento extends Error { constructor(public status: number, mensaje: string) { super(mensaje) } }
async function pedir(url: string, method = 'GET', body?: unknown): Promise<Record<string, unknown>> {
  const control = new AbortController(), timeout = setTimeout(() => control.abort(), 20_000)
  try {
    const response = await fetch(url, { method, cache: 'no-store', signal: control.signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
    const data = await response.json()
    if (!response.ok) throw new ErrorPeticionSeguimiento(response.status, typeof data?.error === 'string' ? data.error : 'No pudimos confirmar la operación.')
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('No pudimos comprobar la respuesta. Reintentá el mismo guardado.')
    return data
  } finally { clearTimeout(timeout) }
}
function avisoError(error: unknown) { return error instanceof Error && error.name !== 'AbortError' ? error.message : 'La respuesta tardó demasiado. No sabemos si se guardó: reintentá el mismo envío.' }
function ErrorVisible({ children }: { children: React.ReactNode }) { return <p role="alert" className="rounded-2xl border border-[#B01B30]/35 bg-[#FFFDFA] p-4 text-sm leading-6 text-[#B01B30]">{children}</p> }
function useBorrador(activo: boolean) {
  useEffect(() => { if (!activo) return; const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', avisar); return () => window.removeEventListener('beforeunload', avisar) }, [activo])
}
function Etiqueta({ periodo, hoy }: { periodo: PeriodoSocia | null; hoy: string }) {
  const estado = estadoAcompanamiento(periodo, hoy)
  return <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${estado === 'vencido' ? 'bg-[#F4CAD8] text-[#B01B30]' : estado === 'por_vencer' ? 'bg-[#EC9BB6] text-[#211C19]' : 'bg-[#F4EFEA] text-[#294A38]'}`}>{ESTADOS_ACOMPANAMIENTO[estado]}</span>
}

export default function SociasSeguimiento({ inicial }: { inicial: ListaSeguimiento }) {
  const [lista, setLista] = useState(inicial), [detalle, setDetalle] = useState<DetalleSeguimiento | null>(null)
  const [busqueda, setBusqueda] = useState(''), [filtro, setFiltro] = useState('todas'), [prueba, setPrueba] = useState(inicial.estado === 'lista' && inicial.incluyePrueba)
  const [cargando, setCargando] = useState(false), [error, setError] = useState(''), [mensaje, setMensaje] = useState('')
  const [editor, setEditor] = useState<'periodo' | 'cobro' | null>(null), [cobroEditado, setCobroEditado] = useState<CobroSocia | null>(null)
  const mutex = useRef(false), viva = useRef(true), tituloFicha = useRef<HTMLHeadingElement>(null)
  useEffect(() => { viva.current = true; return () => { viva.current = false } }, [])
  const fichaId = detalle?.socia.id
  useEffect(() => { if (fichaId && !editor) tituloFicha.current?.focus() }, [fichaId, editor])
  async function cargar(incluirPrueba = prueba) {
    if (mutex.current || editor) return; mutex.current = true; setCargando(true); setError('')
    try {
      const data = await pedir(`/api/admin/socias${incluirPrueba ? '?prueba=1' : ''}`)
      if (!esListaSeguimiento(data) || data.incluyePrueba !== incluirPrueba) throw new Error('No pudimos comprobar la lista de Socias.')
      if (viva.current) { setLista(data); setPrueba(incluirPrueba); setDetalle(null) }
    } catch (cause) { if (viva.current) setError(avisoError(cause)) }
    finally { mutex.current = false; if (viva.current) setCargando(false) }
  }
  async function abrir(id: string) {
    if (mutex.current || editor) return; mutex.current = true; setCargando(true); setError('')
    try {
      const data = await pedir(`/api/admin/socias/${id}`)
      if (!esDetalleSeguimiento(data) || data.socia.id !== id) throw new Error('No pudimos comprobar la ficha de esta Socia.')
      if (viva.current) setDetalle(data)
    } catch (cause) { if (viva.current) setError(avisoError(cause)) }
    finally { mutex.current = false; if (viva.current) setCargando(false) }
  }
  function confirmarPeriodo(periodo: PeriodoSocia) {
    if (!detalle) return
    setDetalle({ ...detalle, socia: { ...detalle.socia, acompanamiento: periodo } }); setEditor(null)
    setMensaje('Ciclo confirmado. Sus clases y accesos no se modificaron. Actualizá la ficha para ver el historial más reciente.')
    setLista(actual => actual.estado === 'lista' ? { ...actual, socias: actual.socias.map(s => s.id === periodo.usuaria_id ? { ...s, acompanamiento: periodo } : s) } : actual)
  }
  function confirmarCobro(cobro: CobroSocia) {
    if (!detalle) return
    const aplicar = (pagos: CobroSocia[]) => [cobro, ...pagos.filter(c => c.id !== cobro.id)].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
    setDetalle({ ...detalle, socia: { ...detalle.socia, cobros: aplicar(detalle.socia.cobros) } }); setEditor(null); setCobroEditado(null)
    setMensaje('Registro confirmado. No se realizó un cobro ni se renovó el acompañamiento automáticamente. Actualizá la ficha para ver el historial más reciente.')
    setLista(actual => actual.estado === 'lista' ? { ...actual, socias: actual.socias.map(s => s.id === cobro.socia_id ? { ...s, cobros: aplicar(s.cobros) } : s) } : actual)
  }
  const socias = lista.estado === 'lista' ? lista.socias : [], consulta = busqueda.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
  const visibles = socias.filter(s => (filtro === 'todas' || estadoAcompanamiento(s.acompanamiento, lista.hoy) === filtro)
    && `${s.nombre ?? ''} ${s.whatsapp ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').includes(consulta))
  const resumen = lista.estado === 'lista' && !lista.limitado ? resumenSeguimiento(socias, lista.hoy) : null
  return <main className="min-h-screen bg-[#F4EFEA] text-[#211C19]" data-platform-role="admin">
    <header className="border-b border-[#E7DDD5] px-5 py-3"><Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#294A38]"><ArrowIcon className="rotate-180" />Panel de Flor</Link></header>
    <AdminSectionMenu />
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-7 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Seis meses, cerca de cada Socia</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Seguimiento de Socias</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Acompañamiento, próximas renovaciones y pagos a revisar.</p></div><button className={boton} disabled={cargando || Boolean(editor)} onClick={() => void (detalle ? abrir(detalle.socia.id) : cargar())}>Actualizar {detalle ? 'ficha' : 'seguimiento'}</button></div>
      {error && <ErrorVisible>{error}</ErrorVisible>}{mensaje && <p role="status" className="rounded-2xl border border-[#294A38]/25 bg-[#FFFDFA] p-4 text-sm leading-6">{mensaje}</p>}{cargando && <p role="status" className="text-sm text-[#746A64]">Comprobando registros…</p>}
      {!detalle && <>
        {lista.estado === 'error' ? <ErrorVisible>{lista.mensaje}</ErrorVisible> : <>
          <section aria-label="Resumen de acompañamiento y cobros" className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
            {[['Acompañamientos vigentes', resumen?.vigentes], ['Renuevan en 30 días', resumen?.por_vencer], ['Acompañamientos vencidos', resumen?.vencidas], ['Fecha por confirmar', resumen?.sin_fecha], ['Cobros pendientes', resumen?.pendientes], ['Cobros vencidos', resumen?.cobros_vencidos]].map(([label, valor], i) => <article key={String(label)} className={`min-w-0 rounded-[24px] border p-5 sm:p-6 ${i === 1 ? 'border-[#EC9BB6] bg-[#F4CAD8]' : 'border-[#E7DDD5] bg-[#FFFDFA]'}`}><h2 className="text-xs font-medium leading-5 text-[#746A64]">{label}</h2><p className="mt-3 font-sans text-3xl font-semibold tabular-nums">{valor ?? '—'}</p></article>)}
          </section>
          {lista.limitado && <p role="status" className="rounded-2xl border border-[#EC9BB6] p-4 text-sm leading-6">Vista parcial: se alcanzó el límite de 500 Socias o cobros. Los indicadores quedan sin calcular; no representan totales completos.</p>}
          <p className="text-xs leading-5 text-[#746A64]">Las fechas parten del inicio confirmado por el equipo, no del día de registro solamente. Los cobros son recordatorios manuales: esta vista no debita, envía mensajes ni bloquea cuentas. Referencia: {fechaSeguimiento(lista.hoy)}, hora Argentina.</p>
          <div className={`${tarjeta} grid min-w-0 gap-4 sm:grid-cols-2`}><label className="min-w-0 text-sm font-medium">Buscar Socia<input className={campo} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o WhatsApp" /></label><label className="min-w-0 text-sm font-medium">Acompañamiento<select className={campo} value={filtro} onChange={e => setFiltro(e.target.value)}><option value="todas">Todos los estados</option>{Object.entries(ESTADOS_ACOMPANAMIENTO).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label></div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-[#746A64]"><input type="checkbox" checked={prueba} disabled={cargando} onChange={e => void cargar(e.target.checked)} className="h-5 w-5 accent-[#294A38]" />Incluir cuenta de prueba, sin sumarla a los indicadores</label>
          {visibles.length === 0 ? <section className={`${tarjeta} py-10 text-center`}><h2 className="text-xl font-semibold">{socias.length ? 'No hay coincidencias con estos filtros.' : 'Las Socias van a aparecer acá.'}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#746A64]">{socias.length ? 'Probá con otro nombre o estado.' : 'Este seguimiento muestra cuentas del tipo Socias. Las cuentas Desafío y los permisos de Afiliadas se gestionan por separado.'}</p></section> : <div className="grid min-w-0 gap-4 lg:grid-cols-2">{visibles.map(s => <article key={s.id} className={tarjeta}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{s.nombre || 'Socia sin nombre'}</h2><p className="mt-2 break-words text-xs text-[#746A64]">{s.whatsapp || 'WhatsApp sin informar'} · Cuenta {s.estado ?? 'sin estado confirmado'}{s.prueba ? ' · Prueba excluida' : ''}</p></div><Etiqueta periodo={s.acompanamiento} hoy={lista.hoy} /></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[#746A64]">Inicio confirmado</p><p className="mt-1 font-semibold">{s.acompanamiento ? fechaSeguimiento(s.acompanamiento.inicio) : 'Por confirmar'}</p></div><div><p className="text-xs text-[#746A64]">Renueva el</p><p className="mt-1 font-semibold">{s.acompanamiento ? fechaSeguimiento(s.acompanamiento.fin) : '—'}</p></div></div><p className="mt-4 text-xs text-[#746A64]">{lista.limitado ? 'Cobros: lectura parcial' : `${s.cobros.filter(c => c.estado === 'pendiente').length} cobros pendientes · ${s.cobros.filter(c => cobroVencido(c, lista.hoy)).length} vencidos`}</p><button disabled={cargando} onClick={() => { setMensaje(''); void abrir(s.id) }} className={`${principal} mt-5`}>Ver seguimiento <ArrowIcon /></button></article>)}</div>}
        </>}
        {lista.estado === 'error' && <button className={principal} disabled={cargando} onClick={() => void cargar()}>Volver a comprobar</button>}
      </>}
      {detalle && <>
        <button className={boton} disabled={cargando || Boolean(editor)} onClick={() => { setDetalle(null); setError(''); setMensaje('') }}>← Todas las Socias</button>
        <section className={tarjeta}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-[#746A64]">Su recorrido, a mano</p><h2 ref={tituloFicha} tabIndex={-1} className="mt-2 scroll-mt-24 break-words text-2xl font-semibold outline-none">{detalle.socia.nombre || 'Socia sin nombre'}</h2><p className="mt-2 break-words text-sm text-[#746A64]">{detalle.socia.whatsapp || 'WhatsApp sin informar'} · Cuenta {detalle.socia.estado ?? 'sin estado confirmado'}{detalle.socia.prueba ? ' · Cuenta de prueba, fuera de indicadores' : ''}</p></div><Etiqueta periodo={detalle.socia.acompanamiento} hoy={detalle.hoy} /></div>
          {detalle.socia.acompanamiento ? <><dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{[['Inicio confirmado', detalle.socia.acompanamiento.inicio], ['Último día incluido', moverFechaSeguimiento(detalle.socia.acompanamiento.fin, -1)], ['Renueva el', detalle.socia.acompanamiento.fin]].map(([label, fecha]) => <div key={label}><dt className="text-xs text-[#746A64]">{label}</dt><dd className="mt-2 text-base font-semibold">{fechaSeguimiento(fecha)}</dd></div>)}<div><dt className="text-xs text-[#746A64]">Tiempo de acompañamiento</dt><dd className="mt-2 text-base font-semibold">{diasAcompanamiento(detalle.socia.acompanamiento.fin, detalle.hoy) > 0 ? `${diasAcompanamiento(detalle.socia.acompanamiento.fin, detalle.hoy)} días restantes` : 'Ciclo finalizado'}</dd></div></dl><p className="mt-5 text-xs leading-5 text-[#746A64]">El período comprende seis meses de calendario. Registrar o confirmar un pago no lo renueva por sí solo; cada renovación se confirma acá y conserva el ciclo anterior en el historial.</p></> : <p className="mt-5 max-w-2xl text-sm leading-6 text-[#746A64]">Todavía no hay un inicio confirmado. Revisá la fecha en que el pago y el alta estuvieron completos antes de registrarlo. No se calculó un vencimiento a partir de su inscripción.</p>}
          {!editor && <button className={`${principal} mt-5`} disabled={cargando} onClick={() => { setMensaje(''); setEditor('periodo') }}>{detalle.socia.acompanamiento ? 'Actualizar o renovar ciclo' : 'Confirmar inicio del acompañamiento'}</button>}
        </section>
        {editor === 'periodo' && <EditorPeriodo key={detalle.socia.id} detalle={detalle} onCerrar={() => setEditor(null)} onGuardado={confirmarPeriodo} />}
        <section className={tarjeta}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Pagos y recordatorios</h2><p className="mt-2 text-sm leading-6 text-[#746A64]">Lo pactado con esta Socia, sin mezclarlo con sus ventas ni comisiones.</p></div><button className={principal} disabled={cargando || Boolean(editor) || detalle.cobrosLimitados} onClick={() => { setCobroEditado(null); setMensaje(''); setEditor('cobro') }}>Registrar cobro +</button></div>
          {detalle.cobrosLimitados && <p role="status" className="mt-4 text-sm text-[#B01B30]">Se muestran los primeros 500 registros. Esta ficha necesita una revisión completa antes de agregar otros.</p>}
          {detalle.socia.cobros.length === 0 ? <p className="mt-5 text-sm leading-6 text-[#746A64]">No hay cobros registrados. Eso no significa que deba o que haya pagado: todavía falta cargar lo acordado.</p> : <div className="mt-5 space-y-3">{detalle.socia.cobros.map(c => <article key={c.id} className="min-w-0 rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-base font-semibold">{c.concepto}</h3><p className="mt-2 text-sm font-semibold">{importeCobro(c)}</p></div><span className={`rounded-full px-3 py-2 text-xs font-semibold ${cobroVencido(c, detalle.hoy) ? 'bg-[#F4CAD8] text-[#B01B30]' : 'bg-[#F4EFEA] text-[#294A38]'}`}>{cobroVencido(c, detalle.hoy) ? 'Pendiente vencido' : ESTADOS_COBRO[c.estado]}</span></div><p className="mt-3 text-sm text-[#746A64]">Vencimiento: {fechaSeguimiento(c.vencimiento)}{c.pagado_en ? ` · Pago confirmado: ${fechaSeguimiento(c.pagado_en)}` : ''}</p>{c.nota && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{c.nota}</p>}<button className={`${boton} mt-4`} disabled={cargando || Boolean(editor)} onClick={() => { setCobroEditado(c); setMensaje(''); setEditor('cobro') }}>Editar o confirmar pago</button></article>)}</div>}
        </section>
        {editor === 'cobro' && <EditorCobro key={cobroEditado?.id ?? 'nuevo'} sociaId={detalle.socia.id} hoy={detalle.hoy} inicial={cobroEditado} onCerrar={() => { setEditor(null); setCobroEditado(null) }} onGuardado={confirmarCobro} />}
        <section className={tarjeta}><h2 className="text-xl font-semibold">Historial de seguimiento</h2><p className="mt-2 text-xs leading-5 text-[#746A64]">Cambios confirmados por el equipo. El historial no se reemplaza al renovar.</p>{detalle.historial.length === 0 ? <p className="mt-4 text-sm text-[#746A64]">Todavía no hay cambios registrados en esta ficha.</p> : <ol className="mt-4 space-y-3">{detalle.historial.map(c => <li key={c.id} className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"><p className="text-xs text-[#746A64]">{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Cordoba' }).format(new Date(c.creado_en))} · Equipo de Flor</p><p className="mt-2 break-words text-sm font-semibold">{c.entidad === 'acompanamiento' ? c.anterior ? 'Ciclo actualizado' : 'Inicio confirmado' : c.nuevo.concepto}</p>{c.entidad === 'acompanamiento' ? <p className="mt-2 text-sm leading-6">{c.anterior?.inicio && c.anterior.fin ? `Antes: ${fechaSeguimiento(c.anterior.inicio)} · renovaba ${fechaSeguimiento(c.anterior.fin)}. ` : ''}Ahora: {fechaSeguimiento(c.nuevo.inicio!)} · renueva {fechaSeguimiento(c.nuevo.fin!)}.</p> : <p className="mt-2 text-sm leading-6">{c.anterior?.estado ? `Antes: ${ESTADOS_COBRO[c.anterior.estado as keyof typeof ESTADOS_COBRO]}. ` : ''}Ahora: {ESTADOS_COBRO[c.nuevo.estado as keyof typeof ESTADOS_COBRO]}.</p>}</li>)}</ol>}{detalle.historialLimitado && <p className="mt-4 text-xs text-[#746A64]">Se muestran los últimos 30 cambios. Los anteriores siguen conservados.</p>}</section>
      </>}
    </div>
  </main>
}

export function EditorPeriodo({ detalle, onCerrar, onGuardado }: { detalle: DetalleSeguimiento; onCerrar: () => void; onGuardado: (p: PeriodoSocia) => void }) {
  const [inicio, setInicio] = useState(detalle.socia.acompanamiento?.inicio ?? ''), [confirmado, setConfirmado] = useState(false), [error, setError] = useState(''), [guardando, setGuardando] = useState(false), [congelado, setCongelado] = useState(false)
  const intento = useRef<ReturnType<typeof validarPeriodoSocia> | null>(null), mutex = useRef(false), viva = useRef(true)
  useEffect(() => { viva.current = true; return () => { viva.current = false } }, [])
  useBorrador(Boolean(inicio && inicio !== detalle.socia.acompanamiento?.inicio || confirmado || congelado))
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (mutex.current) return; setError('')
    let entrada = intento.current
    if (!entrada) {
      try {
        const visible = new FormData(event.currentTarget)
        entrada = validarPeriodoSocia({ inicio: visible.get('inicio'), version: detalle.socia.acompanamiento?.version ?? null, confirmacion_pago: visible.get('confirmacion_pago') === 'on' }, detalle.hoy, detalle.socia.alta)
      }
      catch (cause) { setError(avisoError(cause)); return }
      intento.current = entrada; setCongelado(true)
    }
    mutex.current = true; setGuardando(true)
    try {
      const data = await pedir(`/api/admin/socias/${detalle.socia.id}/acompanamiento`, 'PUT', { inicio: entrada.inicio, version: entrada.version, confirmacion_pago: true })
      if (data.ok !== true || !esPeriodoSocia(data.periodo) || data.periodo.usuaria_id !== detalle.socia.id || data.periodo.inicio !== entrada.inicio || data.periodo.fin !== entrada.fin || data.periodo.version !== (entrada.version === null ? 1 : entrada.version + 1)) throw new Error('No pudimos comprobar el período guardado. Reintentá el mismo envío.')
      if (viva.current) { setCongelado(false); onGuardado(data.periodo) }
    } catch (cause) { if (viva.current) setError(avisoError(cause)) }
    finally { mutex.current = false; if (viva.current) setGuardando(false) }
  }
  const fin = fechaSeguimientoValida(inicio) ? finAcompanamiento(inicio) : null
  return <form onSubmit={guardar} aria-labelledby="editar-ciclo-socia" className={`${tarjeta} border-[#EC9BB6]`}><h2 id="editar-ciclo-socia" className="text-xl font-semibold">Confirmar el ciclo de acompañamiento</h2><p className="mt-2 text-sm leading-6 text-[#746A64]">Elegí el día en que el pago y el alta ya estaban confirmados. Son seis meses de calendario; este guardado no acredita una transacción bancaria.</p><fieldset disabled={guardando || congelado} className="mt-5 min-w-0 space-y-4"><label className="block max-w-sm text-sm font-medium">Inicio de este ciclo<input autoFocus type="date" name="inicio" value={inicio} min={detalle.socia.alta ?? '2000-01-01'} max={detalle.hoy} onChange={e => setInicio(e.target.value)} required className={campo} /></label>{fin && <div className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 text-sm leading-6"><p>Último día incluido: <strong>{fechaSeguimiento(moverFechaSeguimiento(fin, -1))}</strong></p><p>Renueva el: <strong>{fechaSeguimiento(fin)}</strong></p></div>}<label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" name="confirmacion_pago" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#294A38]" />Confirmo que revisé el pago y el alta, y que esta es la fecha correcta.</label></fieldset>{error && <div className="mt-4"><ErrorVisible>{error}</ErrorVisible></div>}{congelado && !guardando && <p className="mt-4 text-xs leading-5 text-[#746A64]">Los datos enviados se conservan para comprobar el mismo guardado. Si necesitás cambiarlos o revisar un conflicto, cerrá el editor y actualizá la ficha antes de volver a editar.</p>}<div className="mt-5 flex flex-wrap gap-3"><button type="submit" disabled={guardando} className={principal}>{guardando ? 'Confirmando…' : congelado ? 'Reintentar mismo guardado' : 'Confirmar ciclo'}</button><button type="button" disabled={guardando} onClick={onCerrar} className={boton}>{congelado ? 'Cerrar y revisar ficha' : 'Cancelar'}</button></div></form>
}

interface FormularioCobro { concepto: string; vencimiento: string; monto: string; moneda: string; estado: CobroSocia['estado']; pagado_en: string; nota: string }
function formularioCobro(cobro: CobroSocia | null): FormularioCobro { return { concepto: cobro?.concepto ?? '', vencimiento: cobro?.vencimiento ?? '', monto: cobro?.monto == null ? '' : String(cobro.monto), moneda: cobro?.moneda ?? '', estado: cobro?.estado ?? 'pendiente', pagado_en: cobro?.pagado_en ?? '', nota: cobro?.nota ?? '' } }
export function EditorCobro({ sociaId, hoy, inicial, onCerrar, onGuardado }: { sociaId: string; hoy: string; inicial: CobroSocia | null; onCerrar: () => void; onGuardado: (c: CobroSocia) => void }) {
  const [form, setForm] = useState(() => formularioCobro(inicial)), [verificado, setVerificado] = useState(false), [error, setError] = useState(''), [guardando, setGuardando] = useState(false), [congelado, setCongelado] = useState(false)
  const intento = useRef<ReturnType<typeof validarCobroSocia> | null>(null), mutex = useRef(false), viva = useRef(true)
  useEffect(() => { viva.current = true; return () => { viva.current = false } }, [])
  useBorrador(congelado || verificado || JSON.stringify(form) !== JSON.stringify(formularioCobro(inicial)))
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (mutex.current) return; setError('')
    let entrada = intento.current
    if (!entrada) {
      try {
        const visible = new FormData(event.currentTarget)
        const valor = (key: string) => { const x = visible.get(key); return typeof x === 'string' ? x : '' }
        const estado = valor('estado'), monto = valor('monto').trim()
        if (monto && !/^\d+(?:[.,]\d{1,2})?$/.test(monto)) throw new Error('Revisá el importe: usá números y hasta dos decimales, sin separadores de miles.')
        if (estado === 'pagado' && visible.get('verificado') !== 'on') throw new Error('Confirmá que verificaste el pago antes de marcarlo como pagado.')
        entrada = validarCobroSocia({ id: inicial?.id ?? crypto.randomUUID(), version: inicial?.version ?? null, concepto: valor('concepto'), vencimiento: valor('vencimiento'), monto: monto ? Number(monto.replace(',', '.')) : null,
          moneda: valor('moneda') || null, estado, pagado_en: estado === 'pagado' ? valor('pagado_en') : null, nota: valor('nota') || null }, hoy)
      } catch (cause) { setError(avisoError(cause)); return }
      intento.current = entrada; setCongelado(true)
    }
    mutex.current = true; setGuardando(true)
    try {
      const payload = { id: entrada.id, version: entrada.version, ...entrada.datos }
      const data = await pedir(`/api/admin/socias/${sociaId}/cobros${inicial ? `/${entrada.id}` : ''}`, inicial ? 'PATCH' : 'POST', payload)
      const guardado = data.cobro
      if (data.ok !== true || !esCobroSocia(guardado) || guardado.id !== entrada.id || guardado.socia_id !== sociaId || guardado.version !== (entrada.version === null ? 1 : entrada.version + 1) || !Object.entries(entrada.datos).every(([k, v]) => guardado[k as keyof CobroSocia] === v)) throw new Error('No pudimos comprobar el cobro guardado. Reintentá el mismo envío.')
      if (viva.current) { setCongelado(false); onGuardado(guardado) }
    } catch (cause) { if (viva.current) setError(avisoError(cause)) }
    finally { mutex.current = false; if (viva.current) setGuardando(false) }
  }
  function cambiar<K extends keyof FormularioCobro>(key: K, value: FormularioCobro[K]) { setForm(actual => ({ ...actual, [key]: value })); if (key === 'estado') setVerificado(false) }
  return <form onSubmit={guardar} aria-labelledby="editar-cobro-socia" className={`${tarjeta} border-[#EC9BB6]`}><h2 id="editar-cobro-socia" className="text-xl font-semibold">{inicial ? 'Revisar cobro' : 'Registrar un cobro'}</h2><p className="mt-2 text-sm leading-6 text-[#746A64]">Cargá lo acordado. Podés dejar el importe por definir; no se genera una deuda ni se cobra desde esta pantalla.</p><fieldset disabled={guardando || congelado} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-medium sm:col-span-2">Concepto<input autoFocus name="concepto" maxLength={160} required value={form.concepto} onChange={e => cambiar('concepto', e.target.value)} className={campo} placeholder="Por ejemplo, cuota o renovación acordada" /></label><label className="min-w-0 text-sm font-medium">Vencimiento<input type="date" min="2000-01-01" max="2099-12-31" required name="vencimiento" value={form.vencimiento} onChange={e => cambiar('vencimiento', e.target.value)} className={campo} /></label><label className="min-w-0 text-sm font-medium">Estado<select name="estado" value={form.estado} onChange={e => cambiar('estado', e.target.value as FormularioCobro['estado'])} className={campo}>{Object.entries(ESTADOS_COBRO).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="min-w-0 text-sm font-medium">Importe, si está definido<input name="monto" inputMode="decimal" maxLength={14} value={form.monto} onChange={e => cambiar('monto', e.target.value)} placeholder="Sin definir" className={campo} /></label><label className="min-w-0 text-sm font-medium">Moneda<select name="moneda" value={form.moneda} onChange={e => cambiar('moneda', e.target.value)} className={campo}><option value="">Sin definir</option><option value="ARS">ARS · Pesos argentinos</option><option value="USD">USD · Dólares</option></select></label>{form.estado === 'pagado' && <><label className="min-w-0 text-sm font-medium">Fecha del pago confirmado<input type="date" min="2000-01-01" max={hoy} required name="pagado_en" value={form.pagado_en} onChange={e => cambiar('pagado_en', e.target.value)} className={campo} /></label><label className="flex min-h-11 items-center gap-3 text-sm leading-6"><input type="checkbox" name="verificado" className="h-5 w-5 shrink-0 accent-[#294A38]" checked={verificado} onChange={e => setVerificado(e.target.checked)} />Verifiqué este pago antes de confirmarlo.</label></>}<label className="min-w-0 text-sm font-medium sm:col-span-2">Nota interna, opcional<textarea name="nota" rows={3} maxLength={1200} value={form.nota} onChange={e => cambiar('nota', e.target.value)} className={campo} placeholder="Acuerdo o próximo seguimiento. No guardes datos de tarjetas ni contraseñas." /></label></fieldset>{error && <div className="mt-4"><ErrorVisible>{error}</ErrorVisible></div>}{congelado && !guardando && <p className="mt-4 text-xs leading-5 text-[#746A64]">Se conserva el mismo identificador y los datos enviados. Reintentar no agrega un segundo cobro; para cambiar el contenido, cerrá y actualizá la ficha primero.</p>}<div className="mt-5 flex flex-wrap gap-3"><button type="submit" disabled={guardando} className={principal}>{guardando ? 'Confirmando…' : congelado ? 'Reintentar mismo guardado' : 'Guardar registro'}</button><button type="button" disabled={guardando} onClick={onCerrar} className={boton}>{congelado ? 'Cerrar y revisar ficha' : 'Cancelar'}</button></div></form>
}
