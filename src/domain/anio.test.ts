import { describe, expect, it } from 'vitest'
import { resumenDelAnio } from './anio.ts'
import { mov } from './fixtures.test-utils.ts'

describe('resumenDelAnio', () => {
  const movimientos = [
    mov({ fecha: '2026-01-10', monto: 100_00, categoria: 'super' }),
    mov({ fecha: '2026-01-20', monto: 50_00, categoria: 'ocio' }),
    mov({ fecha: '2026-03-05', monto: 300_00, categoria: 'super' }),
    mov({ fecha: '2026-03-06', tipo: 'ingreso', monto: 1000_00, categoria: 'sueldo' }),
    // Una cuota de diciembre: comprometida, no gastada todavía.
    mov({ fecha: '2026-12-05', monto: 80_00, categoria: 'ropa', compraId: 'c1', cuota: '3/3' }),
    mov({ fecha: '2025-12-31', monto: 999_00 }),
    mov({ fecha: '2026-02-01', monto: 70_00, borrado: true }),
  ]
  const r = resumenDelAnio(movimientos, 2026, '2026-10-17')

  it('los 12 meses, con lo por venir aparte', () => {
    expect(r.meses).toHaveLength(12)
    expect(r.meses[0]).toEqual({ mes: '2026-01', gastos: 150_00, ingresos: 0, porVenir: false })
    expect(r.meses[1]!.gastos).toBe(0)
    expect(r.meses[11]).toMatchObject({ mes: '2026-12', gastos: 80_00, porVenir: true })
  })

  it('totales, promedio y categorías: solo lo que ya pasó', () => {
    expect(r.gastos).toBe(450_00)
    expect(r.ingresos).toBe(1000_00)
    // Dos meses con gastos (enero y marzo): 450 / 2.
    expect(r.promedioMensual).toBe(225_00)
    expect(r.porCategoria).toEqual([
      { categoria: 'super', total: 400_00 },
      { categoria: 'ocio', total: 50_00 },
    ])
  })

  it('el promedio va en pesos redondos', () => {
    const raro = [
      mov({ fecha: '2026-01-01', monto: 100_00 }),
      mov({ fecha: '2026-02-01', monto: 101_00 }),
    ]
    expect(resumenDelAnio(raro, 2026, '2026-10-17').promedioMensual).toBe(101_00)
  })

  it('con un ajuste por mes (la inflación), todo en la misma unidad: meses, totales y categorías', () => {
    // Enero vale el doble (precios a la mitad que hoy); el resto queda igual.
    const a = resumenDelAnio(movimientos, 2026, '2026-10-17', (mes) => (mes === '2026-01' ? 2 : 1))
    expect(a.meses[0]!.gastos).toBe(300_00)
    expect(a.meses[2]).toMatchObject({ gastos: 300_00, ingresos: 1000_00 })
    expect(a.gastos).toBe(600_00)
    expect(a.promedioMensual).toBe(300_00)
    expect(a.porCategoria).toEqual([
      { categoria: 'super', total: 500_00 },
      { categoria: 'ocio', total: 100_00 },
    ])
  })

  it('un año sin gastos no tiene promedio', () => {
    expect(resumenDelAnio(movimientos, 2024, '2026-10-17').promedioMensual).toBeNull()
  })
})
