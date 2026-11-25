/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic sessions and transport; never creates accounts, sends email, or writes to production.
const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(n => Object.hasOwn(mocks,n) ? mocks[n] : require(n),mod,mod.exports)
  return mod.exports
}
const id = '00000000-0000-4000-8000-000000000001'
const own = { id: '00000000-0000-4000-8000-000000000002' }
const json = (data, options={}) => new Response(JSON.stringify(data), options)
test('new Farmasi signup records the authenticated account as pending, never assigns general or Farmasi access', async () => {
  const result = await signup({ flujo:'farmasi', tipo_usuario:'desafio' })
  assert.equal(result.response.status,200)
  assert.deepEqual(result.calls.find(x=>x[0]==='farmasi'), ['farmasi', {p_usuaria_id:id}])
  assert.equal(result.calls.find(x=>x[0]==='link')[1].options.data.tipo_usuario,'gratuito')
  assert.match(result.mail.html, /flow=farmasi/)
  assert.match(result.mail.subject, /Farmasi/)
  assert.ok(!result.calls.some(x=>x[0]==='write-profile'))
})
test('duplicate confirmed email does not create, grant, send or tag an existing account', async () => {
  const result = await signup({ flujo:'farmasi' }, {exists:true,confirmed:true})
  assert.equal(result.response.status,200)
  assert.deepEqual(result.calls.map(x=>x[0]), ['reserve'])
  assert.equal(result.mail,undefined)
})
test('existing unconfirmed resend never tags an identity solely from an email; confirmation carries intent', async () => {
  const result = await signup({ flujo:'farmasi', resend:true }, {exists:true,confirmed:false})
  assert.equal(result.response.status,200)
  assert.ok(!result.calls.some(x=>x[0]==='farmasi'))
  assert.equal(result.calls.find(x=>x[0]==='link')[1].type,'magiclink')
  assert.match(result.mail.html,/flow=farmasi/)
})
test('general and Desafío registration neither records Farmasi request nor alters normal base plan', async () => {
  for (const tipo_usuario of ['gratuito','desafio']) {
    const result = await signup({tipo_usuario})
    assert.equal(result.response.status,200)
    assert.equal(result.calls.find(x=>x[0]==='link')[1].options.data.tipo_usuario,tipo_usuario)
    assert.ok(!result.calls.some(x=>x[0]==='farmasi'))
    assert.doesNotMatch(result.mail.html,/flow=farmasi/)
  }
})
test('temporary request failure preserves verification email and existing authenticated retry path', async () => {
  const result=await signup({flujo:'farmasi'},undefined,true)
  assert.equal(result.response.status,200)
  assert.match(result.mail.html,/flow=farmasi/)
})
async function signup(input, reservation = {exists:false,confirmed:false}, errorPendiente=false) {
  const calls=[]; let mail
  const admin = {
    rpc: async (name, args) => {
      if (name==='reserve_registration_mail') {calls.push(['reserve']);return {data:{...reservation,allowed:true},error:null}}
      assert.equal(name,'solicitar_socias_farmasi');calls.push(['farmasi',args])
      return errorPendiente ? {data:null,error:{code:'fixture'}} : {data:'pendiente',error:null}
    },
    auth: { admin: { generateLink: async args => {calls.push(['link',args]); return {data:{user:{id,user_metadata:args.options.data??{}},properties:{hashed_token:'fake-otp'}},error:null}} } },
    from: table => ({insert: async () => {assert.equal(table,'preferencias_email');calls.push(['consent']);return {error:null}}})
  }
  const oldEnv={...process.env}
  process.env.RESEND_API_KEY='test-only';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.NEXT_PUBLIC_SITE_URL='https://example.invalid'
  try {
    const route=load('src/app/api/registro/route.ts',{
      'next/server':{NextResponse:{json}},
      '@/lib/supabase/admin':{createAdminClient:()=>admin,isAdminSupabaseConfigured:()=>true},
      '@/lib/registration-mail':{enviarConfirmacion:async value=>{mail=value;calls.push(['mail']);return {ok:true,messageId:'fixture',attempts:1}}},
      '@/lib/email-brand':{EMAIL_HEADER:''},'@/lib/farmasi-registration':{FLUJO_FARMASI:'farmasi'},
      '@/lib/perfil-preguntas':{normalizarNombre:x=>String(x)}
    })
    const response=await route.POST(new Request('https://example.invalid/api/registro',{method:'POST',headers:{origin:'https://example.invalid'},body:JSON.stringify({email:'test@example.invalid',nombre:'Prueba',password:'fixture-only',...input})}))
    return {response,calls,mail}
  } finally {
    for(const name of ['RESEND_API_KEY','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL']) { if (oldEnv[name]===undefined) delete process.env[name]; else process.env[name]=oldEnv[name] }
  }
}
function approval({confirmed=true, enabled=false, adminError=false, identityError=false, estado='activa'}={}) {
  const writes=[]
  let query = {
    select(){return this},eq(){return this},or(){return this},
    maybeSingle:async()=>({data:{id,rol:'alumna',estado,socias_farmaci_habilitada:enabled,socias_farmaci_habilitada_por:own.id},error:null}),
    update(values){writes.push(values);enabled=values.socias_farmaci_habilitada;return this}
  }
  const route=load('src/app/api/admin/farmaci/acceso/route.ts',{
    'next/server':{NextResponse:{json}},
    '@/lib/admin-auth':{autorizarAdmin:async()=>adminError?{error:json({}, {status:401})}:{user:own}},
    '@/lib/class-management':{esUuid:value=>value===id},'@/lib/supabase/admin':{
      createAdminClient:()=>({from:()=>query,auth:{admin:{getUserById:async()=>({data:{user:{id,email:'test@example.invalid',email_confirmed_at:confirmed?'2026-11-25T12:00:00Z':null,is_anonymous:false}},error:identityError?{}:null})}}})
    }
  })
  return {writes,get:()=>route.GET(new Request('https://example.invalid/api/admin/farmaci/acceso?perfilId='+id)),post:habilitada=>route.POST(new Request('https://example.invalid/api/admin/farmaci/acceso',{method:'POST',body:JSON.stringify({perfilId:id,habilitada})}))}
}
test('admin cannot accept Farmasi until the identity is email-confirmed and active',async()=>{
  for(const setup of [{confirmed:false},{estado:'pausada'},{identityError:true},{adminError:true}]){
    const t=approval(setup), r=await t.post(true)
    assert.ok([401,409,503].includes(r.status))
    assert.deepEqual(t.writes,[])
    if(!setup.identityError&&!setup.adminError) assert.equal((await(await t.get()).json()).elegible,false)
  }
})
test('explicit approval grants strictly Farmasi and never modifies the base plan',async()=>{
  const t=approval()
  assert.equal((await t.post(true)).status,200)
  assert.deepEqual(Object.keys(t.writes[0]).sort(),['socias_farmaci_habilitada','socias_farmaci_habilitada_at','socias_farmaci_habilitada_por'])
  assert.equal(t.writes[0].socias_farmaci_habilitada,true)
})
test('revocation remains possible even if an existing account cannot verify email',async()=>{
  const t=approval({enabled:true,confirmed:false})
  assert.equal((await t.post(false)).status,200)
  assert.equal(t.writes[0].socias_farmaci_habilitada,false)
})
