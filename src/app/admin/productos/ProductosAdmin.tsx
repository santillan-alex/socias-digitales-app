'use client'
import AdminSectionMenu from '@/components/AdminSectionMenu'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { precioProducto } from '@/lib/product-money'

interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  subtipo: string | null
  marca: string | null
  precio: number | null
  moneda: string
  comision_pct: number | null
  imagen_url: string | null
  link_compra: string | null
  activo: boolean
  orden: number
}

interface Props {
  productos: Producto[]
  cotizacion: number | null
  errorCarga?: boolean
}

const PRODUCTO_VACIO = {
  nombre: '',
  descripcion: '',
  tipo: 'digital',
  subtipo: 'ebook',
  marca: '',
  precio: null as number | null,
  moneda: 'USD',
  comision_pct: null as number | null,
  imagen_url: '',
  link_compra: '',
  activo: true,
  orden: 0,
}

const TIPO_EMOJI: Record<string, string> = { fisico: '📦', digital: '💻' }

const SUBTIPOS_FISICO = [
  'Cartera',
  'Billetera',
  'Ropa interior',
  'Ropa exterior',
  'Calzado',
  'Accesorios',
  'Bijouterie',
  'Cosmética',
  'Perfumería',
  'Hogar y deco',
  'Otro físico',
]

const SUBTIPOS_DIGITAL = ['Ebook', 'Membresía', 'Curso', 'Otro digital']

const SUBTIPO_LABEL: Record<string, string> = {
  ebook: 'Ebook',
  membresia: 'Membresía',
  curso: 'Curso',
  otro: 'Otro digital',
  producto_fisico: 'Producto físico',
}

class ErrorProducto extends Error {}

const CAMPOS_PRODUCTO = 'id,nombre,descripcion,tipo,subtipo,marca,precio,moneda,comision_pct,imagen_url,link_compra,activo,orden'
function datosCoinciden(fila: Producto | null, id: string, datos: Omit<Producto, 'id'>) {
  return Boolean(fila && fila.id === id && Object.entries(datos).every(([clave, valor]) => {
    const real = fila[clave as keyof Producto]
    return valor === null ? real === null : ['precio', 'comision_pct', 'orden'].includes(clave) ? real !== null && Number(real) === valor : real === valor
  }))
}

