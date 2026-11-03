'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import AdminSectionMenu from '@/components/AdminSectionMenu'

interface Persona {
  id: string
  nombre: string | null
  email: string | null
  rol: string
}
export default function EquipoAdmin({
  personas,
  actualId,
  errorCarga,
  children,
}: {
  personas: Persona[]
  actualId: string
  errorCarga: boolean
  children?: ReactNode
}) {
  const router = useRouter(),
    [nombre, setNombre] = useState(''),
    [email, setEmail] = useState(''),
    [busqueda, setBusqueda] = useState(''),
    [aviso, setAviso] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [confirmado, setConfirmado] = useState(false)
  async function ejecutar(body: Record<string, unknown>) {
    setOcupado(true)
    setAviso('')
    try {
      const response = await fetch('/api/admin/equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setAviso(data.mensaje)
      setNombre('')
      setEmail('')
      setConfirmado(false)
      router.refresh()
    } catch (error) {
      setAviso(
        error instanceof Error
          ? error.message
          : 'No pudimos conectar. Intentá nuevamente.',
      )
    } finally {
      setOcupado(false)
    }
  }
  const admins = personas.filter((p) => p.rol === 'admin')
  const candidatas =
    busqueda.trim().length > 2
      ? personas
          .filter(
            (p) =>
              p.rol !== 'admin' &&
              `${p.nombre} ${p.email}`
                .toLowerCase()
                .includes(busqueda.trim().toLowerCase()),
          )
          .slice(0, 20)
      : []
  return (
    <main
      className="min-h-screen bg-[#F4EFEA] text-[#211C19]"
      data-platform-role="admin"
    >
      <header data-admin-section-header="true" className="border-b border-[#E7DDD5] px-5 py-4">
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm text-[#294A38]"
        >
          ← Panel de Flor
        </a>
      </header>
      <AdminSectionMenu />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8">
        <div>
          <p className="font-impact text-[10px] uppercase tracking-[.2em] text-[#294A38]">
            Administración
          </p>
          <h1 className="mt-2 font-serif text-4xl">Tu equipo</h1>
          <p className="mt-3 text-sm text-[#746A64]">
            Cada persona entra con su propia cuenta. Un administrador puede
            gestionar alumnas, clases y comunicaciones.
          </p>
        </div>
        {(aviso || errorCarga) && (
          <p
            role="status"
            className="rounded-2xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm"
          >
            {aviso || 'No pudimos cargar el equipo. Recargá la página.'}
          </p>
        )}
        <section className="rounded-3xl border border-[#E7DDD5] bg-[#FAF7F3] p-5 sm:p-7">
          <h2 className="font-impact text-lg font-semibold">
            Invitar a un administrador
          </h2>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void ejecutar({
                action: 'invitar',
                nombre,
                email,
                confirmar: confirmado,
              })
            }}
          >
            <label className="block text-sm">
              Nombre
              <input
                required
                maxLength={120}
                minLength={2}
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              Email
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base"
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                required
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
              />
              Confirmo dar acceso al panel de administración y a los datos de
              alumnas.
            </label>
            <button
              disabled={ocupado || !confirmado}
              className="min-h-11 rounded-full bg-[#294A38] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {ocupado ? 'Procesando…' : 'Enviar invitación'}
            </button>
            <p className="text-xs leading-5 text-[#746A64]">
              Recibe un email para confirmar y crear su contraseña. No se
              comparten contraseñas.
            </p>
          </form>
        </section>
        <section>
          <h2 className="mb-3 font-impact text-lg font-semibold">
            Administradores · {admins.length}
          </h2>
          <div className="space-y-3">
            {admins.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-[#E7DDD5] bg-[#FAF7F3] p-4"
              >
                <p className="font-medium">
                  {p.nombre || 'Sin nombre'}{' '}
                  {p.id === actualId && (
                    <span className="ml-2 text-xs text-[#746A64]">
                      Tu cuenta
                    </span>
                  )}
                </p>
                <p className="mt-1 break-all text-sm text-[#746A64]">
                  {p.email}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-[#E7DDD5] bg-[#FAF7F3] p-5 sm:p-7">
          <h2 className="font-impact text-lg font-semibold">
            Dar acceso a una cuenta existente
          </h2>
          <label className="mt-4 block text-sm">
            Buscar por nombre o email
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="mt-2 block min-h-11 w-full rounded-xl border border-[#D8CFC8] bg-white px-3 py-3 text-base"
            />
          </label>
          <div className="mt-4 space-y-3">
            {candidatas.map((p) => (
              <article
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#E7DDD5] p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="break-all text-sm text-[#746A64]">{p.email}</p>
                </div>
                <button
                  disabled={ocupado}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Dar acceso administrativo completo a ${p.email || p.nombre}? Podrá ver datos y administrar toda la plataforma.`,
                      )
                    )
                      void ejecutar({
                        action: 'promover',
                        id: p.id,
                        confirmar: true,
                      })
                  }}
                  className="min-h-11 rounded-full border border-[#294A38]/30 px-4 py-3 text-sm text-[#294A38] disabled:opacity-50"
                >
                  Dar acceso administrativo
                </button>
              </article>
            ))}
            {busqueda.trim().length > 2 && !candidatas.length && (
              <p className="text-sm text-[#746A64]">
                No hay cuentas para esa búsqueda.
              </p>
            )}
          </div>
        </section>
        {children}
      </div>
    </main>
  )
}
