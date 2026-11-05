import { redirect } from 'next/navigation'
import { autorizarDirectorioAlumnas, leerDirectorioAlumnas } from '@/lib/admin-student-directory-server'
import AlumnasDirectorio from './AlumnasDirectorio'

export const metadata = { title: 'Todas las alumnas' }

export default async function AlumnasPage() {
  const auth = await autorizarDirectorioAlumnas()
  if ('error' in auth) {
    if (auth.error.status === 401) redirect('/login?next=%2Fadmin%2Falumnas')
    if (auth.error.status === 403) redirect('/inicio')
    return <AlumnasDirectorio inicial={{ estado: 'error', mensaje: auth.error.mensaje }} />
  }
  return <AlumnasDirectorio inicial={await leerDirectorioAlumnas(auth)} />
}
