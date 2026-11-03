'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminNavigationData } from '@/lib/admin-navigation'
import AdminSidebar from './AdminSidebar'
const AdminShellContext = createContext(false)
export function useAdminShell() { return useContext(AdminShellContext) }
const foco = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#294A38]'
const control = `inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-4 text-sm font-medium text-[#294A38] ${foco}`
export default function AdminShellFrame({ datos, children }: { datos: AdminNavigationData; children: ReactNode }) {
  const pathname = usePathname() ?? '', router = useRouter()
  const dialogo = useRef<HTMLDialogElement | null>(null), salidaEnCurso = useRef(false)
  const [menuAbierto, setMenuAbierto] = useState(false), [saliendo, setSaliendo] = useState(false), [errorSalida, setErrorSalida] = useState('')
  useEffect(() => { if (dialogo.current?.open) dialogo.current.close() }, [pathname])
  useEffect(() => {
    const escritorio = window.matchMedia('(min-width: 1024px)')
    const cerrar = () => { if (escritorio.matches && dialogo.current?.open) dialogo.current.close() }
    escritorio.addEventListener('change', cerrar)
    return () => escritorio.removeEventListener('change', cerrar)
  }, [])
  function cerrarMenu() { dialogo.current?.close() }
  function abrirMenu() { if (!dialogo.current || dialogo.current.open) return; dialogo.current.showModal(); setMenuAbierto(true) }
  async function cerrarSesion() {
    if (salidaEnCurso.current) return
    salidaEnCurso.current = true; setSaliendo(true); setErrorSalida('')
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      cerrarMenu(); router.push('/login'); router.refresh()
    } catch { setErrorSalida('No pudimos cerrar la sesión. Volvé a intentar.') }
    finally { salidaEnCurso.current = false; setSaliendo(false) }
  }
  return <AdminShellContext.Provider value={true}><div className="sd-admin-shell min-h-screen bg-[#FAF7F3] text-[#211C19]" data-platform-role="admin">
    <a href="#sd-admin-content" className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-[#FFFDFA] focus:p-4 ${foco}`}>Ir al contenido</a>
    <header className="sd-admin-shell__header sticky top-0 z-40 flex min-h-[76px] items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FAF7F3] px-5 py-3 sm:px-8 lg:h-[76px]">
      <Link href="/admin" prefetch={false} aria-label="Socias Digitales, Panel de Flor" className={`inline-flex min-h-11 min-w-0 shrink items-center ${foco}`}><Image src="/academy-horizontal-color.png" alt="Socias Digitales Academy" width={3922} height={1366} className="h-11 w-auto max-w-[160px] object-contain" /></Link>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4"><span className="hidden text-xs text-[#746A64] md:block">Administración</span><Link href="/perfil" prefetch={false} data-admin-desktop="true" className={`hidden min-h-11 items-center text-sm font-medium text-[#294A38] sm:inline-flex ${foco}`}>Mi perfil</Link><button type="button" disabled={saliendo} onClick={() => void cerrarSesion()} className={`hidden min-h-11 items-center text-sm text-[#746A64] sm:inline-flex ${foco}`}>{saliendo ? 'Cerrando…' : 'Cerrar sesión'}</button><button type="button" aria-haspopup="dialog" aria-controls="sd-admin-menu-dialog" aria-expanded={menuAbierto} onClick={abrirMenu} className={`${control} lg:hidden`}><svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg><span className="ml-2">Menú</span></button></div>
    </header>
    {errorSalida && !menuAbierto && <p role="alert" className="border-b border-[#E7DDD5] bg-[#FFFDFA] px-5 py-3 text-sm text-[#B01B30]">{errorSalida}</p>}
    <div className="sd-admin-shell__body mx-auto grid max-w-[1400px] lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="sd-admin-shell__sidebar hidden border-r border-[#E7DDD5] px-4 py-6 lg:block"><div role="region" aria-label="Menú de administración" tabIndex={0} className={`lg:sticky lg:top-[100px] lg:max-h-[calc(100dvh-124px)] lg:overflow-y-auto ${foco}`}><AdminSidebar datos={datos} /></div></aside><div id="sd-admin-content" tabIndex={-1} className="sd-admin-shell__content min-w-0">{children}</div></div>
    <dialog ref={dialogo} id="sd-admin-menu-dialog" aria-labelledby="sd-admin-menu-title" onClose={() => setMenuAbierto(false)} onClick={event => { if (event.target === event.currentTarget) cerrarMenu() }} className="sd-admin-shell__dialog fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%_-_1.5rem)] max-w-sm overflow-y-auto rounded-[24px] border border-[#E7DDD5] bg-[#FFFDFA] p-5 text-[#211C19] backdrop:bg-[#211C19]/60" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))', paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))' }}><div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E7DDD5] bg-[#FFFDFA] pb-3"><h2 id="sd-admin-menu-title" className="text-lg font-semibold">Panel de Flor</h2><button type="button" autoFocus onClick={cerrarMenu} className={control}>Cerrar</button></div>{menuAbierto && <div className="pt-4"><AdminSidebar datos={datos} onNavigate={cerrarMenu} /><div className="mt-5 border-t border-[#E7DDD5] pt-4"><p className="mb-2 break-words text-xs text-[#746A64]">{datos.nombre} · Administración</p><Link href="/perfil" prefetch={false} onClick={cerrarMenu} className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#294A38] ${foco}`}>Mi perfil</Link><button type="button" disabled={saliendo} onClick={() => void cerrarSesion()} className={`${control} mt-2 w-full`}>{saliendo ? 'Cerrando…' : 'Cerrar sesión'}</button>{errorSalida && <p role="alert" className="mt-3 text-sm text-[#B01B30]">{errorSalida}</p>}</div></div>}</dialog>
  </div></AdminShellContext.Provider>
}
