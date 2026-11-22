import { createHash, createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { puedeVerClase } from '@/lib/class-access'

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

function firmarUrlR2(objectKey: string) {
  const accountId = process.env.R2_S3_ACCOUNT_ID
  const bucket = process.env.R2_BUCKET_NAME
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null

  const host = `${accountId}.r2.cloudflarestorage.com`
  const canonicalUri = `/${encodeRfc3986(bucket)}/${objectKey.split('/').map(encodeRfc3986).join('/')}`
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const region = 'auto'
  const service = 's3'
  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const params: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', '14400'],
    ['X-Amz-SignedHeaders', 'host'],
  ]
  const canonicalQuery = params
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
  const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest()
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Clase no encontrada.' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Iniciá sesión para reproducir esta clase.' }, { status: 401 })

  const { data: perfil } = await supabase.from('perfiles').select('rol, tipo_usuario, estado, desafio_socias_habilitada,socias_farmaci_habilitada').eq('id', user.id).maybeSingle()
  const esAdmin = perfil?.rol === 'admin'
  const { data: clase } = await supabase.from('clases').select('video_key, activo, acceso_gratuito,solo_farmaci').eq('id', id).maybeSingle()
  if (!clase || (!clase.activo && !esAdmin) || !clase.video_key) return NextResponse.json({ error: 'Esta clase todavía no tiene un video disponible.' }, { status: 404 })
  if (!puedeVerClase(perfil,clase)) return NextResponse.json({ error: 'Esta clase requiere acceso Socias Digitales.' }, { status: 403 })

  const url = firmarUrlR2(clase.video_key)
  if (!url) return NextResponse.json({ error: 'El reproductor todavía no está configurado.' }, { status: 503 })
  return NextResponse.json({ url, expiresIn: 14400 }, { headers: { 'Cache-Control': 'private, no-store' } })
}
