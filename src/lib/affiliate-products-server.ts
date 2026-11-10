import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { autorizarAfiliadas, ErrorAfiliadas, HEADERS_AFILIADAS, leerJsonAfiliadas, origenSolicitudAfiliadas, type SesionAfiliadas } from './affiliate-hub-server'
import { esIdAfiliadas, esRecursoAfiliada, type RecursoAfiliada } from './affiliate-hub'
import { esAccesoAfiliadas } from './affiliate-access-client'
import { esCuentaPrueba } from './test-accounts'
import { esPermisoProductoAfiliadas, esProductoAfiliadas, productoAfiliadasCoincide, validarDatosProductoAfiliadas, type CatalogoProductosAfiliadas, type CatalogoVentaAfiliadas, type DatosProductoAfiliadas, type ListaPermisosProductoAfiliadas, type PermisoProductoAfiliadas, type ProductoAfiliadas } from './affiliate-products'

export const CAMPOS_PRODUCTOS_AFILIADAS='id,nombre,descripcion,subtipo,marca,precio,moneda,comision_pct,imagen_url,activo,orden,estado_afiliadas,version,actualizado_en'
const CAMPOS_PRODUCTOS_CON_TIPO='id,nombre,descripcion,subtipo,marca,precio,moneda,comision_pct,imagen_url,activo,orden,estado_afiliadas,version,actualizado_en,tipo'
const CAMPOS_PERMISOS='usuaria_id,producto_id,habilitada,version,actualizada_en'
const CAMPOS_RECURSOS='id,titulo,cuerpo,tipo,campana,url,estado,destacado,version,creado_en,actualizado_en,producto_id'
function dtoProducto(raw:unknown):ProductoAfiliadas {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new ErrorAfiliadas(503,'No pudimos cargar los productos.')
  const p=Object.fromEntries(CAMPOS_PRODUCTOS_AFILIADAS.split(',').map(k=>[k,(raw as Record<string,unknown>)[k]]))
  if(!esProductoAfiliadas(p)) throw new ErrorAfiliadas(503,'Una ficha necesita revisión. Actualizá los productos.')
  return p
}
const respuesta=(body:unknown,status=200)=>Response.json(body,{status,headers:HEADERS_AFILIADAS})
export async function ejecutarProductosAfiliadas(request:Request,admin:boolean,escritura:boolean,fn:(auth:SesionAfiliadas)=>Promise<Response>) {
  if(escritura&&!origenSolicitudAfiliadas(request)) return respuesta({error:'Solicitud no válida.'},403)
  if(new URL(request.url).search) return respuesta({error:'Consulta no válida.'},400)
  const auth=await autorizarAfiliadas(admin)
  if('error'in auth) return respuesta({error:auth.error.mensaje},auth.error.status)
  try { return await fn(auth) } catch(error) { unstable_rethrow(error); return respuesta({error:error instanceof ErrorAfiliadas?error.message:'No pudimos completar la operación. Reintentá.'},error instanceof ErrorAfiliadas?error.status:503) }
}
export async function leerCatalogoAdminProductosAfiliadas(auth:SesionAfiliadas):Promise<CatalogoProductosAfiliadas> {
  if(!auth.admin) return {estado:'error',mensaje:'Este catálogo es del equipo de Flor.'}
  return leerProductosAfiliadas(auth)
}
export async function leerProductosAfiliadas(auth:SesionAfiliadas):Promise<CatalogoProductosAfiliadas> {
  try {
    let query=auth.supabase.from('productos').select(CAMPOS_PRODUCTOS_AFILIADAS,{count:'exact'}).eq('tipo','fisico').order('orden').order('id').limit(1000)
    if(!auth.admin) query=query.eq('activo',true).eq('estado_afiliadas','publicado')
    const {data,error,count}=await query
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count!==data.length) throw new Error()
    const productos=data.map(dtoProducto)
    if(new Set(productos.map(p=>p.id)).size!==productos.length) throw new Error()
    if(!auth.admin&&productos.some(p=>!p.activo||p.estado_afiliadas!=='publicado')) throw new Error()
    return {estado:'lista',productos}
  } catch(error) { unstable_rethrow(error); return {estado:'error',mensaje:'No pudimos cargar los productos. Volvé a intentar.'} }
}
export async function leerVentaAfiliadas(auth:SesionAfiliadas):Promise<CatalogoVentaAfiliadas> {
  const catalogo=await leerProductosAfiliadas(auth)
  if(catalogo.estado==='error') return catalogo
  if(!catalogo.productos.length) return {...catalogo,recursos:[]}
  try {
    const ids=catalogo.productos.map(p=>p.id),recursos:RecursoAfiliada[]=[]
    for(let i=0;i<ids.length;i+=100) {
      const parte=await auth.supabase.from('recursos_afiliadas').select(CAMPOS_RECURSOS,{count:'exact'}).in('producto_id',ids.slice(i,i+100)).eq('estado','publicado').order('destacado',{ascending:false}).order('creado_en',{ascending:false}).order('id').limit(1000)
      if(parte.error||!Array.isArray(parte.data)||!Number.isSafeInteger(parte.count)||parte.count!==parte.data.length) throw new Error()
      for(const raw of parte.data) {
        const row=Object.fromEntries(CAMPOS_RECURSOS.split(',').map(k=>[k,(raw as Record<string,unknown>)[k]]))
        if(!esRecursoAfiliada(row)||row.estado!=='publicado'||!esIdAfiliadas(row.producto_id)||!ids.includes(row.producto_id)) throw new Error()
        recursos.push(row)
      }
      if(recursos.length>1000) throw new Error()
    }
    if(new Set(recursos.map(r=>r.id)).size!==recursos.length) throw new Error()
    return {...catalogo,recursos}
  } catch(error) { unstable_rethrow(error); return {estado:'error',mensaje:'No pudimos cargar los materiales. Volvé a intentar.'} }
}
function errorGuardado(error:{code?:string}|null):never {
  if(error?.code==='42501') throw new ErrorAfiliadas(403,'Tu permiso cambió. Volvé a ingresar al panel.')
  if(['22023','23514','23503','23502'].includes(error?.code??'')) throw new ErrorAfiliadas(400,'Revisá la ficha y sus permisos.')
  if(error?.code==='23505') throw new ErrorAfiliadas(409,'El producto ya existe. Actualizá el catálogo.')
  throw new ErrorAfiliadas(503,'No pudimos confirmar el guardado. Reintentá el mismo envío.')
}
export async function guardarProductoAfiliadas(auth:SesionAfiliadas,input:unknown,id?:string):Promise<ProductoAfiliadas> {
  if(!auth.admin) throw new ErrorAfiliadas(403,'Solo el equipo puede editar productos.')
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new ErrorAfiliadas(400,'Revisá la ficha.')
  const x=input as Record<string,unknown>,editar=id!==undefined
  if(Object.keys(x).sort().join(',')!==(editar?'producto,version':'id,producto')) throw new ErrorAfiliadas(400,'Revisá la ficha.')
  const productoId=id??x.id
  if(!esIdAfiliadas(productoId)||editar&&(!Number.isSafeInteger(x.version)||Number(x.version)<1||Number(x.version)>=1e9)) throw new ErrorAfiliadas(400,'Revisá el producto y su versión.')
  let datos:DatosProductoAfiliadas
  try { datos=validarDatosProductoAfiliadas(x.producto) } catch(error) { throw new ErrorAfiliadas(400,error instanceof Error?error.message:'Revisá la ficha.') }
  const leer=()=>auth.supabase.from('productos').select(CAMPOS_PRODUCTOS_CON_TIPO).eq('id',productoId).maybeSingle()
  const previa=await leer()
  if(previa.error) errorGuardado(previa.error)
  const esperada=editar?Number(x.version)+1:1
  const coincide=(row:unknown):row is ProductoAfiliadas=>Boolean(row&&typeof row==='object'&&'tipo'in row&&row.tipo==='fisico'&&esProductoAfiliadas(row)&&row.id===productoId&&row.version===esperada&&productoAfiliadasCoincide(row,datos))
  if(coincide(previa.data)) return dtoProducto(previa.data)
  if(editar&&(!previa.data||previa.data.tipo!=='fisico')) throw new ErrorAfiliadas(404,'Producto no disponible.')
  if(previa.data&&(!editar||previa.data.version!==x.version)) throw new ErrorAfiliadas(409,'La ficha cambió. Actualizá antes de editarla.')
  const cambio=editar?auth.supabase.from('productos').update(datos).eq('id',productoId).eq('tipo','fisico').eq('version',x.version as number):auth.supabase.from('productos').insert({id:productoId,tipo:'fisico',...datos})
  const guardada=await cambio.select(CAMPOS_PRODUCTOS_CON_TIPO).maybeSingle()
  if(!guardada.error&&coincide(guardada.data)) return dtoProducto(guardada.data)
  const confirmada=await leer()
  if(!confirmada.error&&coincide(confirmada.data)) return dtoProducto(confirmada.data)
  if(!guardada.error||editar&&confirmada.data&&confirmada.data.version!==x.version) throw new ErrorAfiliadas(409,'La ficha cambió. Actualizá antes de reintentar.')
  errorGuardado(guardada.error)
}
async function productoAdministrable(auth:SesionAfiliadas,id:string) {
  if(!auth.admin) throw new ErrorAfiliadas(403,'Este catálogo es del equipo de Flor.')
  if(!esIdAfiliadas(id)) throw new ErrorAfiliadas(404,'Producto no disponible.')
  const r=await auth.supabase.from('productos').select(CAMPOS_PRODUCTOS_AFILIADAS).eq('tipo','fisico').eq('id',id).maybeSingle()
  if(r.error) throw new ErrorAfiliadas(503,'No pudimos comprobar el producto.')
  if(!r.data) throw new ErrorAfiliadas(404,'Producto no disponible.')
  return dtoProducto(r.data)
}
export async function leerPermisosProductoAfiliadas(auth:SesionAfiliadas,id:string):Promise<ListaPermisosProductoAfiliadas> {
  const producto=await productoAdministrable(auth,id)
  const [personas,generales,permisos]=await Promise.all([
    auth.supabase.from('perfiles').select('id,nombre,estado',{count:'exact'}).neq('rol','admin').order('nombre').order('id').limit(1000),
    auth.supabase.from('accesos_afiliadas').select('usuaria_id,habilitada,version,actualizada_en',{count:'exact'}).order('usuaria_id').limit(1000),
    auth.supabase.from('afiliadas_productos').select(CAMPOS_PERMISOS,{count:'exact'}).eq('producto_id',id).order('usuaria_id').limit(1000),
  ])
  for(const parte of [personas,generales,permisos]) if(parte.error||!Array.isArray(parte.data)||!Number.isSafeInteger(parte.count)||parte.count!==parte.data.length) throw new ErrorAfiliadas(503,'No pudimos cargar los permisos. Volvé a intentar.')
  const ids=new Set(personas.data!.map(p=>p.id))
  if(ids.size!==personas.data!.length||personas.data!.some(p=>!esIdAfiliadas(p.id)||typeof p.estado!=='string'||!(p.nombre===null||typeof p.nombre==='string'))||generales.data!.some(p=>!esAccesoAfiliadas(p))||permisos.data!.some(p=>!esPermisoProductoAfiliadas(p)||p.producto_id!==id||!ids.has(p.usuaria_id))) throw new ErrorAfiliadas(503,'No pudimos comprobar los permisos.')
  const general=new Map(generales.data!.map(p=>[p.usuaria_id,p.habilitada])),propios=new Map(permisos.data!.map(p=>[p.usuaria_id,p as PermisoProductoAfiliadas]))
  if(general.size!==generales.data!.length||propios.size!==permisos.data!.length) throw new ErrorAfiliadas(503,'No pudimos comprobar los permisos.')
  return {estado:'lista',producto,cuentas:personas.data!.filter(p=>general.get(p.id)===true||propios.has(p.id)).map(p=>({id:p.id,nombre:p.nombre?.trim()||'Sin nombre',estado:p.estado,prueba:esCuentaPrueba(p.id),afiliadaHabilitada:general.get(p.id)===true,permiso:propios.get(p.id)??null}))}
}
export async function guardarPermisoProductoAfiliadas(auth:SesionAfiliadas,id:string,input:unknown):Promise<PermisoProductoAfiliadas> {
  await productoAdministrable(auth,id)
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new ErrorAfiliadas(400,'Revisá el permiso.')
  const x=input as Record<string,unknown>
  if(Object.keys(x).sort().join(',')!=='habilitada,usuariaId,version'||!esIdAfiliadas(x.usuariaId)||typeof x.habilitada!=='boolean'||!(x.version===null||Number.isSafeInteger(x.version)&&Number(x.version)>0&&Number(x.version)<1e9)) throw new ErrorAfiliadas(400,'Revisá el permiso y su versión.')
  const leer=()=>auth.supabase.from('afiliadas_productos').select(CAMPOS_PERMISOS).eq('producto_id',id).eq('usuaria_id',x.usuariaId as string).maybeSingle()
  const esperada=x.version===null?1:Number(x.version)+1
  const coincide=(row:unknown):row is PermisoProductoAfiliadas=>esPermisoProductoAfiliadas(row)&&row.producto_id===id&&row.usuaria_id===x.usuariaId&&row.habilitada===x.habilitada&&row.version===esperada
  const previa=await leer()
  if(previa.error) errorGuardado(previa.error)
  if(coincide(previa.data)) return previa.data
  if(x.version===null?previa.data!==null:!esPermisoProductoAfiliadas(previa.data)||previa.data.version!==x.version) throw new ErrorAfiliadas(409,'El permiso cambió. Actualizá la lista.')
  if(x.habilitada) {
    const [perfil,general]=await Promise.all([auth.supabase.from('perfiles').select('id,rol,estado').eq('id',x.usuariaId).maybeSingle(),auth.supabase.from('accesos_afiliadas').select('usuaria_id,habilitada').eq('usuaria_id',x.usuariaId).maybeSingle()])
    if(perfil.error||general.error) throw new ErrorAfiliadas(503,'No pudimos comprobar la afiliada.')
    if(!perfil.data||perfil.data.id!==x.usuariaId||perfil.data.rol==='admin'||perfil.data.estado!=='activa'||general.data?.usuaria_id!==x.usuariaId||general.data.habilitada!==true) throw new ErrorAfiliadas(409,'Primero habilitá Afiliadas en esta cuenta.')
  }
  const query=x.version===null?auth.supabase.from('afiliadas_productos').insert({producto_id:id,usuaria_id:x.usuariaId,habilitada:x.habilitada}):auth.supabase.from('afiliadas_productos').update({habilitada:x.habilitada}).eq('producto_id',id).eq('usuaria_id',x.usuariaId).eq('version',x.version)
  const saved=await query.select(CAMPOS_PERMISOS).maybeSingle()
  if(!saved.error&&coincide(saved.data)) return saved.data
  const confirmed=await leer()
  if(!confirmed.error&&coincide(confirmed.data)) return confirmed.data
  if(!saved.error||saved.error.code==='23505'||confirmed.data&&confirmed.data.version!==x.version) throw new ErrorAfiliadas(409,'El permiso cambió. Actualizá la lista.')
  errorGuardado(saved.error)
}
export { leerJsonAfiliadas, respuesta as responderProductosAfiliadas }
