import { esIdAfiliadas, esRecursoAfiliada } from './affiliate-hub'
import type { RecursoAfiliada } from './affiliate-hub'

export const ESTADOS_PRODUCTO_AFILIADAS = ['borrador', 'publicado', 'archivado'] as const
export const MONEDAS_PRODUCTO_AFILIADAS = ['ARS', 'USD', 'EUR', 'MXN'] as const
export interface DatosProductoAfiliadas {
  nombre: string; descripcion: string | null; subtipo: string | null; marca: string | null
  precio: number | null; moneda: typeof MONEDAS_PRODUCTO_AFILIADAS[number]; comision_pct: number | null
  imagen_url: string | null; activo: boolean; orden: number
  estado_afiliadas: typeof ESTADOS_PRODUCTO_AFILIADAS[number]
}
export interface ProductoAfiliadas extends DatosProductoAfiliadas { id: string; version: number; actualizado_en: string }
export interface PermisoProductoAfiliadas { usuaria_id: string; producto_id: string; habilitada: boolean; version: number; actualizada_en: string }
export interface CuentaProductoAfiliadas { id: string; nombre: string; estado: string; prueba: boolean; afiliadaHabilitada: boolean; permiso: PermisoProductoAfiliadas | null }
export type CatalogoProductosAfiliadas = { estado: 'lista'; productos: ProductoAfiliadas[] } | { estado: 'error'; mensaje: string }
export type CatalogoVentaAfiliadas = { estado: 'lista'; productos: ProductoAfiliadas[]; recursos: RecursoAfiliada[] } | { estado: 'error'; mensaje: string }
export type ListaPermisosProductoAfiliadas = { estado: 'lista'; producto: ProductoAfiliadas; cuentas: CuentaProductoAfiliadas[] } | { estado: 'error'; mensaje: string }

