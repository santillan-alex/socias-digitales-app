import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { TAMANO_PARTE, MAX_VIDEO_BYTES, esUuid } from './class-management'

const enc = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex')
const hmac = (key: Buffer | string, value: string) =>
  createHmac('sha256', key).update(value).digest()
export function r2Configurado() {
  return [
    'R2_S3_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ].every((k) => Boolean(process.env[k]))
}
function config(key: string) {
  if (!r2Configurado())
    throw new Error('El almacenamiento no está configurado.')
  const host = `${process.env.R2_S3_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const uri = `/${enc(process.env.R2_BUCKET_NAME!)}/${key.split('/').map(enc).join('/')}`
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const scope = `${date.slice(0, 8)}/auto/s3/aws4_request`
  const signing = hmac(
    hmac(
      hmac(
        hmac(`AWS4${process.env.R2_SECRET_ACCESS_KEY!}`, date.slice(0, 8)),
        'auto',
      ),
      's3',
    ),
    'aws4_request',
  )
  return { host, uri, date, scope, signing }
}
function queryString(query: Record<string, string>) {
  return Object.entries(query)
    .map(([k, v]) => [enc(k), enc(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}
export function firmarParte(key: string, uploadId: string, partNumber: number) {
  const c = config(key)
  const query = queryString({
    uploadId,
    partNumber: String(partNumber),
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${process.env.R2_ACCESS_KEY_ID}/${c.scope}`,
    'X-Amz-Date': c.date,
    'X-Amz-Expires': '900',
    'X-Amz-SignedHeaders': 'host',
  })
  const canonical = [
    'PUT',
    c.uri,
    query,
    `host:${c.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const signature = createHmac('sha256', c.signing)
    .update(['AWS4-HMAC-SHA256', c.date, c.scope, hash(canonical)].join('\n'))
    .digest('hex')
  return `https://${c.host}${c.uri}?${query}&X-Amz-Signature=${signature}`
}
export function firmarCargaMaterial(key: string, contentType: string) {
  const c = config(key)
  const query = queryString({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${process.env.R2_ACCESS_KEY_ID}/${c.scope}`,
    'X-Amz-Date': c.date, 'X-Amz-Expires': '600',
    'X-Amz-SignedHeaders': 'content-type;host',
  })
  const canonical = ['PUT', c.uri, query, `content-type:${contentType}\nhost:${c.host}\n`, 'content-type;host', 'UNSIGNED-PAYLOAD'].join('\n')
  const signature = createHmac('sha256', c.signing).update(['AWS4-HMAC-SHA256', c.date, c.scope, hash(canonical)].join('\n')).digest('hex')
  return `https://${c.host}${c.uri}?${query}&X-Amz-Signature=${signature}`
}
export function firmarDescargaPrivada(key: string, contentDisposition: string, expiresIn = 60) {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 300 || /[\r\n]/.test(contentDisposition)) throw new Error('Descarga no válida.')
  const c = config(key)
  const query = queryString({
    'response-content-disposition': contentDisposition,
    'response-content-type': 'application/octet-stream',
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${process.env.R2_ACCESS_KEY_ID}/${c.scope}`,
    'X-Amz-Date': c.date, 'X-Amz-Expires': String(expiresIn), 'X-Amz-SignedHeaders': 'host',
  })
  const canonical = ['GET', c.uri, query, `host:${c.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const signature = createHmac('sha256', c.signing).update(['AWS4-HMAC-SHA256', c.date, c.scope, hash(canonical)].join('\n')).digest('hex')
  return `https://${c.host}${c.uri}?${query}&X-Amz-Signature=${signature}`
}
export async function pedirR2(
  method: string,
  key: string,
  query: Record<string, string> = {},
  body: string | Uint8Array<ArrayBuffer> = '',
  contentType?: string,
  condicion?: { 'If-Match': string } | { 'If-None-Match': '*' },
  opciones?: { sinCompresion?: boolean; timeoutMs?: number; metadatos?: Record<string, string>; rango?: { inicio: number; fin: number } },
) {
  const c = config(key),
    qs = queryString(query),
    payload = hash(body)
  const condicionales = condicion
    ? Object.fromEntries(Object.entries(condicion).map(([k, v]) => [k.toLowerCase(), v]))
    : {}
  const metadatos: Record<string, string> = {}
  const rango: Record<string, string> = {}
  if (opciones?.rango) {
    const { inicio, fin } = opciones.rango
    if (method !== 'GET' || !Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin) || inicio < 0 || fin < inicio || fin - inicio >= 1024 * 1024) throw new Error('Rango de archivo no válido.')
    rango.range = `bytes=${inicio}-${fin}`
  }
  for (const [nombre, valor] of Object.entries(opciones?.metadatos ?? {})) {
    if (!/^[a-z0-9-]{1,40}$/.test(nombre) || !/^[\x20-\x7e]{1,256}$/.test(valor)) throw new Error('Metadatos de archivo no válidos.')
    metadatos[`x-amz-meta-${nombre}`] = valor
  }
  const paraFirmar: Record<string, string> = { ...condicionales, ...metadatos, ...rango, host: c.host, 'x-amz-content-sha256': payload, 'x-amz-date': c.date }
  const nombres = Object.keys(paraFirmar).sort()
  const signedHeaders = nombres.join(';')
  const headers = nombres.map(k => `${k}:${paraFirmar[k]}\n`).join('')
  const canonical = [method, c.uri, qs, headers, signedHeaders, payload].join(
    '\n',
  )
  const signature = createHmac('sha256', c.signing)
    .update(['AWS4-HMAC-SHA256', c.date, c.scope, hash(canonical)].join('\n'))
    .digest('hex')
  return fetch(`https://${c.host}${c.uri}${qs ? '?' + qs : ''}`, {
    method,
    headers: {
      ...condicionales,
      ...metadatos,
      ...rango,
      ...(opciones?.sinCompresion ? { 'Accept-Encoding': 'identity' } : {}),
      'x-amz-date': c.date,
      'x-amz-content-sha256': payload,
      Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.R2_ACCESS_KEY_ID}/${c.scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    ...(body.length ? { body } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(opciones?.timeoutMs ?? 25_000),
  })
}
export const xmlEscape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  )
export const xmlValue = (xml: string, tag: string) =>
  (xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
export function leerPartes(xml: string) {
  return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)]
    .map((m) => ({
      number: Number(xmlValue(m[1], 'PartNumber')),
      size: Number(xmlValue(m[1], 'Size')),
      etag: xmlValue(m[1], 'ETag'),
    }))
    .sort((a, b) => a.number - b.number)
}
export function partesCompletas(
  parts: ReturnType<typeof leerPartes>,
  bytes: number,
) {
  return (
    parts.length === Math.ceil(bytes / TAMANO_PARTE) &&
    parts.every(
      (p, i) =>
        p.number === i + 1 &&
        p.size === Math.min(TAMANO_PARTE, bytes - i * TAMANO_PARTE) &&
        /^"?[0-9a-f-]+"?$/i.test(p.etag),
    )
  )
}
export interface CargaVideo {
  userId: string
  claseId: string
  key: string
  uploadId: string
  bytes: number
  anterior: string | null
  exp: number
}
export function tokenCarga(state: CargaVideo) {
  const data = Buffer.from(JSON.stringify(state)).toString('base64url')
  return `${data}.${createHmac('sha256', process.env.R2_SECRET_ACCESS_KEY!)
    .update('sd-upload-v1:' + data)
    .digest('base64url')}`
}
export function leerTokenCarga(
  token: unknown,
  userId: string,
): CargaVideo | null {
  if (
    typeof token !== 'string' ||
    token.length > 6000 ||
    !process.env.R2_SECRET_ACCESS_KEY
  )
    return null
  const [data, sig, ...rest] = token.split('.')
  if (!data || !sig || rest.length) return null
  const expected = createHmac('sha256', process.env.R2_SECRET_ACCESS_KEY)
    .update('sd-upload-v1:' + data)
    .digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null
  try {
    const s = JSON.parse(
      Buffer.from(data, 'base64url').toString(),
    ) as CargaVideo
    if (
      s.userId !== userId ||
      !esUuid(s.claseId) ||
      !Number.isSafeInteger(s.bytes) ||
      s.bytes <= 0 ||
      s.bytes > MAX_VIDEO_BYTES ||
      s.exp < Date.now() ||
      !s.uploadId ||
      typeof s.uploadId !== 'string' ||
      !s.key.startsWith(`clases/${s.claseId}/`) ||
      !/^clases\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/.test(s.key)
    )
      return null
    return s
  } catch {
    return null
  }
}
