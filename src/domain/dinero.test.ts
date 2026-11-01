import { describe, expect, it } from 'vitest'
import {
  digitosACentavos,
  ESPACIO_FIJO,
  formatearDolares,
  formatearEnMoneda,
  formatearPesos,
  teclear,
  textoACentavos,
} from './dinero.ts'

/** "$" + espacio que no se corta + número, como lo arma formatearPesos. */
const pesos = (numero: string) => `$${ESPACIO_FIJO}${numero}`

describe('teclear', () => {
  it('va armando el monto y borra de a un dígito', () => {
    let d = ''
    for (const t of ['2', '5', '000'] as const) d = teclear(d, t)
    expect(d).toBe('25000')
    expect(teclear(d, 'borrar')).toBe('2500')
  })

  it('no acepta ceros a la izquierda', () => {
    expect(teclear('', '0')).toBe('')
    expect(teclear('', '000')).toBe('')
  })

  it('tiene un tope de dígitos', () => {
    expect(teclear('9999999999', '1')).toBe('9999999999')
  })
})

describe('digitosACentavos', () => {
  it('pasa pesos enteros a centavos', () => {
    expect(digitosACentavos('2500')).toBe(250_000)
    expect(digitosACentavos('')).toBe(0)
  })
})

describe('formatearPesos', () => {
  it('formatea en es-AR sin decimales si no hay centavos', () => {
    expect(formatearPesos(250_000)).toBe(pesos('2.500'))
    expect(formatearPesos(1_850_000_00)).toBe(pesos('1.850.000'))
  })

  it('muestra centavos cuando los hay', () => {
    expect(formatearPesos(3_333_333)).toBe(pesos('33.333,33'))
  })

  it('formatea negativos', () => {
    expect(formatearPesos(-50_000)).toBe(`-${pesos('500')}`)
  })
})

describe('formatearDolares', () => {
  it('como los pesos, con "US$" y centavos solo si los hay', () => {
    expect(formatearDolares(200_00)).toBe(`US$${ESPACIO_FIJO}200`)
    expect(formatearDolares(1_200_50)).toBe(`US$${ESPACIO_FIJO}1.200,50`)
  })

  it('formatearEnMoneda elige por la moneda', () => {
    expect(formatearEnMoneda(200_00, 'USD')).toBe(`US$${ESPACIO_FIJO}200`)
    expect(formatearEnMoneda(200_00, 'ARS')).toBe(pesos('200'))
  })
})

describe('textoACentavos', () => {
  it('entiende el formato argentino', () => {
    expect(textoACentavos('2.500')).toBe(250_000)
    expect(textoACentavos(pesos('2.500,50'))).toBe(250_050)
    expect(textoACentavos('2500')).toBe(250_000)
  })

  it('rechaza lo que no es un monto', () => {
    expect(textoACentavos('')).toBeNull()
    expect(textoACentavos('abc')).toBeNull()
    expect(textoACentavos('1,234')).toBeNull()
  })
})
