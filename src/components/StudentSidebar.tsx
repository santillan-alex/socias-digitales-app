'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavigationIcon from './NavigationIcon'
import { UnreadNoticeLink } from './UnreadNotices'
import ProximaClase from '@/app/inicio/ProximaClase'
import {
  activoSeccionEstudiante,
  herramientasEstudiante,
  seccionesPrincipalesEstudiante,
  type StudentNavigationData,
  type StudentNavigationItem,
} from '@/lib/student-navigation'

const foco = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]'

function EnlaceSeccion({ seccion, pathname, onNavigate }: {
  seccion: StudentNavigationItem
  pathname: string
  onNavigate?: () => void
}) {
  const activo = activoSeccionEstudiante(pathname, seccion)
  return <Link href={seccion.href} prefetch={false} onClick={onNavigate} aria-current={activo ? 'page' : undefined}
    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${foco} ${activo ? 'bg-[#F4CAD8] font-semibold text-[#211C19]' : 'text-[#746A64] hover:bg-[#F4EFEA] hover:text-[#211C19]'}`}>
    <NavigationIcon name={seccion.icono} /><span className="min-w-0 break-words">{seccion.nombre}</span>
  </Link>
}

export default function StudentSidebar({ datos, onNavigate }: { datos: StudentNavigationData; onNavigate?: () => void }) {
  const pathname = usePathname() ?? ''
  const utiles = herramientasEstudiante(datos)
  return <>
    <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#746A64]">Mi espacio</p>
    <nav data-student-menu className="mt-5 space-y-1.5" aria-label="Navegación principal">
      {seccionesPrincipalesEstudiante(datos).map(seccion => seccion.id === 'notificaciones'
        ? <div key={seccion.id} onClick={event => { if (event.target instanceof Element && event.target.closest('a[href]')) onNavigate?.() }}>
          <UnreadNoticeLink variante="menu" activo={activoSeccionEstudiante(pathname, seccion)} />
        </div>
        : <EnlaceSeccion key={seccion.id} seccion={seccion} pathname={pathname} onNavigate={onNavigate} />)}
    </nav>
    {utiles.length > 0 && <div className="mt-5 border-t border-[#E7DDD5] pt-4">
      <p className="px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#746A64]">Mis herramientas</p>
      <nav data-student-menu className="mt-2 space-y-1" aria-label="Herramientas de Socias">
        {utiles.map(seccion => <EnlaceSeccion key={seccion.id} seccion={seccion} pathname={pathname} onNavigate={onNavigate} />)}
      </nav>
    </div>}
    {datos.formacion && <ProximaClase ahoraInicial={datos.ahoraInicial} variante="contador" />}
  </>
}