const CAMPOS = ['nombre','descripcion','subtipo','marca','precio','moneda','comision_pct','imagen_url','activo','orden','estado_afiliadas'] as const
function objeto(x: unknown): x is Record<string, unknown> { return Boolean(x && typeof x === 'object' && !Array.isArray(x)) }
function texto(x: unknown, max: number, nullable = false, multilinea = false): string | null {
  if (nullable && (x === null || x === '')) return null
  if (typeof x !== 'string' || x.length > max || (multilinea ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(x)) throw new Error('Revisá los textos del producto.')
  const value = x.replace(/\r\n?/g,'\n').trim().normalize('NFC')
  if (!value && !nullable) throw new Error('Escribí el nombre del producto.')
  return value || null
}
export function validarDatosProductoAfiliadas(value: unknown): DatosProductoAfiliadas {
  if (!objeto(value) || Object.keys(value).length !== CAMPOS.length || Object.keys(value).some(k => !(CAMPOS as readonly string[]).includes(k))) throw new Error('Revisá la ficha del producto.')
  const nombre = texto(value.nombre,200)!, descripcion=texto(value.descripcion,12000,true,true), subtipo=texto(value.subtipo,100,true),marca=texto(value.marca,100,true)
  if (value.precio !== null && (typeof value.precio !== 'number' || !Number.isFinite(value.precio) || value.precio < 0 || value.precio > 1e9 || Math.abs(value.precio*100-Math.round(value.precio*100)) > 0.00001)) throw new Error('Revisá el precio. Usá hasta dos decimales.')
  if (value.comision_pct !== null && (typeof value.comision_pct !== 'number' || !Number.isFinite(value.comision_pct) || value.comision_pct < 0 || value.comision_pct > 100)) throw new Error('La comisión debe estar entre 0 y 100%.')
  if (!(MONEDAS_PRODUCTO_AFILIADAS as readonly unknown[]).includes(value.moneda) || !(ESTADOS_PRODUCTO_AFILIADAS as readonly unknown[]).includes(value.estado_afiliadas) || typeof value.activo !== 'boolean' || !Number.isSafeInteger(value.orden) || Number(value.orden) < 0 || Number(value.orden) > 100000) throw new Error('Revisá el estado, la moneda y el orden.')
  const imagen_url=texto(value.imagen_url,2000,true)
  if (imagen_url) { let u:URL; try { u=new URL(imagen_url) } catch { throw new Error('Usá una imagen con enlace HTTPS.') }; if(u.protocol!=='https:'||u.username||u.password||/\s/.test(imagen_url)) throw new Error('Usá una imagen con enlace HTTPS.') }
  return {nombre,descripcion,subtipo,marca,precio:value.precio as number|null,moneda:value.moneda as DatosProductoAfiliadas['moneda'],comision_pct:value.comision_pct as number|null,imagen_url,activo:value.activo,orden:value.orden as number,estado_afiliadas:value.estado_afiliadas as DatosProductoAfiliadas['estado_afiliadas']}
}
export function esProductoAfiliadas(value: unknown): value is ProductoAfiliadas {
  if(!objeto(value)||!esIdAfiliadas(value.id)||!Number.isSafeInteger(value.version)||Number(value.version)<1||Number(value.version)>1e9||typeof value.actualizado_en!=='string'||!Number.isFinite(Date.parse(value.actualizado_en))) return false
  try { const d=validarDatosProductoAfiliadas(Object.fromEntries(CAMPOS.map(k=>[k,value[k]]))); return CAMPOS.every(k=>d[k]===value[k]) } catch { return false }
}
export function productoAfiliadasCoincide(row:ProductoAfiliadas,datos:DatosProductoAfiliadas) { return CAMPOS.every(k=>row[k]===datos[k]) }
export function esPermisoProductoAfiliadas(x:unknown):x is PermisoProductoAfiliadas { return objeto(x)&&esIdAfiliadas(x.usuaria_id)&&esIdAfiliadas(x.producto_id)&&typeof x.habilitada==='boolean'&&Number.isSafeInteger(x.version)&&Number(x.version)>0&&Number(x.version)<=1e9&&typeof x.actualizada_en==='string'&&Number.isFinite(Date.parse(x.actualizada_en)) }
export function esCatalogoProductosAfiliadas(x:unknown):x is Extract<CatalogoProductosAfiliadas,{estado:'lista'}> { return objeto(x)&&x.estado==='lista'&&Array.isArray(x.productos)&&x.productos.length<=1000&&x.productos.every(esProductoAfiliadas)&&new Set(x.productos.map(p=>p.id)).size===x.productos.length }
export function esListaPermisosProductoAfiliadas(x:unknown):x is Extract<ListaPermisosProductoAfiliadas,{estado:'lista'}> { return objeto(x)&&x.estado==='lista'&&esProductoAfiliadas(x.producto)&&Array.isArray(x.cuentas)&&x.cuentas.length<=1000&&x.cuentas.every(c=>objeto(c)&&esIdAfiliadas(c.id)&&typeof c.nombre==='string'&&typeof c.estado==='string'&&typeof c.prueba==='boolean'&&typeof c.afiliadaHabilitada==='boolean'&&(c.permiso===null||esPermisoProductoAfiliadas(c.permiso)&&c.permiso.usuaria_id===c.id&&c.permiso.producto_id===(x.producto as ProductoAfiliadas).id))&&new Set(x.cuentas.map(c=>c.id)).size===x.cuentas.length }
export function filtrarProductosAfiliadas(productos:readonly ProductoAfiliadas[],busqueda:string,estado='todos') { const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR'); const words=normal(busqueda.trim()).split(/\s+/).filter(Boolean);return productos.filter(p=>(estado==='todos'||p.estado_afiliadas===estado)&&words.every(w=>normal([p.nombre,p.descripcion??'',p.subtipo??'',p.marca??''].join(' ')).includes(w))) }
export function precioProductoAfiliadas(p:Pick<ProductoAfiliadas,'precio'|'moneda'>) { return p.precio===null?'A definir':new Intl.NumberFormat('es-AR',{style:'currency',currency:p.moneda,maximumFractionDigits:2}).format(p.precio) }

export function esCatalogoVentaAfiliadas(x:unknown):x is Extract<CatalogoVentaAfiliadas,{estado:'lista'}> { return esCatalogoProductosAfiliadas(x)&&x.productos.every(p=>p.activo&&p.estado_afiliadas==='publicado')&&'recursos'in x&&Array.isArray(x.recursos)&&x.recursos.length<=1000&&x.recursos.every(r=>esRecursoAfiliada(r)&&r.estado==='publicado'&&esIdAfiliadas(r.producto_id)&&x.productos.some(p=>p.id===r.producto_id&&p.activo&&p.estado_afiliadas==='publicado'))&&new Set(x.recursos.map(r=>r.id)).size===x.recursos.length }
