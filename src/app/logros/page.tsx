import { createClient } from '@/lib/supabase/server'
import ModuleLocked from '@/components/ModuleLocked'
import { puedeVerLogros } from '@/lib/achievements'
import { leerLogros } from '@/lib/achievements-server'
import { fechaArgentina } from '@/lib/metrics'
import { redirect } from 'next/navigation'
import LogrosCliente from './LogrosCliente'

export default async function LogrosPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login?next=%2Flogros')
  const { data: perfil, error } = await supabase.from('perfiles').select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id', user.id).maybeSingle()
  if (error || !perfil) return <main className="mx-auto max-w-3xl p-6"><p role="alert">No pudimos comprobar tu acceso a Mis logros.</p><a href="/logros" className="mt-4 inline-flex min-h-11 items-center text-[#294A38] underline">Reintentar</a></main>
  if (perfil.rol === 'admin') redirect('/admin')
  if (!puedeVerLogros(perfil)) return <ModuleLocked id="logros" />
  return <LogrosCliente inicial={await leerLogros(supabase, user.id, perfil, fechaArgentina())} />
}
