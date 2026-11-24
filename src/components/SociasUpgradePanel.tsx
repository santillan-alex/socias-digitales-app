import Link from 'next/link'
import ArrowIcon from './ArrowIcon'
import NavigationIcon from './NavigationIcon'
import type { OfertaSocias } from '@/lib/socias-offer'
import { rutaMuestraSocias, type MuestraSocias } from '@/lib/socias-upgrade'

export type OfertaSociasParaVista = OfertaSocias
type Props = {
  formato?: 'resumen' | 'completo'
  contexto?: 'general' | 'farmasi'
  ofertaSocias?: OfertaSociasParaVista
  muestra?: MuestraSocias | null
}
const BENEFICIOS = [
  { icono: 'clases', etapa: 'Aprendé', titulo: 'Clases y materiales', texto: 'Volvé a tus clases grabadas, repasá lo que necesitás y encontrá los recursos de cada encuentro.', tono: 'bg-[#FFFDFA] border-[#E7DDD5]' },
  { icono: 'comunidad', etapa: 'Compartí', titulo: 'Una comunidad para crecer', texto: 'Hacé preguntas, compartí tus avances y conocé lo que están construyendo otras socias.', tono: 'bg-[#F4CAD8] border-[#EC9BB6]' },
  { icono: 'checklist', etapa: 'Ponelo en práctica', titulo: 'De la idea a la acción', texto: 'Organizá tus tareas en Mi día y transformá lo que aprendés en próximos pasos concretos.', tono: 'bg-[#FAF7F3] border-[#E7DDD5]' },
  { icono: 'resultados', etapa: 'Mirá tu evolución', titulo: 'Tus avances, a la vista', texto: 'Registrá tus ventas, seguí tus métricas y compartí tus resultados aprobados.', tono: 'bg-[#FFFDFA] border-[#EC9BB6]' },
] as const
const foco = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]'
const boton = 'inline-flex min-h-11 items-center justify-center gap-3 rounded-full px-5 py-3 text-center text-sm font-semibold ' + foco

