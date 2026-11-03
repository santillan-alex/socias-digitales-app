/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..'), cache = new Map()
function load(file, deps = {}) {
  const full = path.join(root, file)
  if (cache.has(full)) return cache.get(full)
  const m = { exports: {} }; cache.set(full, m.exports)
  const requireTest = name => {
    if (Object.hasOwn(deps, name)) return deps[name]
    if (name === 'server-only') return {}
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(full), name)
      return load(path.relative(root, fs.existsSync(target + '.ts') ? target + '.ts' : target), deps)
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(requireTest, m, m.exports)
  cache.set(full, m.exports); return m.exports
}
const d = load('src/lib/affiliate-files.ts')
const recursoId = '2d0df184-c4a0-4072-bf9e-80734b876b35', archivoId = '8d86bb87-c028-4b6c-a644-df19145bc655'
const url = `https://app.sociasdigitales.com/api/afiliadas/${recursoId}/archivo/${archivoId}`
test('Afiliadas permite los documentos existentes hasta 25 MiB y MP4 hasta 1 GiB, con metadata derivada', () => {
  const expected = {
    pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4',
  }
  for (const [extension, mime] of Object.entries(expected)) {
    const bytes = extension === 'mp4' ? 1024 ** 3 : 25 * 1024 ** 2
    const parsed = d.validarArchivoAfiliadas('Recurso.' + extension.toUpperCase(), bytes)
    assert.equal(parsed.nombre, 'Recurso.' + extension.toUpperCase()); assert.equal(parsed.bytes, bytes); assert.equal(parsed.mime, mime); assert.equal(parsed.extension, extension)
    assert.throws(() => d.validarArchivoAfiliadas('Recurso.' + extension, bytes + 1))
  }
  assert.equal(d.validarArchivoAfiliadas('Guía para vender.pdf', 100).nombre, 'Guía para vender.pdf')
  for (const [name, bytes] of [['a.pdf', 0], ['a.mp4', 0], ['a.pdf', -1], ['a.pdf', 1.5], ['a.pdf', '10'], ['a.pdf', NaN], ['a.pdf', Infinity], ['a.pdf', null], ['a.html', 10], ['a.svg', 10], ['a.js', 10], ['a.mov', 10], ['a.zip', 10], ['a.pdf.exe', 10], ['../a.pdf', 10], ['a/b.mp4', 10], ['a\\b.pdf', 10], ['a\0.pdf', 10], ['a\r\n.pdf', 10], ['', 10], [null, 10], ['a'.repeat(201) + '.mp4', 10]]) assert.throws(() => d.validarArchivoAfiliadas(name, bytes), String(name))
})
test('solo identifica referencias estables de los dos dominios autorizados con recurso y archivo exactos', () => {
  assert.deepEqual(d.analizarArchivoAfiliadasUrl(url), { recursoId, archivoId })
  assert.deepEqual(d.analizarArchivoAfiliadasUrl(url.replace('app.sociasdigitales.com', 'flor.sociasdigitales.com')), { recursoId, archivoId })
  for (const candidate of [
    null, undefined, '', 3, url.replace('https:', 'http:'), url.replace('app.sociasdigitales.com', 'example.invalid'),
    url.replace('app.sociasdigitales.com', 'app.sociasdigitales.com.example.invalid'), url.replace('app.sociasdigitales.com', 'app.sociasdigitales.com:444'),
    url.replace('https://', 'https://usuario:clave@'), url + '?download=1', url + '#archivo', url + '/',
    url.replace('/archivo/', '/archivos/'), url.replace(recursoId, 'recurso'), url.replace(archivoId, 'archivo'),
    url.replace('/api/', '/%61pi/'), url.replace('/api/', '/api/../api/'), url.replace('/api/', '//api/'),
    ' ' + url, url + '\n', `https://app.sociasdigitales.com/api/classroom/${recursoId}/materiales/${archivoId}`,
    'https://example.r2.cloudflarestorage.com/bucket/archivo?X-Amz-Signature=ficcion',
  ]) assert.equal(d.analizarArchivoAfiliadasUrl(candidate), null, String(candidate))
})
test('DTO de archivo exige metadata coherente y referencia propia, sin claves R2 ni campos inyectados', () => {
  const row = { id: archivoId, recursoId, ...d.validarArchivoAfiliadas('Guía.pdf', 100), url }
  assert.equal(d.urlArchivoAfiliadas(recursoId, archivoId), url); assert.equal(d.esArchivoAfiliadas(row), true)
  for (const changes of [{ bytes: 0 }, { bytes: '100' }, { mime: 'text/html' }, { extension: 'html' }, { nombre: ' Guía.pdf' }, { url: url.replace(recursoId, archivoId) }, { url: url + '?token=ficcion' }, { key: 'afiliadas/archivo' }, { rol: 'admin' }]) assert.equal(d.esArchivoAfiliadas({ ...row, ...changes }), false, JSON.stringify(changes))
  assert.throws(() => d.urlArchivoAfiliadas('ajeno', archivoId))
})
