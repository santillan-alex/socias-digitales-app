import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { obtenerRutaInicio } from '@/lib/access'
import { necesitaBienvenida } from '@/lib/perfil-preguntas'
import { FLUJO_FARMASI, RUTA_BIENVENIDA_FARMASI, RUTA_FARMASI } from '@/lib/farmasi-registration'
import { puedeVerClasesPrivadas, type PerfilClases } from '@/lib/class-access'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // Las vistas de aprobación son públicas y nunca consultan datos reales.
  if (pathname.startsWith('/preview')) return supabaseResponse

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  const userMetadata = claimsData?.claims?.user_metadata as { password_set?: boolean } | undefined

  function redirectConCookies(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    for (const header of ['cache-control', 'expires', 'pragma']) {
      const value = supabaseResponse.headers.get(header)
      if (value) response.headers.set(header, value)
    }
    return response
  }

  // Rutas que requieren login
  const rutasProtegidas = ['/bienvenida', '/inicio', '/perfil', '/admin', '/metricas', '/classroom', '/clases', '/socias', '/productos', '/ranking', '/logros', '/comunidad', '/resultados', '/checklist', '/objetivos', '/lanzamiento', '/notificaciones']
  if (!userId && rutasProtegidas.some(r => pathname.startsWith(r))) {
    const destino = `${pathname}${request.nextUrl.search}`
    return redirectConCookies(`/login?next=${encodeURIComponent(destino)}`)
  }

  let perfil: (PerfilClases & { plan: string | null }) | null = null
  if (userId) {
    const { data } = await supabase.from('perfiles').select('rol, plan, tipo_usuario, estado, desafio_socias_habilitada').eq('id', userId).maybeSingle()
    perfil = data
  }

  // Las invitaciones deben definir la contraseña antes de abrir cualquier panel.
  const debeCrearContrasena = userMetadata?.password_set === false
  const rutasExentas = ['/crear-contrasena', '/auth/callback']
  if (userId && debeCrearContrasena && !rutasExentas.some(r => pathname.startsWith(r))) {
    return redirectConCookies('/crear-contrasena')
  }

  if (userId && pathname === '/login' && request.nextUrl.searchParams.get('next') === RUTA_FARMASI)
    return redirectConCookies(RUTA_FARMASI)

  // Toda alumna completa la encuesta antes del panel; las exenciones antiguas
  // no permiten saltearla. Completarla no habilita clases ni administración.
  if (userId && perfil?.rol !== 'admin' && pathname !== '/bienvenida'
    && (rutasProtegidas.some(r => pathname.startsWith(r)) || ['/login','/registro','/registro/desafio','/registro/socias'].includes(pathname))) {
    const { data: bienvenida, error } = await supabase.from('bienvenida_perfiles').select('exenta,completado_at').eq('usuaria_id',userId).maybeSingle()
    if (error) return new NextResponse('No pudimos cargar tu perfil. Intentá nuevamente.', { status:503 })
    if (necesitaBienvenida(bienvenida,perfil?.rol)) {
      const aulaFarmasi = pathname === '/classroom' && request.nextUrl.searchParams.get('espacio') === FLUJO_FARMASI
      return redirectConCookies(aulaFarmasi ? RUTA_BIENVENIDA_FARMASI : '/bienvenida')
    }
  }

  // Si ya está logueada, llevarla al espacio asignado.
  if (userId && (pathname === '/login' || pathname === '/registro')) {
    return redirectConCookies(obtenerRutaInicio(perfil?.rol))
  }

  // Las rutas administrativas quedan limitadas al rol administrador.
  if (userId && pathname.startsWith('/admin') && perfil?.rol !== 'admin') {
    return redirectConCookies('/inicio')
  }

  // Las páginas de módulos pendientes muestran su bloqueo; nunca su contenido.
  // La autorización efectiva también se vuelve a comprobar en cada página/consulta.
  const rutasIniciales = ['/bienvenida', '/inicio', '/perfil', '/notificaciones', '/socias', '/productos', '/resultados', '/comunidad', '/metricas', '/objetivos', '/checklist', '/ranking', '/logros']
  const rutasDesafio = ['/lanzamiento', '/classroom', '/clases']
  if (userId && perfil?.rol !== 'admin' && rutasProtegidas.some(r => pathname.startsWith(r))) {
    const permitida = [...rutasIniciales, ...rutasDesafio].some(r => pathname.startsWith(r))
    if (!permitida) return redirectConCookies('/inicio?acceso=bloqueado')
    const requiereFormacion = pathname.startsWith('/lanzamiento') || pathname.startsWith('/classroom/')
    if (requiereFormacion && !puedeVerClasesPrivadas(perfil)) {
      return redirectConCookies('/inicio?acceso=pendiente')
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
