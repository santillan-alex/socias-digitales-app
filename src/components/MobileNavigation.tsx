'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import NavigationIcon from './NavigationIcon'
import { activoSeccionEstudiante, seccionesMovilesEstudiante, type StudentNavigationData, type StudentNavigationItem } from '@/lib/student-navigation'

export const MOBILE_SECTIONS = [
  { id: 'inicio', href: '/inicio', nombre: 'Inicio', icono: 'inicio', rutas: ['/inicio'] },
  { id: 'programa', href: '/clases', nombre: 'Clases', icono: 'clases', rutas: ['/clases', '/classroom'] },
  { id: 'notificaciones', href: '/notificaciones', nombre: 'Avisos', icono: 'notificaciones', rutas: ['/notificaciones'] },
  { id: 'perfil', href: '/perfil', nombre: 'Perfil', icono: 'perfil', rutas: ['/perfil', '/cuenta'] },
] as const

function NavigationItems({ items, pathname, search = '' }: { items: readonly StudentNavigationItem[]; pathname: string; search?: string }) {
  return <nav className="sd-mobile-navigation" aria-label="Navegación móvil" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map(s => {
      const activo = activoSeccionEstudiante(pathname, s, search)
      const nombre = s.id === 'farmasi' ? 'Farmasi' : s.id === 'programa' ? 'Clases' : s.id === 'notificaciones' ? 'Avisos' : s.id === 'perfil' ? 'Perfil' : s.id === 'conocer-socias' ? 'Socias' : s.nombre
      return <Link key={s.href} href={s.href} prefetch={false} aria-current={activo ? 'page' : undefined} aria-label={s.nombre} className={`sd-mobile-navigation__item ${activo ? 'sd-mobile-navigation__item--active' : ''}`}>
        <span className="sd-mobile-navigation__icon"><NavigationIcon name={s.icono} /></span>
        <span className="max-w-full break-words text-center leading-tight">{nombre}</span>
      </Link>
    })}
  </nav>
}

function NavigationConDatos({ datos }: { datos: StudentNavigationData }) {
  return <NavigationItems items={seccionesMovilesEstudiante(datos)} pathname={usePathname() ?? ''} search={useSearchParams()?.toString() ?? ''} />
}

function NavigationBase() {
  return <NavigationItems items={MOBILE_SECTIONS} pathname={usePathname() ?? ''} />
}

export default function MobileNavigation({ datos }: { datos?: StudentNavigationData } = {}) {
  return datos ? <Suspense fallback={<NavigationItems items={seccionesMovilesEstudiante(datos)} pathname="" />}><NavigationConDatos datos={datos} /></Suspense> : <NavigationBase />
}
