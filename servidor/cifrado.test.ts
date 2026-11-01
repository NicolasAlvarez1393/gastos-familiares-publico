import { describe, expect, it } from 'vitest'
import { aBase64url, aleatorio, crearCifrador, deBase64url } from './cifrado.ts'

const clave = new Uint8Array(32).fill(7)

describe('crearCifrador', () => {
  it('cifra y descifra ida y vuelta', async () => {
    const c = crearCifrador(clave)
    const texto = await c.cifrar({ rt: 'secreto', email: 'nico@ejemplo.com' })
    expect(texto).not.toContain('secreto')
    expect(await c.descifrar(texto)).toEqual({ rt: 'secreto', email: 'nico@ejemplo.com' })
  })

  it('cada cifrado es distinto aunque el dato sea el mismo (IV aleatorio)', async () => {
    const c = crearCifrador(clave)
    expect(await c.cifrar({ a: 1 })).not.toBe(await c.cifrar({ a: 1 }))
  })

  it('devuelve null si el texto fue alterado o es de otra clave', async () => {
    const texto = await crearCifrador(clave).cifrar({ a: 1 })
    const alterado = texto.slice(0, -2) + (texto.endsWith('A') ? 'BB' : 'AA')
    expect(await crearCifrador(clave).descifrar(alterado)).toBeNull()
    expect(await crearCifrador(new Uint8Array(32).fill(9)).descifrar(texto)).toBeNull()
    expect(await crearCifrador(clave).descifrar('basura')).toBeNull()
    expect(await crearCifrador(clave).descifrar('')).toBeNull()
  })
})

describe('base64url', () => {
  const todos = Uint8Array.from({ length: 256 }, (_, i) => i)

  it('va y vuelve con los 256 valores de byte, sin caracteres de URL problemáticos', () => {
    const texto = aBase64url(todos)
    expect(texto).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(deBase64url(texto)).toEqual(todos)
  })

  it('da lo mismo que la base64url de Node', () => {
    for (const largo of [0, 1, 2, 3, 31, 32, 33]) {
      const bytes = todos.slice(0, largo)
      expect(aBase64url(bytes)).toBe(Buffer.from(bytes).toString('base64url'))
    }
  })

  it('lee también base64 común, con o sin relleno', () => {
    const comun = Buffer.from(todos).toString('base64')
    expect(deBase64url(comun)).toEqual(todos)
    expect(deBase64url(comun.replace(/=+$/, ''))).toEqual(todos)
  })

  it('falla con texto que no es base64', () => {
    expect(() => deBase64url('¡no!')).toThrow()
  })
})

describe('aleatorio', () => {
  it('da la cantidad de bytes pedida y no se repite', () => {
    expect(deBase64url(aleatorio(32))).toHaveLength(32)
    expect(aleatorio()).not.toBe(aleatorio())
  })
})
