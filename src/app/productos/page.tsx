import { createClient } from '@/lib/supabase/server'
import ModuleLocked from '@/components/ModuleLocked'
import { esAdministradora } from '@/lib/module-guard'
import { redirect } from 'next/navigation'

export default async function ProductosPage() {
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/login')
  if(!await esAdministradora(user.id)) return <ModuleLocked id="productos"/>
  redirect('/admin/afiliadas/productos')
}
