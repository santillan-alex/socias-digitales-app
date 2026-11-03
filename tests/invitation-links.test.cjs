/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const read = file => fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8')

test('tres invitaciones del dominio final, con copia real y recuperación si falla', async () => {
  const changes = []
  const exports = {}
  const code = ts.transpileModule(read('src/components/InvitationLinks.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'exports', code)(name => name === 'react' ? { useState: value => [value, next => changes.push(next)] } : require(name), exports)
  assert.deepEqual(exports.invitationLinks.map(link => link.path), ['/registro', '/registro/desafio', '/registro/socias'])
  const elements = []
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || !node.props) return
    elements.push(node)
    walk(node.props.children)
  }
  walk(exports.default())
  const buttons = elements.filter(node => node.type === 'button')
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied = []
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => copied.push(text) } } })
    for (const button of buttons) await button.props.onClick()
    assert.deepEqual(copied, exports.invitationLinks.map(link => 'https://app.sociasdigitales.com' + link.path))
    globalThis.navigator.clipboard.writeText = async () => { throw new Error('denied') }
    await buttons[0].props.onClick()
    assert.match(changes.at(-1), /Seleccioná el enlace/)
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
  }
})

test('invitaciones en apartado propio y perfil admin, no ocupan la vista general', () => {
  const dashboard = read('src/app/admin/AdminDashboard.tsx')
  assert.doesNotMatch(dashboard, /<InvitationLinks \/>/)
  assert.doesNotMatch(dashboard, /Invitar al Desafío/)
  assert.doesNotMatch(dashboard, /ADMIN_SECTIONS\.map|<AdminSectionMenu|<aside/)
  assert.match(read('src/app/admin/layout.tsx'), /<AdminShellFrame datos=\{lectura\.datos\}>\{children\}/)
  assert.match(read('src/lib/admin-sections.ts'), /href: '\/admin\/invitar', label: 'Invitaciones', icon: 'invitaciones'/)
  assert.match(read('src/components/AdminSectionMenu.tsx'), /dentroDelPanel \? null/)
  assert.match(read('src/lib/admin-navigation.ts'), /'\/admin\/invitar'/)
  assert.match(read('src/app/admin/invitar/InvitarCliente.tsx'), /<InvitationLinks \/>/)
  assert.match(read('src/app/admin/invitar/InvitarCliente.tsx'), /Enviar invitaciones al Desafío por email/)
  assert.match(read('src/app/perfil/PerfilCliente.tsx'), /esAdmin && <InvitationLinks \/>/)
  assert.match(read('src/app/registro/socias/page.tsx'), /export default RegistroPage/)
  assert.match(read('src/app/registro/page.tsx'), /tipo_usuario: esDesafio \? 'desafio' : 'gratuito'/)
  assert.match(read('src/app/api/registro/route.ts'), /input.tipo_usuario === 'desafio' \? 'desafio' : 'gratuito'/)
})
