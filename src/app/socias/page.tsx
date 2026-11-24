import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { leerOfertaSocias } from '@/lib/socias-offer-store'
import SociasUpgradePanel from '@/components/SociasUpgradePanel'
import type { OfertaSocias } from '@/lib/socias-offer'

export default async function SociasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fsocias')
  const { data: perfil, error } = await supabase.from('perfiles').select('rol,tipo_usuario,estado').eq('id', user.id).single()
  if (error || !perfil) return <main className="min-h-screen bg-[#F4EFEA] px-5 py-10 text-[#211C19]"><h1 className="font-serif text-3xl">Socias Digitales</h1><p role="alert" className="mt-4 text-sm">No pudimos comprobar tu cuenta. Volvé a intentar.</p><Link href="/socias" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 text-sm font-semibold text-white">Reintentar</Link></main>
  const admin = perfil.rol === 'admin'
  const socia = perfil.estado === 'activa' && perfil.tipo_usuario === 'socia'
  let ofertaSocias: OfertaSocias | undefined
  let errorOferta = false
  try { ofertaSocias = (await leerOfertaSocias()).oferta }
  catch { errorOferta = true }
  return <main className="min-h-screen bg-[#F4EFEA] text-[#211C19]" data-platform-role={admin ? 'admin' : 'member'}>
    <header data-student-section-header="true" className="border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-4 sm:px-8"><Link href={admin ? '/admin/configuracion' : '/classroom'} className="inline-flex min-h-11 items-center text-sm font-medium text-[#294A38]">← {admin ? 'Configuración' : 'Volver a mis clases'}</Link></header>
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#294A38]">Tu espacio para crecer</p>
      <h1 className="mb-7 mt-2 font-serif text-4xl font-semibold tracking-[-.035em] sm:text-5xl">Socias Digitales</h1>
      {socia && !admin ? <section className="rounded-[24px] border border-[#EC9BB6] bg-[#F4CAD8] p-6 sm:p-8"><h2 className="text-2xl font-semibold">Ya sos parte de Socias.</h2><p className="mt-3 text-sm leading-6 text-[#294A38]">Seguí con tus clases y lo que estás construyendo.</p><Link href="/classroom" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#294A38] px-5 py-3 text-sm font-semibold text-white">Ir a mis clases</Link></section> : <>
        {admin && <p className="mb-5 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4 text-sm leading-6 text-[#746A64]">Vista de la propuesta para alumnas. El precio y el enlace se editan en Configuración; esta vista no cambia ningún acceso.</p>}
        {errorOferta && <p role="status" className="mb-5 rounded-2xl border border-[#E7DDD5] bg-[#FFFDFA] p-4 text-sm leading-6 text-[#746A64]">No pudimos cargar las opciones de inscripción. <Link href="/socias" className="inline-flex min-h-11 items-center text-[#294A38] underline underline-offset-4">Volver a intentar</Link></p>}
        <SociasUpgradePanel formato="completo" ofertaSocias={ofertaSocias} />
      </>}
    </div>
  </main>
}
