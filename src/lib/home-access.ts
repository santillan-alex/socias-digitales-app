import { obtenerNivelAcceso } from './access'
import { puedeVerClasesPrivadas, tieneAccesoFarmaci, type PerfilClases } from './class-access'

// La portada refleja el mismo acceso protegido que los videos. El Desafío no es el plan Socias.
export function accesoInicio(perfil: PerfilClases | null) {
  const tipo = perfil?.tipo_usuario
  const nivel = perfil?.rol !== 'admin' && (tipo === 'gratuito' || tipo === 'desafio' || tipo === 'socia') ? tipo : obtenerNivelAcceso(perfil?.rol, tipo)
  const formacion = perfil?.rol !== 'admin' && puedeVerClasesPrivadas(perfil)
  const sociaActiva = nivel === 'socia' && formacion
  // Farmasi es un acceso adicional: no habilita Estrategia, comunidad o agenda.
  const farmasi = perfil?.rol !== 'admin' && tieneAccesoFarmaci(perfil)
  const soloFarmasi = farmasi && !formacion && tipo !== 'socia' && tipo !== 'desafio'
  const conocerSocias = perfil?.rol !== 'admin' && perfil?.estado === 'activa' && tipo !== 'socia' &&
    (tipo === 'gratuito' || tipo === 'desafio' || farmasi)
  const suspendido = Boolean(perfil && (perfil.estado === 'pausada' || perfil.estado === 'cancelada') &&
    (nivel !== 'gratuito' || perfil.desafio_socias_habilitada))
  return { nivel, formacion, sociaActiva, suspendido, farmasi, soloFarmasi, conocerSocias,
    gratuito: nivel === 'gratuito' && !formacion && !suspendido,
    etiqueta: soloFarmasi ? 'Socias Farmasi' : sociaActiva ? 'Socias Digitales' : formacion || nivel === 'desafio' ? 'Desafío Socias' : nivel === 'socia' ? 'Socias Digitales' : 'Acceso gratuito',
  }
}
