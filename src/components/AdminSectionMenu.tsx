'use client'

import AdminSidebar from './AdminSidebar'
import { useAdminShell } from './AdminShellFrame'

// Las rutas /admin ya comparten su navegación en el layout. El fallback sirve
// a vistas aisladas, sin recrear una barra de pestañas ni otro menú en el panel.
export default function AdminSectionMenu() {
  const dentroDelPanel = useAdminShell()
  return dentroDelPanel ? null : <div className="sd-admin-section-menu border-b border-[#E7DDD5] p-5"><AdminSidebar datos={{ nombre: 'Administradora', solicitudesPendientes: null }} /></div>
}
