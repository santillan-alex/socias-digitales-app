export interface PerfilClases { rol?: string; tipo_usuario?: string | null; estado?: string | null; desafio_socias_habilitada?: boolean; socias_farmaci_habilitada?: boolean }
export interface ClaseAcceso { activo: boolean; acceso_gratuito?: boolean; solo_farmaci?: boolean }

// Los permisos provienen del perfil protegido y de la clase, nunca del navegador.
export function puedeVerClasesPrivadas(perfil: PerfilClases | null) {
  if (!perfil) return false
  if (perfil.rol === 'admin') return true
  return perfil.estado === 'activa' && Boolean(perfil.desafio_socias_habilitada || perfil.tipo_usuario === 'socia')
}

export function tieneAccesoFarmaci(perfil: PerfilClases | null) {
  return perfil?.estado === 'activa' && perfil.socias_farmaci_habilitada === true
}

export function incluirClaseEnCatalogo(perfil: PerfilClases | null, clase: ClaseAcceso) {
  return Boolean(!clase.solo_farmaci || puedeVerClase(perfil, clase))
}

export function puedeVerClase(perfil: PerfilClases | null, clase: ClaseAcceso) {
  if (!perfil) return false
  if (perfil.rol === 'admin') return true
  if (clase.solo_farmaci) return clase.activo && tieneAccesoFarmaci(perfil)
  // Las muestras siguen siendo contenido libre para cuentas autenticadas.
  // Pausar un acceso pago impide emitir nuevos permisos para clases privadas.
  return clase.activo && Boolean(clase.acceso_gratuito || puedeVerClasesPrivadas(perfil))
}

export interface ClaseCatalogo {
  id: string; titulo: string; descripcion: string | null; orden: number; modulo: string;
  activo: boolean; acceso_gratuito: boolean; solo_farmaci?: boolean; puede_ver: boolean;
  tiene_video_privado: boolean; vimeo_url: string | null; plan: '27' | '97';
}

export function claseParaCatalogo(clase: Omit<ClaseCatalogo,'puede_ver'|'tiene_video_privado'> & {video_key?: string | null}, perfil: PerfilClases | null): ClaseCatalogo {
  const puede_ver = puedeVerClase(perfil,clase)
  return {id:clase.id,titulo:clase.titulo,descripcion:clase.descripcion,orden:clase.orden,modulo:clase.modulo,activo:clase.activo,acceso_gratuito:clase.acceso_gratuito,...(clase.solo_farmaci ? {solo_farmaci:true} : {}),plan:clase.plan,
    puede_ver,tiene_video_privado:Boolean(clase.video_key),vimeo_url:puede_ver?clase.vimeo_url:null}
}
