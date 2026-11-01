import { describe, expect, it } from 'vitest'
import { ESPERA_MAX_MS, ESPERA_MIN_MS, esperaTrasFallas } from './espera.ts'

describe('esperaTrasFallas', () => {
  it('sin fallas no espera', () => {
    expect(esperaTrasFallas(0, 0.5)).toBe(0)
  })

  it('crece al doble con cada falla seguida', () => {
    expect([1, 2, 3, 4].map((f) => esperaTrasFallas(f, 0.5))).toEqual([
      ESPERA_MIN_MS,
      ESPERA_MIN_MS * 2,
      ESPERA_MIN_MS * 4,
      ESPERA_MIN_MS * 8,
    ])
  })

  it('tiene tope', () => {
    expect(esperaTrasFallas(50, 0.5)).toBe(ESPERA_MAX_MS)
  })

  it('se desparrama ±25% según el azar, sin salirse aunque el azar venga raro', () => {
    expect(esperaTrasFallas(1, 0)).toBe(ESPERA_MIN_MS * 0.75)
    expect(esperaTrasFallas(1, 1)).toBe(ESPERA_MIN_MS * 1.25)
    expect(esperaTrasFallas(1, 7)).toBe(ESPERA_MIN_MS * 1.25)
    expect(esperaTrasFallas(1, -3)).toBe(ESPERA_MIN_MS * 0.75)
  })
})
