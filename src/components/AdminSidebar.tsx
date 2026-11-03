'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavigationIcon from './NavigationIcon'
import { ADMIN_SECTIONS } from '@/lib/admin-sections'
import { ADMIN_NAVIGATION_GROUPS, seccionAdminActiva, seccionesGrupoAdmin, type AdminNavigationData, type AdminNavigationSection } from '@/lib/admin-navigation'
const iconosGrupo = { personas: 'solicitudes', formacion: 'clases', negocio: 'productos' } as const
const foco = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294A38]'
function EnlaceAdmin({ item, activo, pendientes, onNavigate }: { item: AdminNavigationSection; activo: string | null; pendientes: number | null; onNavigate?: () => void }) {
  return <Link href={item.href} prefetch={false} onClick={onNavigate} aria-current={activo === item.href ? 'page' : undefined} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition ${foco} ${activo === item.href ? 'bg-[#F4CAD8] font-semibold text-[#211C19]' : 'text-[#746A64] hover:bg-[#F4EFEA] hover:text-[#211C19]'}`}><span className="flex min-w-0 items-center gap-3"><NavigationIcon name={item.icon} /><span className="min-w-0 break-words">{item.label}</span></span>{item.href === '/admin/desafio' && (pendientes === null ? <span aria-label="Solicitudes pendientes sin comprobar" className="shrink-0 text-xs">—</span> : pendientes > 0 ? <span aria-label={`${pendientes} solicitudes pendientes`} className="shrink-0 rounded-full bg-[#FFFDFA] px-2 py-0.5 text-[11px] font-semibold text-[#211C19]">{pendientes}</span> : null)}</Link>
}
export default function AdminSidebar({ datos, onNavigate }: { datos: AdminNavigationData; onNavigate?: () => void }) {
  const activo = seccionAdminActiva(usePathname() ?? '')
  const inicio = ADMIN_SECTIONS[0], configuracion = ADMIN_SECTIONS.find(s => s.href === '/admin/configuracion')!
  return <nav data-admin-menu aria-label="Navegación de administración" className="sd-admin-navigation space-y-2">
    <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[#746A64]">Panel de Flor</p>
    <EnlaceAdmin item={inicio} activo={activo} pendientes={datos.solicitudesPendientes} onNavigate={onNavigate} />
    {ADMIN_NAVIGATION_GROUPS.map(grupo => <details key={grupo.id} open={grupo.rutas.some(r => r === activo)} className="group border-t border-[#E7DDD5] pt-2"><summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold leading-5 text-[#294A38] transition-colors hover:bg-[#F4EFEA] ${foco}`}><span className="flex min-w-0 items-center gap-3"><NavigationIcon name={iconosGrupo[grupo.id]} /><span className="min-w-0">{grupo.nombre}</span></span>{grupo.id === 'personas' && datos.solicitudesPendientes !== null && datos.solicitudesPendientes > 0 && <span aria-label={`${datos.solicitudesPendientes} solicitudes pendientes`} className="shrink-0 rounded-full bg-[#F4CAD8] px-2 py-0.5 text-[11px] leading-4 tracking-normal text-[#211C19] group-open:hidden">{datos.solicitudesPendientes}</span>}<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" className="shrink-0 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></summary><div className="ml-3 mt-1 space-y-1 border-l border-[#E7DDD5] pb-2 pl-2">{seccionesGrupoAdmin(grupo.rutas).map(item => <EnlaceAdmin key={item.href} item={item} activo={activo} pendientes={datos.solicitudesPendientes} onNavigate={onNavigate} />)}</div></details>)}
    <div className="border-t border-[#E7DDD5] pt-2"><EnlaceAdmin item={configuracion} activo={activo} pendientes={datos.solicitudesPendientes} onNavigate={onNavigate} /></div>
  </nav>
}
