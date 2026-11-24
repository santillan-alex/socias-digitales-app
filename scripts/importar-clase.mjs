import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, open, readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_BYTES = 8 * 1024 * 1024 * 1024
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
function mismaVersion(a, b) { return a.size === b.size && a.mtimeMs === b.mtimeMs && a.ino === b.ino && a.dev === b.dev }
function urlApp(value, allowLocal) {
  let url
  try { url = new URL(value) } catch { throw new Error('La dirección de la app no es válida.') }
  const local = allowLocal && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'http:'
  const produccion = ['app.sociasdigitales.com', 'flor.sociasdigitales.com'].includes(url.hostname) && url.protocol === 'https:' && !url.port
  if ((!local && !produccion) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('Usá el dominio de Socias Digitales. La prueba local requiere autorización explícita.')
  return new URL('/api/integraciones/clases', url).href
}
function urlParte(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('La dirección de carga recibida no es válida.') }
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.r2\.cloudflarestorage\.com$/.test(url.hostname) || url.username || url.password || url.port ||
      !url.searchParams.has('uploadId') || !url.searchParams.has('partNumber') || !url.searchParams.has('X-Amz-Signature'))
    throw new Error('La dirección de carga recibida no corresponde al almacenamiento privado.')
  return url.href
}
export async function prepararArchivoClase(archivo, manifest, { stableMs = 3000 } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      Object.keys(manifest).some(k => !['fuenteId', 'titulo', 'descripcion', 'orden'].includes(k)) ||
      typeof manifest.fuenteId !== 'string' || !manifest.fuenteId.trim() || manifest.fuenteId.length > 240 || /[\r\n\x00-\x1f\x7f]/.test(manifest.fuenteId) ||
      typeof manifest.titulo !== 'string' || !manifest.titulo.trim() || manifest.titulo.length > 180 ||
      (manifest.descripcion !== undefined && (typeof manifest.descripcion !== 'string' || manifest.descripcion.length > 3000)) ||
      !Number.isInteger(manifest.orden) || manifest.orden < 0 || manifest.orden > 9999)
    throw new Error('Revisá el manifiesto: fuenteId, titulo, descripcion opcional y orden.')
  let initial
  try { initial = await lstat(archivo) } catch { throw new Error('No encontramos el archivo descargado.') }
  if (!initial.isFile() || initial.isSymbolicLink() || initial.size < 12 || initial.size > MAX_BYTES || !/\.mp4$/i.test(basename(archivo)) || basename(archivo).length > 200)
    throw new Error('Elegí un archivo MP4 terminado, de hasta 8 GiB.')
  if (Date.now() - initial.mtimeMs < stableMs) {
    await wait(stableMs)
    const settled = await lstat(archivo)
    if (!mismaVersion(initial, settled)) throw new Error('El video todavía está cambiando. Esperá a que termine la descarga.')
    initial = settled
  }
  const handle = await open(archivo, 'r')
  try {
    const prefix = Buffer.alloc(12)
    await handle.read(prefix, 0, 12, 0)
    if (prefix.subarray(4, 8).toString('ascii') !== 'ftyp') throw new Error('El archivo no tiene una cabecera MP4 válida.')
  } finally { await handle.close() }
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(archivo, { highWaterMark: 1024 * 1024 })) hash.update(bytes)
  if (!mismaVersion(initial, await lstat(archivo))) throw new Error('El archivo cambió mientras se verificaba. Esperá a que termine la descarga.')
  return { archivo, version: initial, payload: { action: 'iniciar', fuenteId: manifest.fuenteId.trim(), titulo: manifest.titulo.trim(),
    descripcion: (manifest.descripcion ?? '').trim(), orden: manifest.orden, nombre: basename(archivo), bytes: initial.size, sha256: hash.digest('hex') } }
}

