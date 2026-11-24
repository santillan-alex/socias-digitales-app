import Link from 'next/link'
import ArrowIcon from './ArrowIcon'
import NavigationIcon from './NavigationIcon'
import type { OfertaSocias } from '@/lib/socias-offer'

export type OfertaSociasParaVista = OfertaSocias

type Props = {
  formato?: 'resumen' | 'completo'
  ofertaSocias?: OfertaSociasParaVista
}

const BENEFICIOS = [
  { icono: 'clases', titulo: 'Clases y materiales', texto: 'Volvé a tus clases grabadas y sus recursos cada vez que los necesites.' },
  { icono: 'comunidad', titulo: 'Una comunidad para crecer', texto: 'Compartí tus avances, hacé preguntas y aprendé con otras socias.' },
  { icono: 'checklist', titulo: 'De la idea a la acción', texto: 'Organizá tus tareas en Mi día y hacé lugar para tus próximos pasos.' },
  { icono: 'resultados', titulo: 'Tus avances, a la vista', texto: 'Registrá tus resultados y seguí la evolución de tu negocio con tus métricas.' },
] as const

function destinoSeguro(valor: string | null | undefined) {
  if (!valor) return null
  try {
    const url = new URL(valor)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export default function SociasUpgradePanel({ formato = 'resumen', ofertaSocias }: Props) {
  const completo = formato === 'completo'
  const accionUrl = destinoSeguro(ofertaSocias?.accionUrl)
  const precio = ofertaSocias?.precioTexto?.trim()

  if (!completo) return <section aria-labelledby="upgrade-socias-titulo" className="mt-9 rounded-[26px] border border-[#EC9BB6] bg-[#F4CAD8] p-5 sm:p-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[.19em] text-[#294A38]">Tu próximo paso · Socias Digitales</p>
        <h2 id="upgrade-socias-titulo" className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-4xl">Hay mucho más para vos.</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#294A38]">Sumá formación, comunidad y acompañamiento para seguir construyendo tu negocio digital.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#294A38]">
          {['Clases y recursos', 'Comunidad', '6 meses de acompañamiento'].map(texto => <span key={texto} className="rounded-full border border-[#EC9BB6] bg-[#FAF7F3] px-3 py-2">{texto}</span>)}
        </div>
      </div>
      <div className="min-w-0 lg:max-w-72 lg:shrink-0">
        {precio && <p className="mb-3 break-words font-impact text-lg font-semibold text-[#294A38] [overflow-wrap:anywhere]">{precio}</p>}
        <Link href="/socias" prefetch={false} className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-[#294A38] px-5 py-3 text-center text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38] sm:w-auto">Conocer Socias Digitales <ArrowIcon /></Link>
      </div>
    </div>
  </section>

  return <section aria-labelledby="socias-propuesta-titulo" className="space-y-5">
    <div className="grid gap-5 rounded-[28px] border border-[#EC9BB6] bg-[#F4CAD8] p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)] lg:items-center lg:p-10">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Formación · Comunidad · Acción</p>
        <h2 id="socias-propuesta-titulo" className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-5xl">Tu negocio digital, con un lugar para crecer.</h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#294A38]">Uní lo que aprendés, lo que ponés en práctica y lo que compartís con otras socias.</p>
      </div>
      <div className="min-w-0 rounded-[24px] border border-[#294A38] bg-[#294A38] p-6 text-white sm:p-8">
        <p className="text-xs font-medium text-[#F4CAD8]">Cerca tuyo en cada etapa</p>
        <p className="mt-3 font-impact text-6xl font-semibold leading-none tracking-tight">6 <span className="text-2xl font-medium">meses</span></p>
        <p className="mt-3 text-base font-semibold">de acompañamiento</p>
        <p className="mt-3 text-sm leading-6 text-[#FAF7F3]">Para aprender y avanzar con el equipo de Flor.</p>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      {BENEFICIOS.map(beneficio => <article key={beneficio.icono} className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 sm:p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F4CAD8] text-[#294A38]"><NavigationIcon name={beneficio.icono} /></span>
        <h3 className="mt-4 break-words font-impact text-lg font-semibold">{beneficio.titulo}</h3>
        <p className="mt-2 text-sm leading-6 text-[#746A64]">{beneficio.texto}</p>
      </article>)}
    </div>

    <div className="flex flex-col gap-5 rounded-[24px] border border-[#EC9BB6] bg-[#FAF7F3] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#294A38]">Tu upgrade</p>
        <h3 className="mt-2 font-impact text-2xl font-semibold">Socias Digitales</h3>
        {precio && <p className="mt-3 break-words font-impact text-2xl font-semibold text-[#294A38] [overflow-wrap:anywhere]">{precio}</p>}
        <p className="mt-2 max-w-xl text-xs leading-5 text-[#746A64]">El acompañamiento dura seis meses. Su renovación se coordina al finalizar ese período.</p>
      </div>
      <div className="min-w-0 lg:max-w-72 lg:shrink-0">
        {accionUrl ? <a href={accionUrl} rel="noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-[#294A38] px-6 py-3 text-center text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]">Quiero ser Socia <ArrowIcon /></a>
          : <><button type="button" disabled aria-describedby="socias-inscripcion-pendiente" className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-[#D8CFC8] bg-[#E7DDD5] px-6 py-3 text-center text-sm font-semibold text-[#746A64]">Quiero ser Socia <ArrowIcon /></button><p id="socias-inscripcion-pendiente" className="mt-3 text-xs leading-5 text-[#746A64]">Enlace de inscripción por confirmar.</p></>}
      </div>
    </div>
  </section>
}
