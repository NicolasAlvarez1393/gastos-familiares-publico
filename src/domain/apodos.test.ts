import { describe, expect, it } from 'vitest'
import { problemaConApodo } from './apodos.ts'

describe('problemaConApodo', () => {
  it('vacío o solo espacios, no', () => {
    expect(problemaConApodo('', ['Mica'])).toBe('vacio')
    expect(problemaConApodo('   ', ['Mica'])).toBe('vacio')
  })

  it('no puede repetir el de otro, sin importar mayúsculas ni espacios', () => {
    expect(problemaConApodo(' mica ', ['Mica', 'Juli'])).toBe('repetido')
  })

  it('uno nuevo está bien', () => {
    expect(problemaConApodo('Nicolás', ['Mica', 'Juli'])).toBeNull()
  })
})
