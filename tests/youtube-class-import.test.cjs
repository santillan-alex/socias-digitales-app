/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const root = path.join(__dirname, '..')
const modulePromise = import(pathToFileURL(path.join(root, 'scripts/descargar-y-subir-clase.mjs')).href)
const ID = 'AbCdEfG_123'
const TOKEN = 'sdc_11111111-1111-4111-8111-111111111111_' + 'a'.repeat(43)
const metadata = () => ({ id: ID, _type: 'video', extractor_key: 'Youtube', live_status: 'was_live', is_live: false,
  availability: 'unlisted', duration: 120, title: 'Clase de prueba', description: 'Descripción de prueba' })
async function fixture() {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'socias-youtube-test-'))
  const calls = [], uploads = []
  let info = metadata(), failDownload = false, failUpload = false, ffmpeg = true, codec = 'h264'
  const directory = path.join(folder, `youtube-${ID}`)
  const runTool = async (command, args, options) => {
    calls.push({ command, args, options })
    assert.equal(options.shell, false)
    assert.equal('SOCIAS_IMPORT_TOKEN' in options.env, false)
    assert.equal('SUPABASE_SERVICE_ROLE_KEY' in options.env, false)
    assert.equal(JSON.stringify(args).includes(TOKEN), false)
    if (command === 'ffmpeg' && !ffmpeg) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    if (args.includes('-version')) return { stdout: 'fixture version' }
    if (command === 'ffprobe') return { stdout: JSON.stringify({ streams: [{ codec_type: 'video', codec_name: codec }, { codec_type: 'audio', codec_name: 'aac' }], format: { duration: '120' } }) }
    assert.equal(command, 'yt-dlp')
    if (args.includes('--skip-download')) return { stdout: JSON.stringify(info) }
    await fs.writeFile(path.join(directory, 'video.info.json'), JSON.stringify(info))
    if (failDownload) { await fs.writeFile(path.join(directory, 'video.mp4.part'), 'partial'); throw new Error('download failed https://signed.invalid') }
    const video = Buffer.alloc(100); video.write('ftyp', 4)
    await fs.writeFile(path.join(directory, 'video.mp4'), video)
    return { stdout: '' }
  }
  const upload = async input => {
    uploads.push(input)
    if (failUpload) throw new Error('La app no respondió; reintentá el mismo archivo.')
    return { claseId: '22222222-2222-4222-8222-222222222222', estado: 'lista' }
  }
  return { folder, directory, calls, uploads, runTool, upload, input: { url: `https://youtube.com/live/${ID}`, folder, order: 3, token: TOKEN },
    setInfo: value => { info = value }, setDownloadFailure: value => { failDownload = value }, setUploadFailure: value => { failUpload = value }, setFfmpeg: value => { ffmpeg = value }, setCodec: value => { codec = value } }
}

test('solo admite un ID de video YouTube y normaliza enlaces, sin canales, listas o URLs arbitrarias', async () => {
  const { videoYoutube } = await modulePromise
  for (const url of [`https://youtube.com/watch?v=${ID}`, `https://www.youtube.com/live/${ID}`, `https://youtu.be/${ID}?t=30`]) {
    assert.deepEqual(videoYoutube(url), { id: ID, url: `https://www.youtube.com/watch?v=${ID}`, fuenteId: `youtube:${ID}` })
  }
  for (const url of ['https://youtube.com/@flor/videos', 'https://youtube.com/playlist?list=x', `https://youtube.com/watch?v=${ID}&list=x`,
    `http://youtube.com/watch?v=${ID}`, `https://youtube.com.evil.test/watch?v=${ID}`, `https://user:secret@youtube.com/watch?v=${ID}`, 'file:///video.mp4', '$(touch archivo)', `https://youtube.com/watch?v=${ID}&v=${ID}`])
    assert.throws(() => videoYoutube(url), /único video/)
})

test('argumentos no aceptan comandos, cookies, claves, playlists ni opciones repetidas', async () => {
  const { argumentosDescarga } = await modulePromise
  const base = ['--url', `https://youtu.be/${ID}`, '--folder', '/tmp/Socias Digitales', '--order', '3']
  assert.equal(argumentosDescarga([...base, '--title', 'Clase 3', '--dry-run']).dryRun, true)
  for (const extra of [['--cookies', '/tmp/cookies'], ['--token', TOKEN], ['--exec', 'touch /tmp/xx'], ['--url', 'otra'], ['--dry-run', '--dry-run']])
    assert.throws(() => argumentosDescarga([...base, ...extra]), /argumentos/)
  assert.throws(() => argumentosDescarga(base.slice(0, -1).concat('NaN')), /order/)
  assert.deepEqual(argumentosDescarga(['--help']), { help: true })
})

test('dry-run valida sin credencial, herramientas, creación de carpetas ni subidas', async () => {
  const { descargarYSubirClase } = await modulePromise
  const f = await fixture(), target = path.join(f.folder, 'aun-no-existe')
  try {
    const result = await descargarYSubirClase({ ...f.input, folder: target, token: undefined, dryRun: true }, { runTool: f.runTool, upload: f.upload })
    assert.equal(result.dryRun, true); assert.equal(f.calls.length, 0); assert.equal(f.uploads.length, 0)
    await assert.rejects(fs.lstat(target), { code: 'ENOENT' })
  } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
})

