import { ejecutarProductosAfiliadas, leerVentaAfiliadas, responderProductosAfiliadas } from '@/lib/affiliate-products-server'
export async function GET(request:Request) { return ejecutarProductosAfiliadas(request,false,false,async auth=>{const r=await leerVentaAfiliadas(auth);return responderProductosAfiliadas(r,r.estado==='lista'?200:503)}) }
