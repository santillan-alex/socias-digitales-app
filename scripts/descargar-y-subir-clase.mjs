import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { importarClase, prepararArchivoClase } from './importar-clase.mjs'

const execFileAsync = promisify(execFile)
const MAX_BYTES = 8 * 1024 * 1024 * 1024
const MAX_INFO_BYTES = 8 * 1024 * 1024
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const BASE_ARGS = ['--ignore-config', '--no-plugin-dirs', '--no-remote-components', '--no-js-runtimes', '--js-runtimes', `node:${process.execPath}`, '--no-playlist', '--no-wait-for-video', '--no-cache-dir', '--no-cookies', '--no-cookies-from-browser', '--no-write-comments', '--no-progress', '--no-warnings']
const FORMATO_MP4 = 'b[ext=mp4][vcodec^=avc1][acodec^=mp4a][height<=1080]'
const FORMATO_CON_MERGE = `bv[ext=mp4][vcodec^=avc1][height<=1080]+ba[ext=m4a][acodec^=mp4a]/${FORMATO_MP4}`
const mensajeFuente = 'Usá el enlace de un único video de YouTube de Flor, ya finalizado y disponible. No se aceptan canales, listas ni transmisiones en curso.'

export function videoYoutube(value) {
  let url
  try { url = new URL(value) } catch { throw new Error(mensajeFuente) }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.searchParams.has('list') || url.searchParams.has('index')) throw new Error(mensajeFuente)
  let id
  if (url.hostname === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname)) id = url.pathname.split('/')[1]
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) id = url.searchParams.get('v')
    else if (/^\/live\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname)) id = url.pathname.split('/')[2]
  }
  if (!VIDEO_ID.test(id ?? '')) throw new Error(mensajeFuente)
  return { id, url: `https://www.youtube.com/watch?v=${id}`, fuenteId: `youtube:${id}` }
}

export function validarGrabacionYoutube(info, id) {
  if (!info || typeof info !== 'object' || Array.isArray(info) || info.id !== id ||
      (info._type && info._type !== 'video') || info.entries ||
      !['Youtube', 'youtube'].includes(info.extractor_key ?? info.extractor) ||
      !['not_live', 'was_live'].includes(info.live_status) || info.is_live === true || info.has_drm === true ||
      !['public', 'unlisted'].includes(info.availability) || !Number.isFinite(info.duration) || info.duration <= 0)
    throw new Error('La grabación no está lista o requiere un acceso no compatible. Esperá a que YouTube termine de procesarla; este conector no utiliza cookies ni evita restricciones.')
  return info
}

function texto(valor, maximo) {
  return String(valor ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maximo).replace(/[\uD800-\uDBFF]$/, '')
}
function tituloClase(valor) { return texto(valor, 180).replace(/\s+/g, ' ') }
function opciones(input) {
  if (!input || typeof input.folder !== 'string' || !input.folder.trim() || /[\u0000-\u001f\u007f]/.test(input.folder) ||
      !Number.isInteger(input.order) || input.order < 0 || input.order > 9999 ||
      (input.title !== undefined && (typeof input.title !== 'string' || !tituloClase(input.title))))
    throw new Error('Indicá --folder y un --order entre 0 y 9999; --title es opcional.')
  const fuente = videoYoutube(input.url)
  return { ...input, fuente, directorio: join(resolve(input.folder), `youtube-${fuente.id}`) }
}
function entornoHerramienta() {
  // External tools do not receive the app credential, server keys or NODE_OPTIONS.
  return Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SYSTEMROOT', 'WINDIR']
    .flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]]))
}
async function ejecutarHerramienta(command, args, options) {
  return execFileAsync(command, args, { shell: false, windowsHide: true, encoding: 'utf8', maxBuffer: MAX_INFO_BYTES, ...options })
}
async function existe(path) {
  try { return await lstat(path) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
async function leerJson(path, maximo = MAX_INFO_BYTES) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximo) throw new Error('Los datos locales de esta grabación necesitan revisión.')
  try { return JSON.parse(await readFile(path, 'utf8')) } catch { throw new Error('Los datos locales de esta grabación no son válidos.') }
}
async function guardarNuevo(path, value) { await writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }) }
function parseJson(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_INFO_BYTES) throw new Error('YouTube devolvió datos que requieren revisión.')
  try { return JSON.parse(raw) } catch { throw new Error('No pudimos comprobar los datos de la grabación.') }
}

