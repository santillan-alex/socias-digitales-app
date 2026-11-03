'use client'

import { usePathname } from 'next/navigation'
import MobileNavigation from './MobileNavigation'

const PLATFORM_PATHS = [
  '/inicio', '/perfil', '/classroom', '/clases', '/lanzamiento', '/comunidad',
  '/resultados', '/productos', '/objetivos', '/checklist', '/ranking', '/logros',
  '/metricas', '/admin', '/notificaciones', '/cuenta', '/afiliadas',
]

export default function PlatformAppearance({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const isPlatform = PLATFORM_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))

  if (!isPlatform) return <div className="sd-access-design">{children}</div>

  const area = pathname.startsWith('/admin') ? 'platform-design--admin' : 'platform-design--member'
  return <div className={`platform-design ${area}`}>{children}{area === 'platform-design--member' && <MobileNavigation />}</div>
}
