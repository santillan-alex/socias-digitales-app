import Link from 'next/link'
import ArrowIcon from './ArrowIcon'
import NavigationIcon from './NavigationIcon'
import SociasUpgradePanel from './SociasUpgradePanel'
import { RUTA_AULA_FARMASI } from '@/lib/farmasi-registration'
import { tiempoClase } from '@/lib/class-progress'
import type { ResumenInicioFarmasi } from '@/lib/farmasi-home'
import type { OfertaSocias } from '@/lib/socias-offer'

type Props = { resumen: ResumenInicioFarmasi | null; ofertaSocias?: OfertaSocias }
const foco = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]'

export default function FarmasiHomeSummary({ resumen, ofertaSocias }: Props) {
  const proxima = resumen?.proxima
  const retomando = proxima && proxima.desde !== null
  const href = proxima ? `${RUTA_AULA_FARMASI}&clase=${encodeURIComponent(proxima.id)}` : RUTA_AULA_FARMASI
  return <div data-inicio-farmasi="true">
    {resumen === null ? <section className="mt-6 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6 sm:p-8" aria-labelledby="farmasi-inicio-titulo">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#294A38]">Tu formación Farmasi</p>
      <h2 id="farmasi-inicio-titulo" className="mt-3 font-serif text-3xl font-semibold">Tus clases, a mano.</h2>
      <p role="alert" className="mt-4 text-sm leading-6 text-[#746A64]">No pudimos cargar tu biblioteca Farmasi. Volvé a intentar para recuperar tus clases y tu avance.</p>
      <Link href="/inicio" className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white ${foco}`}>Volver a intentar</Link>
    </section> : <>
      <section aria-labelledby="farmasi-inicio-titulo" className="mt-6 rounded-[26px] border border-[#EC9BB6] bg-[#F4CAD8] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#294A38]">Tu formación Farmasi</p>
            <h2 id="farmasi-inicio-titulo" className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-4xl">{retomando ? 'Seguí por donde lo dejaste.' : proxima ? 'Tu próximo paso, a tu ritmo.' : 'Tu espacio Farmasi.'}</h2>
            {proxima ? <>
              <h3 className="mt-4 break-words font-impact text-lg font-semibold [overflow-wrap:anywhere]">{proxima.titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-[#294A38]">{retomando ? `Retomá desde ${tiempoClase(proxima.desde ?? 0)}.` : 'Tu siguiente clase está lista para vos.'}</p>
            </> : <p className="mt-4 max-w-xl text-sm leading-6 text-[#294A38]">{resumen.clases ? 'Volvé a tus clases y materiales cada vez que los necesites.' : 'Las clases disponibles para tu acceso se reúnen acá.'}</p>}
          </div>
          <div className="min-w-0 lg:max-w-64 lg:shrink-0">
            <Link href={href} prefetch={false} className={`inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-[#294A38] px-5 py-3 text-center text-sm font-semibold text-white ${foco}`}>{retomando ? 'Retomar mi clase' : proxima ? 'Ver mi siguiente clase' : 'Ir a mis clases'}<ArrowIcon /></Link>
            {proxima && <Link href={RUTA_AULA_FARMASI} prefetch={false} className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-[#294A38] ${foco}`}>Ver todas mis clases <ArrowIcon diagonal /></Link>}
          </div>
        </div>
      </section>

      <section aria-label="Tu avance en Farmasi" className="mt-4 grid grid-cols-3 gap-3">
        {[
          { titulo: 'Clases disponibles', etiqueta: 'Clases', valor: resumen.clases, icono: 'clases' as const },
          { titulo: 'Completadas', etiqueta: 'Completas', valor: resumen.completadas, icono: 'checklist' as const },
          { titulo: 'En curso', etiqueta: 'En curso', valor: resumen.enCurso, icono: 'logros' as const },
        ].map(item => <article key={item.titulo} className="min-w-0 rounded-[20px] border border-[#E7DDD5] bg-[#FFFDFA] p-2 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-[#294A38]"><p className="text-sm leading-5 text-[#746A64]">{item.etiqueta}</p><span className="hidden sm:inline-flex"><NavigationIcon name={item.icono} /></span></div>
          <p className="mt-2 font-impact text-3xl font-semibold tabular-nums text-[#294A38]" aria-label={item.valor === null ? `${item.titulo}: sin comprobar` : `${item.titulo}: ${item.valor}`}>{item.valor ?? '—'}</p>
        </article>)}
      </section>
      {resumen.porcentaje !== null && <section aria-labelledby="farmasi-avance-titulo" className="mt-4 rounded-[20px] border border-[#E7DDD5] bg-[#FAF7F3] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="farmasi-avance-titulo" className="text-sm font-semibold">Tu recorrido Farmasi</h3><p className="text-xs text-[#746A64]">{resumen.completadas} de {resumen.clases} completadas</p></div>
        <div role="progressbar" aria-label="Avance en Farmasi" aria-valuenow={resumen.porcentaje} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded-full bg-[#E7DDD5]"><div className="h-full rounded-full bg-[#294A38]" style={{ width: `${resumen.porcentaje}%` }} /></div>
      </section>}
      {resumen.completadas === null && <div role="alert" className="mt-4 rounded-[20px] border border-[#EC9BB6] bg-[#FAF7F3] p-4 text-sm leading-6 text-[#746A64]">No pudimos cargar tu avance. Tus clases siguen disponibles. <Link href="/inicio" className={`inline-flex min-h-11 items-center font-semibold text-[#294A38] underline underline-offset-4 ${foco}`}>Volver a intentar</Link></div>}
    </>}
    <SociasUpgradePanel contexto="farmasi" ofertaSocias={ofertaSocias} />
  </div>
}

export function FarmasiHomeLoading() {
  return <section role="status" aria-busy="true" className="mt-6 rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-6"><p className="text-sm font-semibold">Reuniendo tu espacio Farmasi…</p><p className="mt-2 text-sm leading-6 text-[#746A64]">Tus clases y tu avance están en camino.</p></section>
}
