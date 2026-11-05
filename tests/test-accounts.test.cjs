const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const read=file=>fs.readFileSync(path.join(root,file),'utf8')
test('listas y consultas globales excluyen pruebas antes de limitar, contar o serializar',()=>{
  const contratos={
    'src/app/admin/page.tsx':['id','alumna_id','afiliada_id'],
    'src/app/admin/resultados/page.tsx':['id','alumna_id'],
    'src/app/admin/metricas/page.tsx':['id','alumna_id'],
    'src/app/admin/checklist/page.tsx':['id','esCuentaPrueba(r.alumna_id)'],
    'src/app/admin/lanzamiento/historico/page.tsx':['id','alumna_id'],
    'src/app/admin/desafio/page.tsx':['id'],
    'src/app/admin/classroom/page.tsx':['id'],
    'src/app/admin/comunidad/page.tsx':['alumna_id','autor_id'],
    'src/app/ranking/page.tsx':['id','afiliada_id'],
    'src/app/api/exportar-alumnas/route.ts':['id'],
  }
  for(const [file,fields] of Object.entries(contratos)){
    const s=read(file)
    assert.ok(s.includes('@/lib/test-accounts'),file)
    for(const field of fields) assert.ok(s.includes(field),`${file}: ${field}`)
    assert.ok(s.includes('FILTRO_CUENTAS_PRUEBA'),file)
  }
  const metrics=read('src/app/admin/metricas/page.tsx')
  assert.ok(read('src/app/admin/lanzamiento/page.tsx').includes('leerSeguimientoFormacion(auth)'))
  const formacion=read('src/lib/admin-learning-progress-server.ts')
  assert.ok(formacion.includes(".not('id', 'in', FILTRO_CUENTAS_PRUEBA)"))
  assert.ok(formacion.includes(".not('alumna_id', 'in', FILTRO_CUENTAS_PRUEBA)"))
  assert.ok(metrics.indexOf(".not('alumna_id'")<metrics.indexOf('.limit(1000)'))
  const inicio=read('src/app/admin/page.tsx')
  assert.ok(inicio.includes('alumna_id.is.null,alumna_id.not.in.'))
  const comunidad=read('supabase/migrations/20261026173046_comunidad_voluntaria_y_moderacion_segura.sql')
  assert.ok(comunidad.includes(read('src/lib/test-accounts.ts').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)[0]))
  assert.ok(comunidad.includes('private.comunidad_prueba_visible(alumna_id)'))
  assert.ok(comunidad.includes('private.comunidad_prueba_visible(autor_id)'))
  assert.ok(read('src/app/comunidad/page.tsx').includes('autorizarComunidad'))
  assert.ok(read('src/app/comunidad/page.tsx').includes('leerComunidad'))
})
test('datos propios de la prueba siguen editables; no se borran respuestas, accesos ni se cambia el rol',()=>{
  for(const file of ['src/app/metricas/page.tsx','src/app/resultados/page.tsx','src/app/checklist/page.tsx','src/app/perfil/page.tsx','src/app/lanzamiento/page.tsx']){
    assert.ok(!read(file).includes('FILTRO_CUENTAS_PRUEBA'),file)
  }
  assert.ok(!/\.email\b|\.nombre\b/.test(read('src/lib/test-accounts.ts')))
  assert.ok(!/\.(update|delete|insert|upsert)\(/.test(read('src/lib/test-accounts.ts')))
})