export async function descargarYSubirClase(input, { runTool = ejecutarHerramienta, upload = importarClase, onProgress = () => {} } = {}) {
  const config = opciones(input)
  if (config.dryRun) return { dryRun: true, fuenteId: config.fuente.fuenteId, directorio: config.directorio }
  if (typeof input.token !== 'string' || !/^sdc_[0-9a-f-]{36}_[A-Za-z0-9_-]{43}$/.test(input.token)) throw new Error('Falta SOCIAS_IMPORT_TOKEN en la configuración privada de la automatización.')
  await mkdir(config.directorio, { recursive: true, mode: 0o700 })
  if ((await lstat(config.directorio)).isSymbolicLink()) throw new Error('La carpeta de la grabación debe ser una carpeta local propia.')
  const lock = join(config.directorio, '.carga-en-curso')
  try { await writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 }) }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Esta grabación tiene otro proceso iniciado. Si se interrumpió, comprobá que terminó antes de retirar .carga-en-curso y repetir el mismo comando.')
    throw error
  }
  const archivo = join(config.directorio, 'video.mp4'), infoPath = join(config.directorio, 'video.info.json')
  const manifestPath = join(config.directorio, 'clase.manifest.json'), reciboPath = join(config.directorio, 'descarga.completa.json')
  const env = entornoHerramienta()
  async function tool(command, args, timeout = 90_000) {
    try { return await runTool(command, args, { env, timeout, shell: false, maxBuffer: MAX_INFO_BYTES }) }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Falta ${command}. Instalá la herramienta oficial antes de continuar.`)
      throw new Error(command === 'yt-dlp' ? 'No se pudo terminar la descarga. Los archivos se conservan para revisar o reintentar; no se subió esta grabación.' : 'No pudimos comprobar el video con FFmpeg. Los archivos se conservan sin subir.')
    }
  }
  try {
    let manifest, recibo
    if (await existe(reciboPath)) {
      recibo = await leerJson(reciboPath, 16_000)
      manifest = await leerJson(manifestPath, 16_000)
      if (recibo.version !== 1 || recibo.fuenteId !== config.fuente.fuenteId || manifest.fuenteId !== config.fuente.fuenteId ||
          manifest.orden !== config.order || (config.title !== undefined && tituloClase(config.title) !== manifest.titulo))
        throw new Error('Esta grabación ya tiene una ficha preparada. Repetí sus mismos datos; los cambios posteriores se hacen en el panel de Flor.')
      validarGrabacionYoutube(await leerJson(infoPath), config.fuente.id)
    } else {
      if (await existe(archivo) || await existe(manifestPath)) throw new Error('Ya hay archivos terminados sin confirmación en esta carpeta. Revisalos antes de repetir; no se van a reemplazar.')
      await tool('ffprobe', ['-version'], 15_000)
      const metadata = validarGrabacionYoutube(parseJson((await tool('yt-dlp', [...BASE_ARGS, '--skip-download', '--dump-single-json', '--', config.fuente.url])).stdout), config.fuente.id)
      let merge = true
      try { await runTool('ffmpeg', ['-version'], { env, timeout: 15_000, shell: false, maxBuffer: MAX_INFO_BYTES }) } catch { merge = false }
      const args = [...BASE_ARGS, '--format', merge ? FORMATO_CON_MERGE : FORMATO_MP4, '--merge-output-format', 'mp4', '--max-filesize', String(MAX_BYTES),
        '--continue', '--part', '--no-overwrites', '--write-info-json', '--no-write-playlist-metafiles', '--output', join(config.directorio.replaceAll('%', '%%'), 'video.%(ext)s'), '--', config.fuente.url]
      await tool('yt-dlp', args, 3 * 60 * 60_000)
      const descargada = validarGrabacionYoutube(await leerJson(infoPath), config.fuente.id)
      const stat = await existe(archivo)
      if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 12 || stat.size > MAX_BYTES || await existe(archivo + '.part'))
        throw new Error('La descarga no dejó un MP4 completo de hasta 8 GiB. Los archivos se conservaron sin subir.')
      const probe = parseJson((await tool('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'stream=codec_type,codec_name:format=duration', '-of', 'json', archivo])).stdout)
      const duracion = Number(probe.format?.duration)
      if (!Array.isArray(probe.streams) || !probe.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264') ||
          !probe.streams.some(s => s.codec_type === 'audio' && s.codec_name === 'aac') || !Number.isFinite(duracion) || duracion <= 0 ||
          Math.abs(duracion - descargada.duration) > Math.max(5, descargada.duration * 0.02))
        throw new Error('El video no tiene el formato o la duración esperados. Conservamos la descarga; hace falta revisarla antes de subir.')
      manifest = { fuenteId: config.fuente.fuenteId, titulo: tituloClase(config.title ?? descargada.title ?? metadata.title),
        descripcion: texto(descargada.description ?? metadata.description, 3000), orden: config.order }
      if (!manifest.titulo) throw new Error('La grabación necesita un título. Repetí con --title.')
      const preparado = await prepararArchivoClase(archivo, manifest)
      recibo = { version: 1, fuenteId: config.fuente.fuenteId, bytes: preparado.payload.bytes, sha256: preparado.payload.sha256 }
      await guardarNuevo(manifestPath, manifest)
      await guardarNuevo(reciboPath, recibo)
    }
    const preparado = await prepararArchivoClase(archivo, manifest)
    if (recibo.bytes !== preparado.payload.bytes || recibo.sha256 !== preparado.payload.sha256)
      throw new Error('El archivo cambió después de la descarga. Se conserva la ficha y no se sube una versión distinta.')
    return await upload({ archivo, manifest, token: input.token, appUrl: input.appUrl ?? 'https://app.sociasdigitales.com', onProgress })
  } finally { await unlink(lock) }
}

export function argumentosDescarga(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const values = {}, permitidos = new Set(['--url', '--folder', '--order', '--title'])
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run' && !values.dryRun) { values.dryRun = true; continue }
    if (!permitidos.has(arg) || Object.hasOwn(values, arg.slice(2)) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Revisá los argumentos. Usá --help.')
    values[arg.slice(2)] = args[++i]
  }
  if (typeof values.order !== 'string' || !/^\d{1,4}$/.test(values.order)) throw new Error('Indicá --order entre 0 y 9999.')
  return opciones({ ...values, order: Number(values.order) })
}
async function main() {
  const config = argumentosDescarga(process.argv.slice(2))
  if (config.help) {
    console.log('Uso: node scripts/descargar-y-subir-clase.mjs --url <video de YouTube> --folder <carpeta Socias Digitales> --order <número> [--title <título>] [--dry-run]\nRequiere yt-dlp actualizado y ffprobe (FFmpeg). Solo grabaciones públicas/no listadas, terminadas, MP4 H.264/AAC de hasta 8 GiB.\nLa clave vive en SOCIAS_IMPORT_TOKEN; el dominio opcional en SOCIAS_APP_URL. Nunca se pasan claves como argumentos.\nConserva el video y una ficha estable por ID de YouTube. La clase llega como borrador para revisar y publicar. No vigila canales ni programa tareas.\n--dry-run valida los argumentos sin ejecutar herramientas, descargar, crear carpetas ni subir contenido.')
    return
  }
  const result = await descargarYSubirClase({ ...config, token: process.env.SOCIAS_IMPORT_TOKEN, appUrl: process.env.SOCIAS_APP_URL },
    { onProgress: percent => console.log(`Carga: ${percent}%.`) })
  console.log(result.dryRun ? 'Datos verificados. No se descargó ni subió ningún video.' : `Video recibido por la app. Revisá y publicá el borrador ${result.claseId} desde el panel de Flor.`)
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error && !error.message.includes('http') && !error.message.includes('sdc_') ? error.message : 'No pudimos completar la carga. Los archivos locales se conservan para revisar y reintentar.')
    process.exitCode = 1
  })
}
