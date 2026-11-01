import { describe, expect, it } from 'vitest'
import { categoriasDe } from './catalogo.ts'
import { comprometido, ordenarPorUso, resumenDelMes } from './balance.ts'
import type { Movimiento } from './tipos.ts'

const NICO = 'nico@ejemplo.com'
const MICA = 'mica@ejemplo.com'

let n = 0
function mov(p: Partial<Movimiento> & Pick<Movimiento, 'fecha' | 'monto'>): Movimiento {
  return {
    id: `m${++n}`,
    tipo: 'gasto',
    categoria: 'super',
    nota: '',
    quien: NICO,
    medio: 'debito',
    creado: '2026-10-01T12:00:00.000Z',
    actualizado: '2026-10-01T12:00:00.000Z',
    borrado: false,
    ...p,
  }
}

const movimientos: Movimiento[] = [
  mov({ fecha: '2026-10-01', monto: 100_000_00, tipo: 'ingreso', categoria: 'sueldo' }),
  mov({ fecha: '2026-10-01', monto: 50_000_00, tipo: 'ingreso', categoria: 'sueldo', quien: MICA }),
  mov({ fecha: '2026-10-03', monto: 30_000_00, categoria: 'super' }),
  mov({ fecha: '2026-10-05', monto: 10_000_00, categoria: 'super', quien: MICA }),
  mov({ fecha: '2026-10-07', monto: 20_000_00, categoria: 'casa', quien: MICA }),
  mov({ fecha: '2026-10-08', monto: 99_999_00, categoria: 'ocio', borrado: true }),
  mov({ fecha: '2026-09-15', monto: 40_000_00, categoria: 'super' }),
  // Compra en cuotas: oct, nov y dic.
  mov({ fecha: '2026-10-20', monto: 5_000_00, categoria: 'casa', compraId: 'c1', cuota: '1/3' }),
  mov({ fecha: '2026-11-20', monto: 5_000_00, categoria: 'casa', compraId: 'c1', cuota: '2/3' }),
  mov({ fecha: '2026-12-20', monto: 5_000_00, categoria: 'casa', compraId: 'c1', cuota: '3/3' }),
]

describe('resumenDelMes', () => {
  const r = resumenDelMes(movimientos, '2026-10')

  it('suma ingresos y gastos del mes, sin borrados y con la cuota del mes', () => {
    expect(r.ingresos).toBe(150_000_00)
    expect(r.gastos).toBe(65_000_00)
    expect(r.saldo).toBe(85_000_00)
  })

  it('calcula el porcentaje gastado y la variación contra el mes anterior', () => {
    expect(r.porcentajeGastado).toBeCloseTo(43.33, 2)
    expect(r.gastosMesAnterior).toBe(40_000_00)
    expect(r.variacionGastos).toBeCloseTo(62.5, 5)
  })

  it('agrupa por categoría (de mayor a menor) partida por integrante', () => {
    expect(r.gastosPorCategoria.map((c) => [c.categoria, c.total])).toEqual([
      ['super', 40_000_00],
      ['casa', 25_000_00],
    ])
    expect(r.gastosPorCategoria[0]!.porIntegrante).toEqual({ [NICO]: 30_000_00, [MICA]: 10_000_00 })
  })

  it('totaliza por integrante', () => {
    expect(r.porIntegrante[NICO]).toEqual({ gastos: 35_000_00, ingresos: 100_000_00 })
    expect(r.porIntegrante[MICA]).toEqual({ gastos: 30_000_00, ingresos: 50_000_00 })
  })

  it('un mes vacío da todo en cero y sin porcentajes', () => {
    const vacio = resumenDelMes(movimientos, '2025-01')
    expect(vacio).toMatchObject({ ingresos: 0, gastos: 0, saldo: 0, porcentajeGastado: null })
    expect(vacio.variacionGastos).toBeNull()
    expect(vacio.gastosPorCategoria).toEqual([])
  })
})

describe('comprometido', () => {
  it('suma las cuotas que caen después del mes, mes por mes', () => {
    expect(comprometido(movimientos, '2026-10')).toEqual([
      { mes: '2026-11', total: 5_000_00 },
      { mes: '2026-12', total: 5_000_00 },
    ])
  })

  it('no cuenta cuotas borradas ni del mismo mes', () => {
    expect(comprometido(movimientos, '2026-12')).toEqual([])
  })
})

describe('ordenarPorUso', () => {
  it('pone primero las más usadas, una compra en cuotas cuenta una vez', () => {
    const orden = ordenarPorUso(categoriasDe('gasto'), movimientos).map((c) => c.id)
    // super: 3 usos; casa: 1 + 1 compra = 2; el resto, orden del catálogo.
    expect(orden.slice(0, 4)).toEqual(['super', 'casa', 'comida', 'servicios'])
  })
})
