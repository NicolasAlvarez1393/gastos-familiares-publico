import { describe, expect, it } from 'vitest'
import { enPesosDe, factorAPesosDe, variacionReal, type SerieIPC } from './inflacion.ts'

// Índices reales del INDEC (IPC nacional, base dic 2016) de junio a agosto de 2026.
const serie: SerieIPC = {
  indices: { '2026-06': 11826.4103, '2026-07': 12076.3937, '2026-08': 12276.766 },
  hasta: '2026-08',
}

describe('factorAPesosDe y enPesosDe', () => {
  it('lleva la plata de un mes a pesos del último publicado', () => {
    expect(factorAPesosDe(serie, '2026-06')).toBeCloseTo(12276.766 / 11826.4103, 10)
    expect(enPesosDe(100_000_00, serie, '2026-06')).toBe(103_808_05)
    expect(enPesosDe(100_000_00, serie, '2026-08')).toBe(100_000_00)
  })

  it('a pesos de otro mes', () => {
    expect(enPesosDe(100_000_00, serie, '2026-06', '2026-07')).toBe(102_113_77)
  })

  it('un mes que el INDEC todavía no publicó toma el último índice (queda como está)', () => {
    expect(factorAPesosDe(serie, '2026-10')).toBe(1)
    expect(enPesosDe(50_000_00, serie, '2026-10')).toBe(50_000_00)
  })

  it('sin el índice del mes, queda como está', () => {
    expect(factorAPesosDe(serie, '2020-01')).toBeNull()
    expect(enPesosDe(50_000_00, serie, '2020-01')).toBe(50_000_00)
  })
})

describe('variacionReal', () => {
  it('descuenta la inflación del mes: gastar lo mismo con precios más altos es gastar menos', () => {
    // Julio: 2,11 % de inflación. Gastar 100.000 en junio y 102.113,77 en julio es lo mismo.
    expect(variacionReal(102_113_77, 100_000_00, serie, '2026-07', '2026-06')).toBeCloseTo(0, 1)
    expect(variacionReal(100_000_00, 100_000_00, serie, '2026-07', '2026-06')).toBeCloseTo(-2.07, 2)
  })

  it('sin la inflación del mes publicada, no se inventa', () => {
    expect(variacionReal(100_000_00, 90_000_00, serie, '2026-09', '2026-08')).toBeNull()
  })

  it('sin gastos el mes anterior, o sin su índice, no hay comparación', () => {
    expect(variacionReal(100_000_00, 0, serie, '2026-07', '2026-06')).toBeNull()
    expect(variacionReal(100_000_00, 90_000_00, serie, '2026-06', '2026-05')).toBeNull()
  })
})
