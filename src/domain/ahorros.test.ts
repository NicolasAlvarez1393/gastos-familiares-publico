import { describe, expect, it } from 'vitest'
import { ahorrosVigentes, moverAhorro, totalesDeAhorro } from './ahorros.ts'
import type { Ahorro } from './tipos.ts'

const ahorro = (p: Partial<Ahorro> = {}): Ahorro => ({
  id: 'a1',
  nombre: 'Dólares en casa',
  moneda: 'USD',
  monto: 1_200_00,
  actualizado: '',
  borrado: false,
  ...p,
})

describe('totalesDeAhorro', () => {
  it('suma cada moneda por su lado, sin pasar los dólares a pesos, y saltea los borrados', () => {
    expect(
      totalesDeAhorro([
        ahorro(),
        ahorro({ id: 'a2', monto: 300_50 }),
        ahorro({ id: 'a3', nombre: 'Plazo fijo', moneda: 'ARS', monto: 500_000_00 }),
        ahorro({ id: 'a4', moneda: 'ARS', monto: 1_000_00, borrado: true }),
      ]),
    ).toEqual({ ARS: 500_000_00, USD: 1_500_50 })
  })

  it('sin ahorros, cero en las dos', () => {
    expect(totalesDeAhorro([])).toEqual({ ARS: 0, USD: 0 })
  })
})

describe('moverAhorro', () => {
  it('sumar y sacar; sacar todo deja cero', () => {
    expect(moverAhorro(1_200_00, 200_00, 'sumar')).toBe(1_400_00)
    expect(moverAhorro(1_200_00, 200_50, 'sacar')).toBe(999_50)
    expect(moverAhorro(1_200_00, 1_200_00, 'sacar')).toBe(0)
  })

  it('no deja sacar más de lo que hay', () => {
    expect(moverAhorro(100_00, 100_01, 'sacar')).toBeNull()
  })
})

describe('ahorrosVigentes', () => {
  it('saca los borrados', () => {
    expect(ahorrosVigentes([ahorro(), ahorro({ id: 'a2', borrado: true })])).toHaveLength(1)
  })
})
