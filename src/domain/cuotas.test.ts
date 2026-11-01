import { describe, expect, it } from 'vitest'
import { dividirEnCuotas, generarCuotas } from './cuotas.ts'

describe('dividirEnCuotas', () => {
  it('divide exacto cuando se puede', () => {
    expect(dividirEnCuotas(60_000_000, 6)).toEqual(Array(6).fill(10_000_000))
  })

  it('la última cuota absorbe el resto y la suma da exacto', () => {
    const cuotas = dividirEnCuotas(10_000_000, 3)
    expect(cuotas).toEqual([3_333_333, 3_333_333, 3_333_334])
    expect(cuotas.reduce((a, b) => a + b, 0)).toBe(10_000_000)
  })

  it('con una cuota devuelve el total', () => {
    expect(dividirEnCuotas(12_345, 1)).toEqual([12_345])
  })

  it('rechaza cantidades inválidas', () => {
    expect(() => dividirEnCuotas(100, 0)).toThrow()
    expect(() => dividirEnCuotas(100, 2.5)).toThrow()
    expect(() => dividirEnCuotas(100, 61)).toThrow()
  })
})

describe('generarCuotas', () => {
  it('una por mes desde el mes de la compra (ejemplo del plan)', () => {
    const cuotas = generarCuotas({
      total: 60_000_000,
      cantidad: 6,
      fechaCompra: '2026-10-12',
      mesesHastaPrimera: 0,
    })
    expect(cuotas.map((c) => c.fecha)).toEqual([
      '2026-10-12',
      '2026-11-12',
      '2026-12-12',
      '2027-01-12',
      '2027-02-12',
      '2027-03-12',
    ])
    expect(cuotas.map((c) => c.cuota)).toEqual(['1/6', '2/6', '3/6', '4/6', '5/6', '6/6'])
  })

  it('puede empezar el mes siguiente', () => {
    const cuotas = generarCuotas({
      total: 300_00,
      cantidad: 3,
      fechaCompra: '2026-10-12',
      mesesHastaPrimera: 1,
    })
    expect(cuotas.map((c) => c.fecha)).toEqual(['2026-11-12', '2026-12-12', '2027-01-12'])
  })

  it('puede empezar hasta 3 meses después (promo "primera cuota a 90 días")', () => {
    const cuotas = generarCuotas({
      total: 300_00,
      cantidad: 3,
      fechaCompra: '2026-10-12',
      mesesHastaPrimera: 3,
    })
    expect(cuotas.map((c) => c.fecha)).toEqual(['2027-01-12', '2027-02-12', '2027-03-12'])
  })

  it('una compra del 31 que empieza el mes siguiente cae a fin de mes cuando hace falta', () => {
    const fechas = generarCuotas({
      total: 300_00,
      cantidad: 3,
      fechaCompra: '2027-01-31',
      mesesHastaPrimera: 1,
    }).map((c) => c.fecha)
    expect(fechas).toEqual(['2027-02-28', '2027-03-31', '2027-04-30'])
  })

  it('rechaza un mes de primera cuota fuera de rango', () => {
    const con = (mesesHastaPrimera: number) => () =>
      generarCuotas({ total: 300_00, cantidad: 3, fechaCompra: '2026-10-12', mesesHastaPrimera })
    expect(con(-1)).toThrow()
    expect(con(4)).toThrow()
    expect(con(1.5)).toThrow()
  })

  it('una compra del 31 cae a fin de mes y vuelve al 31 cuando existe', () => {
    const fechas = generarCuotas({
      total: 400_00,
      cantidad: 4,
      fechaCompra: '2026-12-31',
      mesesHastaPrimera: 0,
    }).map((c) => c.fecha)
    expect(fechas).toEqual(['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31'])
  })
})