function destinoSeguro(valor: string | null | undefined) {
  if (!valor) return null
  try {
    const url = new URL(valor)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export default function SociasUpgradePanel({ formato = 'resumen', contexto = 'general', ofertaSocias, muestra }: Props) {
  const completo = formato === 'completo'
  const farmasi = contexto === 'farmasi'
  const accionUrl = destinoSeguro(ofertaSocias?.accionUrl)
  const precio = ofertaSocias?.precioTexto?.trim()
  const muestraUrl = rutaMuestraSocias(muestra)

  if (!completo) return <section aria-labelledby="upgrade-socias-titulo" className="mt-9 rounded-[26px] border border-[#EC9BB6] bg-[#F4CAD8] p-5 sm:p-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#294A38]">Tu próximo paso · Socias Digitales</p>
        <h2 id="upgrade-socias-titulo" className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-4xl">{farmasi ? 'Sumá un nuevo capítulo a tu camino.' : 'Hay mucho más para vos.'}</h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-[#294A38]">{farmasi ? 'A tu formación Farmasi, sumale clases, herramientas y una comunidad para desarrollar tu negocio digital.' : 'Sumá formación, comunidad y acompañamiento para seguir construyendo tu negocio digital.'}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium text-[#294A38]">
          {['Clases y recursos', 'Comunidad', '6 meses de acompañamiento'].map(texto => <span key={texto} className="rounded-full border border-[#EC9BB6] bg-[#FAF7F3] px-3 py-2">{texto}</span>)}
        </div>
        {farmasi && <p className="mt-4 text-sm font-medium text-[#294A38]">Tu espacio Farmasi se conserva.</p>}
      </div>
      <div className="min-w-0 lg:max-w-72 lg:shrink-0">
        {precio && <p className="mb-3 break-words font-impact text-lg font-semibold text-[#294A38] [overflow-wrap:anywhere]">{precio}</p>}
        <Link href="/socias" prefetch={false} className={boton + ' w-full bg-[#294A38] text-white sm:w-auto'}>Conocer Socias Digitales <ArrowIcon /></Link>
      </div>
    </div>
  </section>

  return <section aria-labelledby="socias-propuesta-titulo" className="space-y-6">
    <div className="grid gap-6 rounded-[28px] border border-[#EC9BB6] bg-[#F4CAD8] p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)] lg:items-center lg:p-10">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#294A38]">Formación · Comunidad · Acción</p>
        <h2 id="socias-propuesta-titulo" className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-5xl">{farmasi ? 'Sumá Socias Digitales a tu camino.' : 'Aprendé, ponelo en práctica y crecé acompañada.'}</h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#294A38]">{farmasi ? 'Ya estás dando tus pasos en Farmasi. Sumá nuevas herramientas, formación y una comunidad para seguir construyendo tu negocio digital.' : 'Tus clases, tus ideas y tus avances tienen un lugar para encontrarse. Con el equipo de Flor y otras socias que también están en camino.'}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {accionUrl && <a href={accionUrl} rel="noreferrer" className={boton + ' bg-[#294A38] text-white'}>Quiero ser Socia <ArrowIcon /></a>}
          <a href="#socias-beneficios" className={boton + (accionUrl ? ' border border-[#294A38] bg-[#FAF7F3] text-[#294A38]' : ' bg-[#294A38] text-white')}>Ver qué incluye</a>
        </div>
        {farmasi && <p className="mt-4 text-sm font-medium text-[#294A38]">Tu espacio Farmasi se conserva.</p>}
      </div>
      <div className="min-w-0 rounded-[24px] border border-[#294A38] bg-[#294A38] p-6 text-white sm:p-8">
        <p className="text-sm font-medium text-[#F4CAD8]">Cerca tuyo en cada etapa</p>
        <p className="mt-3 font-impact text-6xl font-semibold leading-none tracking-tight">6 <span className="text-2xl font-medium">meses</span></p>
        <p className="mt-3 text-base font-semibold">de acompañamiento</p>
        <p className="mt-3 text-base leading-7 text-[#FAF7F3]">Para aprender, compartir y avanzar con el equipo de Flor.</p>
      </div>
    </div>

    {farmasi && <section aria-labelledby="socias-nuevo-capitulo" className="grid gap-3 sm:grid-cols-2">
      <div className="min-w-0 rounded-[22px] border border-[#E7DDD5] bg-[#FAF7F3] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#746A64]">Tu espacio actual</p>
        <h3 className="mt-3 text-xl font-semibold">Socias Farmasi</h3>
        <p className="mt-3 text-base leading-7 text-[#746A64]">Tus capacitaciones, sus materiales y tu avance dentro del programa.</p>
        <Link href="/classroom?espacio=farmasi" prefetch={false} className={'mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#294A38] underline underline-offset-4 ' + foco}>Volver a Farmasi</Link>
      </div>
      <div className="min-w-0 rounded-[22px] border border-[#EC9BB6] bg-[#FFFDFA] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#294A38]">Lo que sumás</p>
        <h3 id="socias-nuevo-capitulo" className="mt-3 text-xl font-semibold">Más herramientas. Más compañía.</h3>
        <p className="mt-3 text-base leading-7 text-[#746A64]">Formación para tu negocio digital, comunidad, organización y seguimiento de tus resultados, además de Farmasi.</p>
      </div>
    </section>}

    <section id="socias-beneficios" aria-labelledby="socias-beneficios-titulo" className="scroll-mt-28">
      <div className="mb-4 px-1"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#294A38]">Un espacio que te acompaña</p><h3 id="socias-beneficios-titulo" className="mt-2 text-2xl font-semibold sm:text-3xl">Aprender es el comienzo.</h3><p className="mt-3 max-w-2xl text-base leading-7 text-[#746A64]">Después vienen tus preguntas, lo que ponés en práctica y esos avances que dan ganas de compartir.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {BENEFICIOS.map(beneficio => <article key={beneficio.icono} className={'min-w-0 rounded-[22px] border p-5 sm:p-6 ' + beneficio.tono}>
          <div className="flex items-center gap-3 text-[#294A38]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#EC9BB6] bg-[#FAF7F3]"><NavigationIcon name={beneficio.icono} /></span><p className="text-sm font-semibold">{beneficio.etapa}</p></div>
          <h4 className="mt-4 break-words font-impact text-xl font-semibold">{beneficio.titulo}</h4>
          <p className="mt-3 text-base leading-7 text-[#294A38]">{beneficio.texto}</p>
        </article>)}
      </div>
    </section>

    {muestraUrl && muestra && <section aria-labelledby="socias-muestra-titulo" className="grid gap-4 rounded-[24px] border border-[#E7DDD5] bg-[#FAF7F3] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#294A38]">Conocé nuestras clases</p><h3 id="socias-muestra-titulo" className="mt-3 text-2xl font-semibold">Dale play a tu próximo paso.</h3><p className="mt-3 break-words text-base leading-7 text-[#746A64] [overflow-wrap:anywhere]">Una clase de muestra para empezar: {muestra.titulo}</p></div>
      <Link href={muestraUrl} prefetch={false} className={boton + ' w-full border border-[#294A38] bg-[#FFFDFA] text-[#294A38] lg:w-auto'}>Ver clase de muestra <ArrowIcon /></Link>
    </section>}

    <section aria-labelledby="socias-dudas-titulo" className="rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 sm:p-7">
      <h3 id="socias-dudas-titulo" className="text-xl font-semibold">Antes de dar el paso</h3>
      {farmasi && <details className="mt-4 border-t border-[#E7DDD5]"><summary className={'flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-base font-semibold ' + foco}>¿Qué pasa con mi acceso a Farmasi?<span aria-hidden="true">+</span></summary><p className="pb-5 text-base leading-7 text-[#746A64]">Farmasi es un acceso adicional. Al sumar Socias Digitales, tu espacio Farmasi y los avances que ya registraste se conservan.</p></details>}
      <details className="mt-4 border-t border-[#E7DDD5]"><summary className={'flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-base font-semibold ' + foco}>¿Cuánto dura el acompañamiento?<span aria-hidden="true">+</span></summary><p className="pb-5 text-base leading-7 text-[#746A64]">Los seis meses corresponden al acompañamiento. Al finalizar ese período, su renovación se coordina con el equipo de Flor.</p></details>
      <details className="border-t border-[#E7DDD5]"><summary className={'flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-base font-semibold ' + foco}>¿Puedo volver a ver las clases?<span aria-hidden="true">+</span></summary><p className="pb-1 text-base leading-7 text-[#746A64]">Sí. Encontrás las grabaciones y sus materiales dentro de tu biblioteca para repasar y seguir a tu ritmo.</p></details>
    </section>

    <div className="flex flex-col gap-5 rounded-[24px] border border-[#EC9BB6] bg-[#F4CAD8] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#294A38]">Tu próximo capítulo</p>
        <h3 className="mt-2 font-impact text-2xl font-semibold">Socias Digitales</h3>
        {precio && <p className="mt-3 break-words font-impact text-2xl font-semibold text-[#294A38] [overflow-wrap:anywhere]">{precio}</p>}
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#294A38]">Clases, herramientas, comunidad y seis meses de acompañamiento.</p>
      </div>
      <div className="min-w-0 lg:max-w-72 lg:shrink-0">
        {accionUrl ? <a href={accionUrl} rel="noreferrer" className={boton + ' w-full bg-[#294A38] text-white'}>Quiero ser Socia <ArrowIcon /></a>
          : <><button type="button" disabled aria-describedby="socias-inscripcion-pendiente" className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-[#D8CFC8] bg-[#FAF7F3] px-6 py-3 text-center text-sm font-semibold text-[#746A64]">Quiero ser Socia <ArrowIcon /></button><p id="socias-inscripcion-pendiente" className="mt-3 text-sm leading-6 text-[#294A38]">Enlace de inscripción por confirmar.</p></>}
      </div>
    </div>
  </section>
}
