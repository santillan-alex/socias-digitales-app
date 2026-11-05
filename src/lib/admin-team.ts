import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/admin'

// Emails are canonical Auth data, not a column of public.perfiles. Never
// authorize using this directory or user-editable metadata.
export async function buscarCuentaEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email)
    if (found) return found
    if (data.users.length < 1000) return null
  }
  throw new Error('Directorio demasiado grande: requiere búsqueda paginada.')
}
export interface IdentidadCuenta {
  email: string | null
  email_confirmado: boolean | null
  cuenta_encontrada: boolean
  ultimo_acceso?: string | null
}

// Lectura informativa del directorio que ya usa Equipo. La llamada debe estar
// detrás del rol administrativo protegido. No devolver el User completo ni
// derivar permisos, identidad o confirmación desde metadata editable.
export async function identidadesDeCuentas(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
  timeoutMs = 5000,
) {
  const pendiente = new Set(ids),
    identidades = new Map<string, IdentidadCuenta>()
  let directorioCompleto = false
  const limite = Date.now() + timeoutMs
  for (let page = 1; page <= 20 && pendiente.size; page++) {
    const restante = limite - Date.now()
    if (restante <= 0) throw new Error('El directorio tardó demasiado. Intentá nuevamente.')
    // ListUsers no acepta un signal por consulta. Limitar la espera y salir
    // evita bloquear el panel o iniciar páginas nuevas después del plazo.
    let timer: ReturnType<typeof setTimeout> | undefined
    const { data, error } = await Promise.race([
      admin.auth.admin.listUsers({ page, perPage: 1000 }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('El directorio tardó demasiado. Intentá nuevamente.')), restante) }),
    ]).finally(() => clearTimeout(timer))
    if (error) throw error
    for (const user of data.users) {
      if (pendiente.has(user.id)) {
        const email = user.email?.trim() || null
        identidades.set(user.id, {
          email,
          email_confirmado: email ? Boolean(user.email_confirmed_at) : null,
          cuenta_encontrada: true,
          ultimo_acceso: user.last_sign_in_at ?? null,
        })
        pendiente.delete(user.id)
      }
    }
    if (data.users.length < 1000) { directorioCompleto = true; break }
  }
  if (pendiente.size && !directorioCompleto) throw new Error('No pudimos completar el directorio de cuentas.')
  for (const id of pendiente) identidades.set(id, { email: null, email_confirmado: null, cuenta_encontrada: false, ultimo_acceso: null })
  return identidades
}

export async function emailsDelEquipo(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
) {
  const identidades = await identidadesDeCuentas(admin, ids)
  const emails = new Map<string, string>()
  for (const [id, identidad] of identidades) {
    if (!identidad.cuenta_encontrada) throw new Error('No pudimos leer todas las cuentas del equipo.')
    emails.set(id, identidad.email ?? '')
  }
  return emails
}
