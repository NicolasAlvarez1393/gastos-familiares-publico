import { describe, expect, it } from 'vitest'
import { claveDeCuenta, mismaCuenta } from './cuentas.ts'

describe('mismaCuenta', () => {
  it('en Gmail, los puntos y las mayúsculas no cuentan', () => {
    expect(mismaCuenta('ana.prueba@gmail.com', 'anaprueba@gmail.com')).toBe(true)
    expect(mismaCuenta(' Ana.Prueba@Gmail.com ', 'a.n.a.prueba@gmail.com')).toBe(true)
    expect(claveDeCuenta('ana.prueba@gmail.com')).toBe('anaprueba@gmail.com')
  })

  it('en otras direcciones (de una empresa o escuela) los puntos sí cuentan', () => {
    expect(mismaCuenta('ana.perez@empresa.com.ar', 'anaperez@empresa.com.ar')).toBe(false)
    expect(mismaCuenta('Ana.Perez@empresa.com.ar', 'ana.perez@empresa.com.ar')).toBe(true)
  })

  it('cuentas distintas son distintas', () => {
    expect(mismaCuenta('nico@gmail.com', 'mica@gmail.com')).toBe(false)
  })
})
