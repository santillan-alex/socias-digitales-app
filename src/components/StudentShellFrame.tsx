'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AgendaProvider } from '@/app/inicio/AgendaProvider'
import type { StudentNavigationData } from '@/lib/student-navigation'
import { UnreadNoticesProvider, UnreadNoticeLink } from './UnreadNotices'
import StudentSidebar from './StudentSidebar'

export type { StudentNavigationData } from '@/lib/student-navigation'

const foco = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]'

export default function StudentShellFrame({ datos, children }: { datos: StudentNavigationData; children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const dialogo = useRef<HTMLDialogElement | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const inicial = datos.nombre.trim().slice(0, 1).toLocaleUpperCase('es-AR') || 'S'
  const tieneMenu = datos.formacion || datos.afiliadas === true

  // El diálogo nativo conserva foco, Escape y el retorno al botón que lo abrió.
  // Al navegar o pasar a escritorio se cierra, sin guardar estado en un efecto.
  useEffect(() => { if (dialogo.current?.open) dialogo.current.close() }, [pathname])
  useEffect(() => {
    const escritorio = window.matchMedia('(min-width: 1024px)')
    const cerrarEnEscritorio = () => { if (escritorio.matches && dialogo.current?.open) dialogo.current.close() }
    escritorio.addEventListener('change', cerrarEnEscritorio)
    return () => escritorio.removeEventListener('change', cerrarEnEscritorio)
  }, [])

  function abrirMenu() {
    if (!tieneMenu || !dialogo.current || dialogo.current.open) return
    dialogo.current.showModal()
    setMenuAbierto(true)
  }
  function cerrarMenu() { dialogo.current?.close() }

  return <UnreadNoticesProvider inicial={datos.avisos}>
    <AgendaProvider inicial={datos.hitos} errorInicial={datos.errorAgenda}>
      <div className="sd-student-shell min-h-screen bg-[#FAF7F3] text-[#211C19]" data-platform-role="member">
        <header className={`sd-student-shell__header flex min-h-[76px] items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-3 sm:px-8 ${tieneMenu ? 'sticky top-0 z-40 lg:sticky lg:top-0 lg:z-40 lg:h-[76px] lg:bg-[#FAF7F3]' : ''}`}>
          <Link href="/inicio" aria-label="Socias Digitales, inicio" className={`inline-flex min-h-11 min-w-0 shrink ${foco}`}>
            <img src="/academy-horizontal-color.png" alt="Socias Digitales Academy" className="h-11 w-auto max-w-full object-contain" />
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {tieneMenu && <button type="button" onClick={abrirMenu} aria-haspopup="dialog" aria-controls="sd-student-navigation-dialog" aria-expanded={menuAbierto} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-3 text-xs font-semibold text-[#294A38] lg:hidden ${foco}`}>
              <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              <span className="sr-only sm:not-sr-only">Menú</span>
            </button>}
            <UnreadNoticeLink variante="header" />
            <Link href="/perfil" aria-label="Mi perfil" data-student-mobile-avatar={tieneMenu ? 'hidden' : undefined} className={`${tieneMenu ? 'hidden sm:flex' : 'flex'} h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4CAD8] text-sm font-semibold text-[#211C19] ${foco}`}>{inicial}</Link>
          </div>
        </header>
        <div className={`sd-student-shell__body mx-auto grid max-w-[1400px] ${tieneMenu ? 'lg:grid-cols-[220px_minmax(0,1fr)]' : ''}`}>
          {tieneMenu && <aside className="sd-student-shell__sidebar hidden min-h-[calc(100dvh-76px)] border-r border-[#E7DDD5] px-5 py-7 lg:block">
            <div role="region" aria-label="Menú y próximo encuentro" tabIndex={0} className={`lg:sticky lg:top-[104px] lg:max-h-[calc(100dvh-132px)] lg:overflow-y-auto ${foco}`}>
              <StudentSidebar datos={datos} />
            </div>
          </aside>}
          <div className="sd-student-shell__content min-w-0">{children}</div>
        </div>
        {tieneMenu && <dialog ref={dialogo} id="sd-student-navigation-dialog" aria-labelledby="sd-student-navigation-title" onClose={() => setMenuAbierto(false)} onClick={event => { if (event.target === event.currentTarget) cerrarMenu() }} className="sd-student-shell__dialog fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_1.5rem)] max-w-sm overflow-y-auto rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-[#211C19] backdrop:bg-[#211C19]/60" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FFFDFA] pb-3">
            <h2 id="sd-student-navigation-title" className="text-lg font-semibold">Tu espacio</h2>
            <button type="button" onClick={cerrarMenu} autoFocus className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7DDD5] bg-[#FAF7F3] px-4 text-sm font-semibold text-[#294A38] ${foco}`}>Cerrar</button>
          </div>
          <div className="pt-5">{menuAbierto && <StudentSidebar datos={datos} onNavigate={cerrarMenu} />}</div>
        </dialog>}
      </div>
    </AgendaProvider>
  </UnreadNoticesProvider>
}