test('en vivo, programado, VOD en proceso, DRM y contenido privado no se descargan ni suben', async () => {
  const { descargarYSubirClase } = await modulePromise
  for (const patch of [{ live_status: 'is_live' }, { live_status: 'is_upcoming' }, { live_status: 'post_live' }, { live_status: undefined },
    { has_drm: true }, { availability: 'private' }, { _type: 'playlist', entries: [] }, { id: 'otro-id' }]) {
    const f = await fixture()
    try {
      f.setInfo({ ...metadata(), ...patch })
      await assert.rejects(descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload }), /grabación no está lista/)
      assert.equal(f.calls.filter(c => c.command === 'yt-dlp' && !c.args.includes('--skip-download')).length, 0)
      assert.equal(f.uploads.length, 0)
      await assert.rejects(fs.lstat(path.join(f.directory, '.carga-en-curso')), { code: 'ENOENT' })
    } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
  }
})

test('descarga finalizada pide MP4 H264/AAC, conserva info y ficha estable y solo llama al importador', async () => {
  const { descargarYSubirClase } = await modulePromise
  const f = await fixture()
  try {
    const result = await descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload })
    assert.equal(result.estado, 'lista'); assert.equal(f.uploads.length, 1)
    const invocation = f.calls.find(c => c.command === 'yt-dlp' && !c.args.includes('--skip-download'))
    for (const option of ['--ignore-config', '--no-plugin-dirs', '--no-remote-components', '--no-js-runtimes', '--js-runtimes', '--no-playlist', '--no-cookies', '--no-cookies-from-browser', '--part', '--no-overwrites', '--write-info-json']) assert.ok(invocation.args.includes(option))
    assert.match(invocation.args[invocation.args.indexOf('--format') + 1], /vcodec\^=avc1/)
    assert.match(invocation.args[invocation.args.indexOf('--format') + 1], /acodec\^=mp4a/)
    const probe = f.calls.find(c => c.command === 'ffprobe' && !c.args.includes('-version'))
    assert.equal(probe.args[probe.args.indexOf('-protocol_whitelist') + 1], 'file,pipe')
    const manifest = JSON.parse(await fs.readFile(path.join(f.directory, 'clase.manifest.json')))
    assert.deepEqual(manifest, { fuenteId: `youtube:${ID}`, titulo: 'Clase de prueba', descripcion: 'Descripción de prueba', orden: 3 })
    assert.equal(f.uploads[0].archivo, path.join(f.directory, 'video.mp4'))
    assert.equal(f.uploads[0].token, TOKEN); assert.equal('activo' in manifest, false)
    assert.equal((await fs.stat(path.join(f.directory, 'video.mp4'))).size, 100)
  } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
})

test('sin ffmpeg usa formato combinado; un codec o duración incompatible impide subir', async () => {
  const { descargarYSubirClase } = await modulePromise
  for (const invalid of [false, true]) {
    const f = await fixture()
    try {
      f.setFfmpeg(false); if (invalid) f.setCodec('vp9')
      const action = descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload })
      if (invalid) { await assert.rejects(action, /formato o la duración/); assert.equal(f.uploads.length, 0) }
      else { await action; assert.equal(f.uploads.length, 1) }
      const call = f.calls.find(c => c.command === 'yt-dlp' && !c.args.includes('--skip-download'))
      assert.ok(!call.args[call.args.indexOf('--format') + 1].includes('+'))
    } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
  }
})

test('una descarga fallida conserva el parcial y nunca prepara ni sube una clase', async () => {
  const { descargarYSubirClase } = await modulePromise
  const f = await fixture()
  try {
    f.setDownloadFailure(true)
    await assert.rejects(descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload }), /no se subió/)
    assert.equal(await fs.readFile(path.join(f.directory, 'video.mp4.part'), 'utf8'), 'partial')
    assert.equal(f.uploads.length, 0)
    await assert.rejects(fs.lstat(path.join(f.directory, 'clase.manifest.json')), { code: 'ENOENT' })
  } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
})

test('reintentar una subida fallida conserva la ficha original sin volver a descargar ni duplicar origen', async () => {
  const { descargarYSubirClase } = await modulePromise
  const f = await fixture()
  try {
    f.setUploadFailure(true)
    await assert.rejects(descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload }), /app no respondió/)
    const calls = f.calls.length, first = { ...f.uploads[0].manifest }
    f.setUploadFailure(false); f.setInfo({ ...metadata(), title: 'Título cambiado en YouTube' })
    await descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload })
    assert.equal(f.calls.length, calls); assert.deepEqual(f.uploads[1].manifest, first)
    assert.equal(f.uploads[1].archivo, f.uploads[0].archivo)
    await assert.rejects(descargarYSubirClase({ ...f.input, order: 4 }, { runTool: f.runTool, upload: f.upload }), /misma ficha|mismos datos/)
    assert.equal(f.uploads.length, 2)
  } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
})

test('archivo modificado, proceso paralelo o archivos sin recibo no se reemplazan ni suben', async () => {
  const { descargarYSubirClase } = await modulePromise
  const f = await fixture()
  try {
    await descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload })
    const video = await fs.readFile(path.join(f.directory, 'video.mp4')); video[20] = 99
    await fs.writeFile(path.join(f.directory, 'video.mp4'), video)
    await assert.rejects(descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload }), /archivo cambió/)
    assert.equal(f.uploads.length, 1)
    await fs.writeFile(path.join(f.directory, '.carga-en-curso'), 'fixture')
    await assert.rejects(descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload }), /otro proceso/)
    await fs.unlink(path.join(f.directory, '.carga-en-curso'))
    await fs.unlink(path.join(f.directory, 'descarga.completa.json'))
    await assert.rejects(descargarYSubirClase(f.input, { runTool: f.runTool, upload: f.upload }), /sin confirmación/)
    assert.equal(f.uploads.length, 1)
  } finally { await fs.rm(f.folder, { recursive: true, force: true }) }
})
