import { NextResponse } from 'next/server'
import { autorizarAdmin } from '@/lib/admin-auth'
import { datosClase, esUuid, ubicacionClase, clasificacionClase } from '@/lib/class-management'

export async function POST(request: Request) {
  const auth = await autorizarAdmin(request)
  if (auth.error) return auth.error
  try {
    const input = await request.json()
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    if (input.action === 'renombrar') {
      const anterior =
        typeof input.anterior === 'string' ? input.anterior.trim() : ''
      const nuevo =
        typeof input.nuevo === 'string'
          ? input.nuevo.trim().replace(/\s+/g, ' ')
          : ''
      if (!anterior || !clasificacionClase(nuevo) || anterior.length > 100)
        return NextResponse.json(
          { error: 'Revisá el nombre del programa.' },
          { status: 400 },
        )
      const { data: actuales, error } = await auth.supabase.from('clases').select('id,modulo')
      if (error) throw error
      const nombres = [...new Set((actuales ?? []).map(c => c.modulo as string))]
      for (const modulo of nombres) {
        const lugar = ubicacionClase(modulo)
        if (lugar.programa !== ubicacionClase(anterior).programa) continue
        const destino = clasificacionClase(nuevo, lugar.seccion)
        if (!destino) return NextResponse.json({ error: 'Revisá el nombre del programa.' }, { status: 400 })
        const saved = await auth.supabase.from('clases').update({ modulo: destino }).eq('modulo', modulo)
        if (saved.error) throw saved.error
      }
      return NextResponse.json({ ok: true })
    }
    const datos = datosClase(input)
    if (!datos || (input.id && !esUuid(input.id)))
      return NextResponse.json(
        { error: 'Revisá el título, el programa, el orden y el acceso. Una clase Farmasi no admite Vimeo ni acceso de muestra.' },
        { status: 400 },
      )
    const cambiaSubmodulo = Object.hasOwn(input, 'farmasi_submodulo_id')
    const submodulo = input.farmasi_submodulo_id
    if (cambiaSubmodulo && submodulo !== null && !esUuid(submodulo))
      return NextResponse.json({ error: 'Elegí un submódulo Farmasi válido.' }, { status: 400 })
    let key: string | null = null
    let soloFarmaci = datos.solo_farmaci === true
    if (input.id) {
      const { data, error } = await auth.supabase
        .from('clases')
        .select('video_key,solo_farmaci')
        .eq('id', input.id)
        .maybeSingle()
      if (error) throw error
      if (!data)
        return NextResponse.json(
          { error: 'Clase no encontrada.' },
          { status: 404 },
        )
      key = data.video_key
      soloFarmaci = datos.solo_farmaci ?? (data.solo_farmaci === true)
    }
    if (!soloFarmaci && cambiaSubmodulo && submodulo !== null)
      return NextResponse.json({ error: 'Solo una clase exclusiva de Farmasi puede tener un submódulo Farmasi.' }, { status: 400 })
    if (soloFarmaci && (datos.acceso_gratuito || datos.vimeo_url))
      return NextResponse.json({ error: 'Una clase de Socias Farmasi debe usar video privado y no puede ser de muestra.' }, { status: 400 })
    if (datos.activo && !key && (soloFarmaci || !datos.vimeo_url))
      return NextResponse.json(
        { error: 'Cargá el video antes de publicar la clase.' },
        { status: 400 },
      )
    const persistir = {
      ...datos,
      ...(cambiaSubmodulo ? { farmasi_submodulo_id: submodulo === null ? null : submodulo.toLowerCase() }
        : input.id && datos.solo_farmaci === false ? { farmasi_submodulo_id: null } : {}),
    }
    const result = input.id
      ? await auth.supabase
          .from('clases')
          .update(persistir)
          .eq('id', input.id)
          .select('id')
          .single()
      : await auth.supabase
          .from('clases')
          .insert({ ...persistir, plan: '27' })
          .select('id')
          .single()
    if (result.error?.code === '23503' && cambiaSubmodulo && submodulo !== null)
      return NextResponse.json({ error: 'No encontramos ese submódulo Farmasi. Elegí uno de nuevo.' }, { status: 400 })
    if (result.error) throw result.error
    return NextResponse.json({ ok: true, id: result.data.id })
  } catch (error) {
    console.error('admin_class_save_failed', {
      code: (error as { code?: string })?.code,
    })
    return NextResponse.json(
      { error: 'No pudimos guardar la clase. Intentá nuevamente.' },
      { status: 500 },
    )
  }
}
