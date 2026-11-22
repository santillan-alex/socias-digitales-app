'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OCUPACIONES, INGRESOS, PASOS_PERFIL, pasosVisibles, normalizarRespuestaBienvenida, normalizarNombre, type RespuestasPerfil, type ValorPerfil } from '@/lib/perfil-preguntas'
import ArrowIcon from '@/components/ArrowIcon'

export default function BienvenidaCliente({userId,datosIniciales,pasoInicial,destino = '/inicio'}: {userId:string;datosIniciales:RespuestasPerfil;pasoInicial:number;destino?:string}) {
  const [datos,setDatos] = useState({...datosIniciales,nombre:normalizarNombre(String(datosIniciales.nombre ?? ''))})
  const [paso,setPaso] = useState(Math.max(0,Math.min(pasoInicial,PASOS_PERFIL.length-1)))
  const [guardando,setGuardando] = useState(false)
  const [subiendo,setSubiendo] = useState(false)
  const [error,setError] = useState('')
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const guardadoEnCurso = useRef(false)
  const pregunta = PASOS_PERFIL[paso]
  const visibles = pasosVisibles(datos)
  const posicion = Math.max(0,visibles.findIndex(item=>item.campo===pregunta.campo))
  const valor = datos[pregunta.campo] ?? null
  const opciones = pregunta.campo === 'ocupacion' ? OCUPACIONES : INGRESOS
  const ultimo = pregunta.campo === 'avatar_url'
  const finalizando = ultimo && guardando
  const inputClass = 'w-full rounded-2xl border border-[#EC9BB6]/60 bg-white px-4 py-4 text-base text-[#171413] outline-none focus:border-[#294A38] focus:ring-1 focus:ring-[#294A38]'

  function cambiar(value:ValorPerfil) { setDatos(actual=>({...actual,[pregunta.campo]:value}));setError('') }
  useEffect(()=>{
    if(!guardando) return
    const avisar=(evento:BeforeUnloadEvent)=>{evento.preventDefault();evento.returnValue=''}
    window.addEventListener('beforeunload',avisar)
    return ()=>window.removeEventListener('beforeunload',avisar)
  },[guardando])
  async function avanzar(eleccionExplicita=false) {
    if (guardadoEnCurso.current || subiendo) return
    setError('')
    let respuesta: ValorPerfil
    try { respuesta = normalizarRespuestaBienvenida(pregunta.campo,eleccionExplicita ? null : valor,{userId,supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,anterior:datosIniciales[pregunta.campo]},eleccionExplicita) }
    catch (causa) { setError(causa instanceof Error ? causa.message : 'Revisá tu respuesta.');return }
    const pasoAnterior = paso
    const campo = pregunta.campo
    const respuestas = {...datos,[campo]:respuesta}
    const siguientes = pasosVisibles(respuestas)
    const siguiente = PASOS_PERFIL.findIndex(item=>item.campo===siguientes.find(item=>PASOS_PERFIL.findIndex(original=>original.campo===item.campo)>pasoAnterior)?.campo)
    guardadoEnCurso.current=true
    setGuardando(true)
    setDatos(actual=>({...actual,[campo]:respuesta}))
    // La siguiente pregunta aparece antes de la red; se puede responder mientras guardamos.
    if(!ultimo) {
      setPaso(siguiente)
      requestAnimationFrame(()=>tituloRef.current?.focus())
    }
    const controlador = new AbortController()
    const limite = setTimeout(()=>controlador.abort(),20000)
    try {
      const res=await fetch('/api/cuenta/bienvenida',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campo,valor:respuesta,eleccion_explicita:eleccionExplicita}),keepalive:true,signal:controlador.signal})
      const body=await res.json()
      if(!res.ok) throw new Error(body.error || 'No pudimos guardar.')
      if(ultimo && body.completado) {window.location.assign(destino);return}
      if(ultimo) throw new Error('Todavía faltan respuestas por guardar. Volvé a intentar.')
      if(body.paso!==siguiente) setPaso(body.paso)
    } catch(causa) {
      setPaso(pasoAnterior)
      setError(`No pudimos confirmar el guardado. ${causa instanceof Error && !['TimeoutError','AbortError'].includes(causa.name) ? causa.message : 'Revisá tu conexión y volvé a intentar.'} Tus respuestas siguen acá.`)
      requestAnimationFrame(()=>tituloRef.current?.focus())
    }
    finally {clearTimeout(limite);guardadoEnCurso.current=false;setGuardando(false)}
  }
  function volver() {
    if(guardando || subiendo) return
    const anterior=visibles[Math.max(0,posicion-1)]
    setPaso(PASOS_PERFIL.findIndex(item=>item.campo===anterior.campo));setError('')
    requestAnimationFrame(()=>tituloRef.current?.focus())
  }
  async function subirFoto(e:React.ChangeEvent<HTMLInputElement>) {
    const archivo=e.target.files?.[0]
    if(!archivo) return
    const tipos:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
    const extension=tipos[archivo.type]
    if(!extension || archivo.size>5*1024*1024) {setError('Elegí una foto JPG, PNG o WebP de hasta 5 MB.');return}
    setSubiendo(true);setError('')
    try {
      const supabase=createClient()
      const nombre=`${userId}/avatar-${Date.now()}.${extension}`
      const {error}=await supabase.storage.from('avatars').upload(nombre,archivo)
      if(error) throw new Error('No pudimos subir la foto. Podés agregarla después en tu perfil.')
      cambiar(supabase.storage.from('avatars').getPublicUrl(nombre).data.publicUrl)
    } catch(causa) {setError(causa instanceof Error?causa.message:'No pudimos subir la foto.')}
    finally {setSubiendo(false)}
  }

  return <main className="min-h-screen bg-[#FAF7F3] px-5 pb-10 pt-6 text-[#171413] sm:pt-9">
    <header className="mx-auto flex max-w-5xl items-center justify-between">
      <Image src="/academy-horizontal-color.png" alt="Socias Digitales Academy" width={220} height={77} priority className="h-12 w-auto object-contain" />
      <button type="button" disabled={guardando||subiendo} onClick={async()=>{await createClient().auth.signOut();window.location.assign('/login')}} className="text-xs text-[#655B56]">Salir</button>
    </header>
    <section className="mx-auto mt-9 w-full max-w-xl sm:mt-14">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#294A38]">Tu bienvenida</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">Hola, bienvenida a Socias Digitales.</h1>
      <p className="mt-4 max-w-lg text-sm leading-6 text-[#655B56]">Completá tu perfil para entrar a la plataforma. Esta información nos ayuda a personalizar tu experiencia y acompañarte mejor. Después podés editar tus respuestas en “Mi perfil”.</p>
      <div className="mt-7 flex items-center gap-4">
        <div role="progressbar" aria-label="Progreso de tu bienvenida" aria-valuemin={0} aria-valuemax={visibles.length} aria-valuenow={posicion} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F4CAD8]"><div className="h-full rounded-full bg-[#294A38] transition-[width] duration-200" style={{width:`${posicion/visibles.length*100}%`}} /></div>
        <p className="text-[11px] font-medium tabular-nums text-[#655B56]">{posicion+1} de {visibles.length}</p>
      </div>
      <form onSubmit={e=>{e.preventDefault();void avanzar()}} className="mt-6 rounded-[24px] border border-[#EC9BB6]/45 bg-[#F4EFEA] p-6 sm:p-8">
        <h2 ref={tituloRef} tabIndex={-1} id="pregunta-bienvenida" className="font-impact text-xl font-semibold leading-snug outline-none sm:text-2xl">{pregunta.pregunta}</h2>
        <div className="mt-6">
          {['texto','telefono','fecha'].includes(pregunta.tipo) && <input key={pregunta.campo} aria-labelledby="pregunta-bienvenida" type={pregunta.tipo==='fecha'?'date':pregunta.tipo==='telefono'?'tel':'text'} value={String(valor??'')} onChange={e=>cambiar(e.target.value)} autoComplete={pregunta.campo==='nombre'?'name':pregunta.campo==='whatsapp'?'tel':pregunta.campo==='pais'?'country-name':pregunta.campo==='provincia'?'address-level1':undefined} placeholder={pregunta.campo==='nombre'?'Tu nombre':pregunta.campo==='whatsapp'?'Con código de país':undefined} className={inputClass} disabled={finalizando} />}
          {pregunta.tipo==='opciones' && <div role="group" aria-labelledby="pregunta-bienvenida" className="space-y-2">{[...opciones,...(typeof valor==='string' && valor && !opciones.includes(valor)?[valor]:[])].map(opcion=><button key={opcion} type="button" disabled={finalizando} aria-pressed={valor===opcion} onClick={()=>cambiar(opcion)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${valor===opcion?'border-[#294A38] bg-[#F4CAD8]':'border-[#EC9BB6]/40 bg-white hover:border-[#294A38]/50'}`}><span>{opcion}</span><span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full border ${valor===opcion?'border-[#294A38] bg-[#294A38]':'border-[#EC9BB6]'}`} /></button>)}</div>}
          {pregunta.tipo==='mama' && <div role="group" aria-labelledby="pregunta-bienvenida" className="grid grid-cols-2 gap-3">{[true,false].map(value=><button key={String(value)} type="button" disabled={finalizando} aria-pressed={valor===value} onClick={()=>cambiar(value)} className={`rounded-xl border px-4 py-4 text-sm font-medium ${valor===value?'border-[#294A38] bg-[#F4CAD8]':'border-[#EC9BB6]/40 bg-white'}`}>{value?'Sí':'No'}</button>)}</div>}
          {pregunta.tipo==='foto' && <div className="flex flex-col items-center gap-4">{typeof valor==='string' && valor ? <img src={valor} alt="Tu foto de perfil" className="h-24 w-24 rounded-full object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F4CAD8] font-impact text-3xl font-semibold text-[#294A38]">{String(datos.nombre || 'S').slice(0,1).toUpperCase()}</div>}<label className="cursor-pointer rounded-full border border-[#294A38]/30 bg-white px-5 py-3 text-sm font-medium text-[#294A38]">{subiendo?'Subiendo…':'Elegir foto'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={subirFoto} disabled={finalizando||subiendo} className="sr-only" /></label><p className="text-xs text-[#655B56]">Opcional. Podés agregarla después.</p></div>}
        </div>
        {error && <p role="alert" className="mt-4 text-sm leading-5 text-[#B01B30]">{error}</p>}
        <div className="mt-7 flex items-center justify-between gap-3">
          <button type="button" disabled={posicion===0||guardando||subiendo} onClick={volver} className="text-sm font-medium text-[#655B56] disabled:opacity-30">Atrás</button>
          <button type="submit" disabled={guardando||subiendo} className="inline-flex items-center gap-3 rounded-full bg-[#294A38] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{finalizando?'Guardando…':ultimo?'Entrar a mi espacio':'Continuar'}<ArrowIcon /></button>
        </div>
        {pregunta.opcional && <button type="button" disabled={guardando||subiendo} onClick={()=>void avanzar(true)} className="mt-5 block w-full text-center text-xs text-[#655B56] underline underline-offset-4">{ultimo?'Usar mi inicial como foto':'Prefiero no responder'}</button>}
      </form>
      <p role="status" aria-live="polite" className="mt-4 text-center text-[11px] text-[#655B56]">{guardando?'Guardando tu respuesta… Podés completar la siguiente.':'Las respuestas se guardan al avanzar.'}</p>
    </section>
  </main>
}
