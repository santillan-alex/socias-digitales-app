'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'
import { aplicarAccesoConfirmado, esAccesoAfiliadas, type CuentaAfiliada, type ListaAccesosAfiliadas } from '@/lib/affiliate-access-client'

const boton = 'inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 py-2 text-sm font-semibold text-[#294A38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
const primario = 'inline-flex min-h-11 items-center justify-center rounded-full border border-[#294A38] bg-[#294A38] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] disabled:opacity-50'
export default function AfiliadasAccesos({ inicial }: { inicial: ListaAccesosAfiliadas }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState(''), [verPrueba, setVerPrueba] = useState(false), [filtro, setFiltro] = useState('todas')
  const [cambios, setCambios] = useState<Record<string, CuentaAfiliada['acceso']>>({}), [intento, setIntento] = useState<{ cuenta: CuentaAfiliada; habilitada: boolean; version: number | null } | null>(null)
  const [ocupada, setOcupada] = useState(false), [error, setError] = useState(''), [mensaje, setMensaje] = useState(''), [conflicto, setConflicto] = useState(false)
  const enviando = useRef(false)
  async function guardar() {
    if (!intento || enviando.current || conflicto) return
    enviando.current = true; setOcupada(true); setError(''); setMensaje('')
    const controller = new AbortController(), tiempo = setTimeout(() => controller.abort(), 20_000)
    try {
      const res = await fetch(`/api/admin/afiliadas/accesos/${intento.cuenta.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habilitada: intento.habilitada, version: intento.version }), signal: controller.signal })
      const data = await res.json()
      if (!res.ok || !data.ok || !esAccesoAfiliadas(data.acceso) || data.acceso.usuaria_id !== intento.cuenta.id || data.acceso.habilitada !== intento.habilitada || data.acceso.version !== (intento.version ?? 0) + 1) {
        if ([400, 401, 403, 404, 409, 415].includes(res.status)) setConflicto(true)
        throw new Error(data.error || 'La respuesta no confirmó el permiso. Reintentá el mismo envío.')
      }
      setCambios(c => ({ ...c, [intento.cuenta.id]: data.acceso })); setMensaje(intento.habilitada ? 'Acceso a Afiliadas habilitado.' : 'Acceso a Afiliadas retirado.'); setIntento(null)
    } catch (cause) { setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'No pudimos confirmar el guardado. Reintentá el mismo envío.') }
    finally { clearTimeout(tiempo); enviando.current = false; setOcupada(false) }
  }
  const cuentas = inicial.estado === 'lista' ? inicial.cuentas.map(c => aplicarAccesoConfirmado(c, cambios[c.id])) : []
  const reales = cuentas.filter(c => !c.prueba)
  const visibles = cuentas.filter(c => (verPrueba || !c.prueba) && (filtro === 'todas' || (filtro === 'habilitadas' ? c.acceso?.habilitada : !c.acceso?.habilitada)) && c.nombre.toLocaleLowerCase('es-AR').includes(busqueda.trim().toLocaleLowerCase('es-AR')))
  return <div className="min-h-screen bg-[#F4EFEA]" data-platform-role="admin"><header data-admin-section-header="true" className="border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-4"><Link href="/admin" className="inline-flex min-h-11 items-center text-sm text-[#294A38]">← Panel de Flor</Link></header><AdminSectionMenu /><main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Espacio Afiliadas</p><h1 className="mt-2 text-4xl sm:text-5xl">Accesos de Afiliadas</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#746A64]">Elegí quién recibe los mensajes y materiales para vender. Este permiso no modifica su plan Socias o Desafío.</p>
    <Link href="/admin/afiliadas" className={`${boton} mt-5`}>Gestionar mensajes y materiales →</Link>
    {inicial.estado === 'error' ? <section className="mt-6 rounded-3xl border border-[#EC9BB6] bg-[#FFFDFA] p-5"><p role="alert">{inicial.mensaje}</p><button className={`${boton} mt-4`} onClick={() => router.refresh()}>Reintentar</button></section> : <>
      <div className="mt-6 rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-5"><p className="text-sm"><strong className="text-2xl text-[#294A38]">{reales.filter(c => c.acceso?.habilitada && c.estado === 'activa').length}</strong> con acceso vigente <span className="mx-2 text-[#746A64]">·</span> {reales.length} cuentas revisadas</p>{inicial.limitado && <p role="alert" className="mt-3 text-sm">Vista limitada a 500 cuentas. Estas cifras corresponden solo a la lista cargada.</p>}</div>
      <div className="mt-6 flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 text-sm">Buscar por nombre<input type="search" disabled={!!intento} value={busqueda} onChange={e => setBusqueda(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 text-base" /></label><label className="text-sm">Acceso<select disabled={!!intento} value={filtro} onChange={e => setFiltro(e.target.value)} className="mt-2 block min-h-11 rounded-xl border border-[#E7DDD5] bg-[#FFFDFA] px-3 text-base"><option value="todas">Todas</option><option value="habilitadas">Habilitadas</option><option value="sin_acceso">Sin acceso</option></select></label><label className="inline-flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={verPrueba} disabled={!!intento} onChange={e => setVerPrueba(e.target.checked)} /> Ver cuenta de prueba</label></div>
      {intento && <section aria-labelledby="confirmar-afiliadas" className="mt-6 rounded-3xl border border-[#EC9BB6] bg-[#F4CAD8] p-5"><h2 id="confirmar-afiliadas" className="text-lg font-semibold">{intento.habilitada ? 'Habilitar' : 'Retirar'} acceso a {intento.cuenta.nombre}</h2><p className="mt-2 text-sm leading-6">Se modifica únicamente el espacio de Afiliadas. No se envían mensajes ni se cambia el acceso a clases.</p>{error && <p role="alert" className="mt-3 text-sm">{error}</p>}<div className="mt-4 flex flex-wrap gap-3"><button disabled={ocupada || conflicto} onClick={() => void guardar()} className={primario}>{ocupada ? 'Guardando…' : error ? 'Reintentar mismo envío' : 'Confirmar acceso'}</button><button disabled={ocupada || (!!error && !conflicto)} onClick={() => { setIntento(null); setError(''); setConflicto(false) }} className={boton}>Cancelar</button>{conflicto && <button className={boton} onClick={() => { setIntento(null); setError(''); setConflicto(false); router.refresh() }}>Actualizar lista</button>}</div></section>}
      {mensaje && <p role="status" className="mt-5 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4 text-sm">{mensaje}</p>}
      <div className="mt-6 space-y-3">{visibles.length === 0 ? <p className="rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-sm text-[#746A64]">No hay cuentas para estos filtros.</p> : visibles.map(c => <article key={c.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#E7DDD5] bg-[#FFFDFA] p-5"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{c.nombre}{c.prueba ? ' · Cuenta de prueba' : ''}</h2><p className="mt-1 text-sm text-[#746A64]">{c.tipo === 'socia' ? 'Socia' : c.tipo === 'desafio' ? 'Desafío' : 'Gratuita'} · {c.estado}</p><p className="mt-2 text-sm text-[#294A38]">{c.acceso?.habilitada ? c.estado === 'activa' ? 'Afiliadas habilitado' : 'Permiso conservado; cuenta no activa' : 'Afiliadas sin habilitar'}</p></div><button disabled={!!intento || (!c.acceso?.habilitada && c.estado !== 'activa')} onClick={() => { setError(''); setMensaje(''); setConflicto(false); setIntento({ cuenta: c, habilitada: !c.acceso?.habilitada, version: c.acceso?.version ?? null }) }} className={boton}>{c.acceso?.habilitada ? 'Retirar acceso' : 'Habilitar Afiliadas'}</button></article>)}</div>
    </>}
  </main></div>
}