export default function ProductosAdmin({ productos, cotizacion, errorCarga = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<typeof PRODUCTO_VACIO & { id?: string }>(PRODUCTO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'fisico' | 'digital'>('todos')
  const [errorFicha, setErrorFicha] = useState('')
  const [errorImagen, setErrorImagen] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [avisos, setAvisos] = useState<Record<string, { error: boolean; texto: string }>>({})
  const [cambios, setCambios] = useState<{ fuente: Producto[]; filas: Record<string, Producto> }>({ fuente: productos, filas: {} })
  const [ocupada, setOcupada] = useState<string | null>(null)
  const bloqueo = useRef(false)
  const cargaImagen = useRef(false)
  const nuevoId = useRef<string | null>(null)
  const dialogo = useRef<HTMLDialogElement>(null)
  const origenFicha = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!modal) return
    const elemento = dialogo.current
    const origen = origenFicha.current
    elemento?.showModal()
    return () => {
      elemento?.close()
      if (origen?.isConnected) origen.focus({ preventScroll: true })
    }
  }, [modal])

  const filasConfirmadas = cambios.fuente === productos ? cambios.filas : {}
  const catalogo = [...productos.map(p => filasConfirmadas[p.id] ?? p), ...Object.values(filasConfirmadas).filter(p => !productos.some(original => original.id === p.id))]
  const productosFiltrados = catalogo.filter(p => filtro === 'todos' || p.tipo === filtro)
  function abrirNuevo(e: React.MouseEvent<HTMLButtonElement>) {
    if (bloqueo.current || cargaImagen.current || errorCarga) return
    origenFicha.current = e.currentTarget
    nuevoId.current = null; setErrorFicha(''); setErrorImagen(''); setMensaje('')
    setEditando({ ...PRODUCTO_VACIO, orden: catalogo.length }); setModal(true)
  }

  async function guardar() {
    if (bloqueo.current || cargaImagen.current || errorCarga) return
    bloqueo.current = true; setGuardando(true); setErrorFicha(''); setMensaje('')
    try {
      const { id: editandoId, ...campos } = editando
      const datos = { ...campos, nombre: campos.nombre.trim(), precio: campos.precio === null ? null : Number(campos.precio), comision_pct: campos.comision_pct === null ? null : Number(campos.comision_pct) }
      if (!datos.nombre || datos.nombre.length > 200) throw new ErrorProducto('Escribí un nombre de hasta 200 caracteres.')
      if (datos.precio !== null && (!Number.isFinite(datos.precio) || datos.precio < 0 || datos.precio > 1e9 || Math.abs(datos.precio * 100 - Math.round(datos.precio * 100)) > .00001)) throw new ErrorProducto('Revisá el precio: usá hasta dos decimales.')
      if (datos.comision_pct !== null && (!Number.isFinite(datos.comision_pct) || datos.comision_pct < 0 || datos.comision_pct > 100)) throw new ErrorProducto('La comisión debe estar entre 0 y 100%.')
      if (!['USD', 'ARS', 'MXN', 'EUR'].includes(datos.moneda)) throw new ErrorProducto('Elegí una moneda válida.')
      if (datos.link_compra) {
        let url: URL
        try { url = new URL(datos.link_compra) } catch { throw new ErrorProducto('Usá un enlace de compra HTTPS válido.') }
        if (url.protocol !== 'https:' || url.username || url.password) throw new ErrorProducto('Usá un enlace de compra HTTPS sin credenciales.')
      }
      const id = editandoId ?? (nuevoId.current ??= crypto.randomUUID())
      const resultado = editandoId
        ? await supabase.from('productos').update(datos).eq('id', id).select(CAMPOS_PRODUCTO).maybeSingle()
        : await supabase.from('productos').insert({ ...datos, id }).select(CAMPOS_PRODUCTO).maybeSingle()
      let confirmado = !resultado.error && datosCoinciden(resultado.data, id, datos) ? resultado.data as Producto : null
      if (!confirmado && !editandoId) {
        // El UUID se conserva al reintentar: una respuesta perdida no duplica el producto.
        const lectura = await supabase.from('productos').select(CAMPOS_PRODUCTO).eq('id', id).maybeSingle()
        if (!lectura.error && datosCoinciden(lectura.data, id, datos)) confirmado = lectura.data as Producto
      }
      if (!confirmado) throw new ErrorProducto('No pudimos confirmar el guardado. Tus datos siguen en la ficha; reintentá sin cambiarlos o actualizá el catálogo.')
      setCambios(prev => ({ fuente: productos, filas: { ...(prev.fuente === productos ? prev.filas : {}), [id]: confirmado! } })); nuevoId.current = null
      setModal(false); setEditando(PRODUCTO_VACIO); setMensaje('Producto guardado.'); router.refresh()
    } catch (causa) { setErrorFicha(causa instanceof ErrorProducto ? causa.message : 'No pudimos guardar. Tus datos siguen en la ficha.') }
    finally { setGuardando(false); bloqueo.current = false }
  }

  async function toggleActivo(p: Producto) {
    if (bloqueo.current || cargaImagen.current || errorCarga) return
    bloqueo.current = true; setOcupada(p.id); setAvisos(prev => ({ ...prev, [p.id]: { error: false, texto: '' } }))
    try {
      const { data, error } = await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id).eq('activo', p.activo).select(CAMPOS_PRODUCTO).maybeSingle()
      if (error || !data || data.id !== p.id || data.activo !== !p.activo) throw new ErrorProducto('No pudimos confirmar el cambio. Actualizá el catálogo y comprobá el estado antes de reintentar.')
      setCambios(prev => ({ fuente: productos, filas: { ...(prev.fuente === productos ? prev.filas : {}), [p.id]: data as Producto } }))
      setAvisos(prev => ({ ...prev, [p.id]: { error: false, texto: data.activo ? 'Producto activado.' : 'Producto desactivado. Su historial se conserva.' } })); router.refresh()
    } catch (causa) { setAvisos(prev => ({ ...prev, [p.id]: { error: true, texto: causa instanceof ErrorProducto ? causa.message : 'No pudimos conectar. Comprobá el estado antes de reintentar.' } })) }
    finally { setOcupada(null); bloqueo.current = false }
  }

  async function subirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo || bloqueo.current || cargaImagen.current || errorCarga) return
    setErrorImagen('')
    const formatos: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!formatos[archivo.type] || archivo.size > 3 * 1024 * 1024) { e.target.value = ''; setErrorImagen('Usá una imagen JPG, PNG o WEBP de hasta 3 MB.'); return }
    cargaImagen.current = true; setSubiendoImg(true)
    const nombre = `producto-${crypto.randomUUID()}.${formatos[archivo.type]}`
    try {
      const { error } = await supabase.storage.from('productos').upload(nombre, archivo, { upsert: false })
      if (error) throw new ErrorProducto('No pudimos subir la imagen. Conservamos la anterior; podés reintentar.')
      const { data } = supabase.storage.from('productos').getPublicUrl(nombre)
      if (!data?.publicUrl) throw new ErrorProducto('No pudimos confirmar la imagen. Conservamos la anterior.')
      setEditando(prev => ({ ...prev, imagen_url: data.publicUrl }))
    } catch (causa) { setErrorImagen(causa instanceof ErrorProducto ? causa.message : 'No pudimos subir la imagen. Conservamos la anterior.') }
    finally { cargaImagen.current = false; setSubiendoImg(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex flex-wrap gap-3 justify-between items-center">
        <div className="min-w-0 flex flex-wrap items-center gap-3">
          <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</a>
          <h1 className="break-words text-lg font-bold text-rose-600">Catálogo de Productos</h1>
        </div>
        <button type="button" disabled={Boolean(ocupada) || errorCarga} onClick={abrirNuevo}
          className="min-h-11 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
          + Nuevo producto
        </button>
      </nav>
      <AdminSectionMenu /><div className="mx-auto max-w-5xl px-4 pt-5"><a href="/admin/afiliadas/productos" className="inline-flex min-h-11 items-center rounded-full border border-[#E7DDD5] bg-[#FFFDFA] px-5 py-3 text-sm font-semibold text-[#294A38]">Productos para Afiliadas →</a></div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {errorCarga && <p role="alert" className="rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-4 text-sm">No pudimos cargar el catálogo completo. <button type="button" onClick={() => router.refresh()} className="min-h-11 font-semibold underline">Reintentar</button></p>}
        {mensaje && <p role="status" className="rounded-xl border border-[#E7DDD5] bg-[#FAF7F3] p-4 text-sm">{mensaje}</p>}

        {/* Stats rápidas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{errorCarga ? '—' : catalogo.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total productos</p>
          </div>
          <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-blue-500">{errorCarga ? '—' : catalogo.filter(p => p.tipo === 'digital').length}</p>
            <p className="text-xs text-gray-400 mt-1">💻 Digitales</p>
          </div>
          <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-amber-500">{errorCarga ? '—' : catalogo.filter(p => p.tipo === 'fisico').length}</p>
            <p className="text-xs text-gray-400 mt-1">📦 Físicos</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {(['todos', 'digital', 'fisico'] as const).map(f => (
            <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}
              className={`min-h-11 px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filtro === f ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-rose-300'}`}>
              {f === 'todos' ? 'Todos' : f === 'digital' ? '💻 Digitales' : '📦 Físicos'}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        {errorCarga ? null : productosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🛍️</p>
            <p>{catalogo.length ? 'No hay productos en esta categoría.' : 'No hay productos todavía. Creá el primero.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {productosFiltrados.map(p => (
              <div key={p.id} className="min-w-0 bg-white rounded-2xl border border-[#E7DDD5] shadow-sm overflow-hidden">
                {/* Imagen */}
                <div className="h-44 bg-[#F4CAD8] relative flex items-center justify-center overflow-hidden">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-6xl">{TIPO_EMOJI[p.tipo]}</span>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.tipo === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {TIPO_EMOJI[p.tipo]} {p.tipo === 'digital' ? 'Digital' : 'Físico'}
                    </span>
                    {p.subtipo && p.subtipo !== 'otro' && (
                      <span className="text-xs bg-white/90 text-gray-600 px-2 py-1 rounded-full font-medium">
                        {SUBTIPO_LABEL[p.subtipo] ?? p.subtipo}
                      </span>
                    )}
                  </div>
                  {!p.activo && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                      <span className="bg-gray-800 text-white text-xs px-3 py-1 rounded-full font-medium">Inactivo</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="break-words font-bold text-gray-900 mb-0.5">{p.nombre}</h3>
                  {p.marca && <p className="text-xs text-rose-500 font-medium mb-1">{p.marca}</p>}
                  {p.descripcion && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{p.descripcion}</p>}

                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="break-words text-lg font-bold text-rose-600">{precioProducto(p.precio, p.moneda)}</span>
                      {p.precio !== null && p.moneda === 'USD' && cotizacion !== null && (
                        <p className="text-xs text-gray-500">Aprox. {precioProducto(p.precio * cotizacion, 'ARS')}</p>
                      )}
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      {p.comision_pct === null ? 'Comisión a definir' : `${p.comision_pct}% comisión`}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" disabled={Boolean(ocupada)} onClick={() => toggleActivo(p)}
                      className={`min-h-11 flex-1 text-xs py-1.5 rounded-lg font-medium border transition-colors disabled:opacity-50 ${p.activo ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                      {ocupada === p.id ? 'Guardando…' : p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" disabled={Boolean(ocupada)} onClick={e => {
                      if (bloqueo.current) return
                      origenFicha.current = e.currentTarget
                      setErrorFicha(''); setErrorImagen(''); setMensaje('')
                      setEditando({ nombre: p.nombre, descripcion: p.descripcion ?? '', tipo: p.tipo, subtipo: p.subtipo ?? '', marca: p.marca ?? '', precio: p.precio, moneda: p.moneda, comision_pct: p.comision_pct, imagen_url: p.imagen_url ?? '', link_compra: p.link_compra ?? '', activo: p.activo, orden: p.orden, id: p.id })
                      setModal(true)
                    }} className="min-h-11 flex-1 text-xs py-1.5 rounded-lg font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                      Editar
                    </button>
                  </div>
                  {avisos[p.id]?.texto && <p role={avisos[p.id].error ? 'alert' : 'status'} className="mt-3 break-words text-sm leading-6 text-[#294A38]">{avisos[p.id].texto}{avisos[p.id].error && <button type="button" disabled={Boolean(ocupada)} onClick={() => { setCambios({ fuente: productos, filas: {} }); setAvisos({}); router.refresh() }} className="min-h-11 underline">Actualizar catálogo</button>}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs leading-6 text-[#746A64]">Desactivar retira un producto del catálogo disponible y conserva sus resultados y enlaces históricos.</p>
      </div>

      {/* Modal */}
      {modal && (
        <dialog ref={dialogo} aria-labelledby="titulo-producto" onCancel={e => { if (bloqueo.current || cargaImagen.current) e.preventDefault(); else setModal(false) }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-0 text-[#211C19] backdrop:bg-black/40">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 id="titulo-producto" className="font-bold text-gray-900">{editando.id ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button type="button" disabled={guardando || subiendoImg} aria-label="Cerrar ficha de producto" onClick={() => setModal(false)} className="min-h-11 min-w-11 text-gray-400 hover:text-gray-600 text-xl disabled:opacity-50">✕</button>
            </div>

            <fieldset disabled={guardando || subiendoImg} className="min-w-0 p-6 space-y-4">
              {/* Preview imagen */}
              <div className="h-36 bg-gray-100 rounded-xl overflow-hidden relative flex items-center justify-center">
                {editando.imagen_url
                  ? <img src={editando.imagen_url} className="w-full h-full object-cover" alt="" />
                  : <span className="text-5xl">{TIPO_EMOJI[editando.tipo]}</span>
                }
                <label className="absolute bottom-2 right-2 inline-flex min-h-11 items-center bg-white text-xs font-medium px-3 py-1.5 rounded-lg shadow cursor-pointer hover:bg-gray-50">
                  {subiendoImg ? 'Subiendo...' : 'Subir imagen'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={subirImagen} className="sr-only" />
                </label>
              </div>
              {errorImagen && <p role="alert" className="rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-3 text-sm">{errorImagen}</p>}

              <div>
                <label htmlFor="producto-nombre" className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                <input id="producto-nombre" maxLength={200} type="text" placeholder="Ej: Membresía Socias Digitales"
                  value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300" />
              </div>

              <div>
                <label htmlFor="producto-descripcion" className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                <textarea id="producto-descripcion" placeholder="Descripción del producto..." rows={2}
                  value={editando.descripcion ?? ''}
                  onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="producto-tipo" className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                  <select id="producto-tipo" value={editando.tipo}
                    onChange={e => setEditando(p => ({ ...p, tipo: e.target.value, subtipo: e.target.value === 'fisico' ? 'Cartera' : 'Ebook' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300">
                    <option value="digital">💻 Digital</option>
                    <option value="fisico">📦 Físico</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="producto-subtipo" className="block text-xs font-medium text-gray-500 mb-1">Tipo de producto</label>
                  <select id="producto-subtipo" value={editando.subtipo ?? ''}
                    onChange={e => setEditando(p => ({ ...p, subtipo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300">
                    {(editando.tipo === 'fisico' ? SUBTIPOS_FISICO : SUBTIPOS_DIGITAL).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="producto-marca" className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
                <input id="producto-marca" type="text" placeholder="Ej: Desigual, Victoria's Secret, Nike..."
                  value={editando.marca ?? ''}
                  onChange={e => setEditando(p => ({ ...p, marca: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="producto-moneda" className="block text-xs font-medium text-gray-500 mb-1">Moneda</label>
                  <select id="producto-moneda" value={editando.moneda}
                    onChange={e => setEditando(p => ({ ...p, moneda: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300">
                    <option>USD</option>
                    <option>ARS</option>
                    <option>MXN</option>
                    <option>EUR</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="producto-precio" className="block text-xs font-medium text-gray-500 mb-1">Precio en {editando.moneda}</label>
                  <input id="producto-precio" type="number" min={0} step={0.01} placeholder="0.00"
                    value={editando.precio ?? ''}
                    onChange={e => setEditando(p => ({ ...p, precio: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300" />
                  {editando.precio !== null && editando.precio > 0 && editando.moneda === 'USD' && cotizacion !== null && (
                    <p className="text-xs text-rose-500 font-medium mt-1">
                      Aprox. {precioProducto(editando.precio * cotizacion, 'ARS')}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="producto-comision" className="block text-xs font-medium text-gray-500 mb-1">Comisión %</label>
                  <input id="producto-comision" type="number" min={0} max={100} step={0.5}
                    value={editando.comision_pct ?? ''}
                    onChange={e => setEditando(p => ({ ...p, comision_pct: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300" />
                </div>
              </div>

              <div>
                <label htmlFor="producto-link" className="block text-xs font-medium text-gray-500 mb-1">Link de compra (externo)</label>
                <input id="producto-link" type="url" placeholder="https://..."
                  value={editando.link_compra ?? ''}
                  onChange={e => setEditando(p => ({ ...p, link_compra: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-rose-300" />
              </div>
            </fieldset>

            {errorFicha && <p role="alert" className="mx-6 rounded-xl border border-[#EC9BB6] bg-[#F4CAD8] p-3 text-sm">{errorFicha}</p>}
            <div className="p-6 border-t border-gray-100 flex flex-wrap gap-3">
              <button type="button" disabled={guardando || subiendoImg} onClick={() => setModal(false)} className="min-h-11 flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando || subiendoImg || errorCarga || !editando.nombre.trim()}
                className="min-h-11 flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white py-2.5 rounded-lg text-sm font-medium">
                {guardando ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
        </dialog>
      )}
    </div>
  )
}