export async function importarClase({ archivo, manifest, token, appUrl = 'https://app.sociasdigitales.com', allowLocal = false,
  fetchImpl = fetch, stableMs = 3000, onProgress = () => {} }) {
  if (typeof token !== 'string' || !/^sdc_[0-9a-f-]{36}_[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Falta una conexión válida en SOCIAS_IMPORT_TOKEN.')
  const endpoint = urlApp(appUrl, allowLocal)
  const prepared = await prepararArchivoClase(archivo, manifest, { stableMs })
  async function api(body) {
    for (let intento = 0; intento < 3; intento++) {
      let response
      try { response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) }) }
      catch {
        if (intento === 2) throw new Error('No pudimos conectar con la app. Volvé a ejecutar el mismo archivo y manifiesto.')
        await wait(250 * (intento + 1)); continue
      }
      let data
      try { data = await response.json() } catch { throw new Error('La app devolvió una respuesta incompleta. Consultá el panel antes de reintentar.') }
      if (response.ok) return data
      if ([502, 503, 504].includes(response.status) && intento < 2) { await wait(250 * (intento + 1)); continue }
      if (response.status === 401 || response.status === 403) throw new Error('La conexión venció, fue revocada o ya no tiene permiso. Revisala con Flor.')
      if (response.status === 409) throw new Error('La clase o el archivo cambió. Revisá la importación en el panel; no se reemplazará contenido.')
      if (response.status === 429) throw new Error('La conexión alcanzó su límite. Revisala en el panel de Flor.')
      throw new Error('La app no aceptó la importación. Revisá el archivo, el manifiesto y el panel de Flor.')
    }
    throw new Error('No pudimos completar la solicitud.')
  }
  const initial = await api(prepared.payload)
  const trabajo = initial.importacion
  if (!trabajo || !/^[0-9a-f]{64}$/.test(trabajo.id) || !/^[0-9a-f-]{36}$/.test(trabajo.claseId) ||
      !Number.isSafeInteger(initial.partSize) || initial.partSize < 1024 * 1024 || initial.partSize > 32 * 1024 * 1024 || !Array.isArray(initial.partes))
    throw new Error('La app no pudo confirmar la preparación de la clase.')
  if (trabajo.estado === 'lista') { onProgress(100); return trabajo }
  const completadas = new Set(initial.partes), total = Math.ceil(prepared.payload.bytes / initial.partSize)
  const handle = await open(archivo, 'r')
  try {
    for (let numero = 1; numero <= total; numero++) {
      if (!mismaVersion(prepared.version, await lstat(archivo))) throw new Error('El archivo cambió durante la carga. Se conservó el borrador; revisá el video.')
      if (!completadas.has(numero)) {
        const start = (numero - 1) * initial.partSize
        const chunk = Buffer.alloc(Math.min(initial.partSize, prepared.payload.bytes - start))
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, start)
        if (bytesRead !== chunk.length) throw new Error('El archivo quedó incompleto. Esperá a que termine la descarga.')
        for (let intento = 0; ; intento++) {
          const data = await api({ action: 'parte', id: trabajo.id, numero })
          if (data.importacion?.estado === 'lista') { onProgress(100); return data.importacion }
          const url = urlParte(data.url)
          let response
          try { response = await fetchImpl(url, { method: 'PUT', headers: { 'Content-Length': String(chunk.length) }, body: chunk, redirect: 'error', signal: AbortSignal.timeout(120_000) }) }
          catch { /* Retry the same numbered part with a renewed signature. */ }
          if (response?.ok) break
          if (intento === 2) throw new Error('La conexión interrumpió el video. Repetí el mismo comando para continuar sin duplicar la clase.')
          await wait(250 * (intento + 1))
        }
      }
      onProgress(Math.min(99, Math.floor(Math.min(numero * initial.partSize, prepared.payload.bytes) / prepared.payload.bytes * 100)))
    }
  } finally { await handle.close() }
  if (!mismaVersion(prepared.version, await lstat(archivo))) throw new Error('El archivo cambió durante la carga. El borrador se conserva sin publicar.')
  const final = await api({ action: 'finalizar', id: trabajo.id })
  if (final.importacion?.id !== trabajo.id || final.importacion?.estado !== 'lista') throw new Error('La finalización no pudo confirmarse. Revisá el mismo borrador en el panel.')
  onProgress(100)
  return final.importacion
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Uso: node scripts/importar-clase.mjs --file <video.mp4> --manifest <clase.json> [--dry-run]\nManifiesto: fuenteId, titulo, descripcion opcional y orden.\nConexión: SOCIAS_IMPORT_TOKEN; dominio opcional: SOCIAS_APP_URL. La clave nunca se pasa como argumento.\nLa clase se guarda como borrador; Flor la publica desde su panel.')
    return
  }
  const options = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (!['--file', '--manifest', '--dry-run'].includes(key) || Object.hasOwn(options, key)) throw new Error('Revisá los argumentos. Usá --help.')
    if (key === '--dry-run') options[key] = true
    else {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error('Faltan --file y --manifest. Usá --help.')
      options[key] = value
    }
  }
  if (!options['--file'] || !options['--manifest']) throw new Error('Faltan --file y --manifest. Usá --help.')
  const raw = await readFile(options['--manifest'], 'utf8')
  if (Buffer.byteLength(raw) > 16_000) throw new Error('El manifiesto es demasiado grande.')
  let manifest
  try { manifest = JSON.parse(raw) } catch { throw new Error('El manifiesto no es un JSON válido.') }
  if (options['--dry-run']) {
    const checked = await prepararArchivoClase(options['--file'], manifest)
    console.log(`Archivo y manifiesto verificados (${checked.payload.bytes} bytes). No se realizó ninguna carga.`)
    return
  }
  let last = -1
  const result = await importarClase({ archivo: options['--file'], manifest, token: process.env.SOCIAS_IMPORT_TOKEN,
    appUrl: process.env.SOCIAS_APP_URL || 'https://app.sociasdigitales.com', allowLocal: process.env.SOCIAS_IMPORT_ALLOW_LOCAL === '1',
    onProgress: percent => { if (percent !== last) { last = percent; console.log(`Carga: ${percent}%.`) } } })
  console.log(`Video confirmado. Borrador de clase: ${result.claseId}. Revisalo y publicalo desde el panel de Flor.`)
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    // Network errors may include signed URLs; never print their raw cause or stack.
    console.error(error instanceof Error && !error.message.includes('http') && !error.message.includes('sdc_') ? error.message : 'No pudimos completar la importación. Consultá el panel antes de reintentar.')
    process.exitCode = 1
  })
}
