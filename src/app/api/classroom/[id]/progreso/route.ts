import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { puedeVerClase } from '@/lib/class-access'
import { validarProgreso } from '@/lib/class-progress'
import { leerProgresoClases, progresoPublico } from '@/lib/class-progress-server'
import { esUuid } from '@/lib/class-management'

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params
  if(!esUuid(id))return NextResponse.json({error:'Clase no encontrada.'},{status:404})
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error || !user)return NextResponse.json({error:'Iniciá sesión para ver tu progreso.'},{status:401})
  const [{data:perfil,error:perfilError},{data:clase,error:claseError}]=await Promise.all([
    supabase.from('perfiles').select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id',user.id).maybeSingle(),
    supabase.from('clases').select('activo,acceso_gratuito,solo_farmaci,video_key,vimeo_url').eq('id',id).maybeSingle(),
  ])
  if(perfilError || claseError)return NextResponse.json({error:'No pudimos verificar tu acceso.'},{status:503,headers:{'Cache-Control':'private, no-store'}})
  if(!clase || !puedeVerClase(perfil,clase) || !(clase.video_key || clase.vimeo_url))return NextResponse.json({error:'Esta clase no está disponible para tu cuenta.'},{status:403,headers:{'Cache-Control':'private, no-store'}})
  try {
    const progreso=await leerProgresoClases(supabase,user.id)
    return NextResponse.json({progreso:progreso.find(p=>p.clase_id===id)??null},{headers:{'Cache-Control':'private, no-store'}})
  } catch {return NextResponse.json({error:'No pudimos recuperar tu progreso. Volvé a intentar.'},{status:503})}
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: {'Cache-Control':'private, no-store'} })
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'Solicitud no válida.'},403)
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return json({error:'Solicitud demasiado grande.'},413)
  const {id}=await context.params
  if(!esUuid(id)) return json({error:'Clase no encontrada.'},404)
  let cambio
  try {const text=await request.text();if(text.length>4096)return json({error:'Solicitud demasiado grande.'},413);cambio=validarProgreso(JSON.parse(text))} catch {return json({error:'Progreso no válido.'},400)}
  if(!cambio) return json({error:'Progreso no válido.'},400)
  const supabase=await createClient()
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError || !user) return json({error:'Iniciá sesión para guardar tu progreso.'},401)
  const {data:perfil,error:perfilError}=await supabase.from('perfiles').select('rol,tipo_usuario,estado,desafio_socias_habilitada,socias_farmaci_habilitada').eq('id',user.id).maybeSingle()
  if(perfilError || !perfil)return json({error:'No pudimos verificar tu acceso.'},403)
  if(perfil.rol==='admin')return json({error:'La vista administrativa no genera progreso de alumna.'},409)
  const {data:clase,error:claseError}=await supabase.from('clases').select('activo,acceso_gratuito,solo_farmaci,video_key,vimeo_url').eq('id',id).maybeSingle()
  if(claseError || !clase || !puedeVerClase(perfil,clase) || !(clase.video_key || clase.vimeo_url))return json({error:'Esta clase no está disponible para tu cuenta.'},403)
  try {
    const {data,error}=await createAdminClient().rpc('guardar_progreso_clase',{
      p_alumna:user.id,p_clase:id,p_action:cambio.action,
      p_posicion:cambio.action==='posicion'?cambio.posicion:null,
      p_duracion:cambio.action==='posicion'?cambio.duracion:null,
      p_completada:cambio.action==='completada'?cambio.completada:null,
    })
    if(error || !data?.[0])throw new Error('write failed')
    return json({progreso:progresoPublico(data[0])})
  } catch {
    console.error('class_progress_save_failed',{userId:user.id,claseId:id})
    return json({error:'No pudimos guardar. Revisá tu conexión y volvé a intentar.'},503)
  }
}
