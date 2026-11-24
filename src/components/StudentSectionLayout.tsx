import type { ReactNode } from 'react'
import { leerNavegacionAlumna } from '@/lib/student-navigation-server'
import StudentShellFrame from './StudentShellFrame'

export default async function StudentSectionLayout({ children }: { children: ReactNode }) {
  const datos = await leerNavegacionAlumna()
  // Admin y accesos sin un espacio propio comprobado conservan su vista original.
  // Cada página y cada API siguen verificando sus propios permisos.
  return datos ? <StudentShellFrame datos={datos}>{children}</StudentShellFrame> : children
}
