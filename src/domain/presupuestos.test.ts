import { describe, expect, it } from 'vitest'
import { mov, presupuesto } from './fixtures.test-utils.ts'
import { avanceDePresupuestos, avisoDePresupuesto, estadoDe } from './presupuestos.ts'

describe('estadoDe', () => {
  it('avisa desde el 80 % y se pasa desde el 100 %', () => {
    expect([79.9, 80, 99.9, 100, 140].map(estadoDe)).toEqual([
      'bien',
      'cerca',
      'cerca',
      'pasado',
      'pasado',
    ])
  })
})

describe('avanceDePresupuestos', () => {
  const presupuestos = [
    presupuesto({ categoria: 'super', monto: 1_000_00 }),
    presupuesto({ categoria: 'comida', monto: 500_00 }),
    presupuesto({ categoria: 'ropa', monto: 300_00, borrado: true }),
    presupuesto({ categoria: 'ocio', monto: 0 }),
  ]

  it('suma solo los gastos del mes de esa categoría, sin borrados, y ordena por lo más comprometido', () => {
    const movimientos = [
      mov({ categoria: 'super', monto: 300_00 }),
      mov({ categoria: 'super', monto: 200_00 }),
      mov({ categoria: 'super', monto: 999_00, borrado: true }),
      mov({ categoria: 'super', monto: 999_00, fecha: '2026-09-30' }),
      mov({ categoria: 'super', monto: 999_00, tipo: 'ingreso' }),
      mov({ categoria: 'comida', monto: 450_00 }),
    ]
    expect(avanceDePresupuestos(presupuestos, movimientos, '2026-10')).toEqual([
      {
        categoria: 'comida',
        presupuesto: 500_00,
        gastado: 450_00,
        restante: 50_00,
        porcentaje: 90,
        estado: 'cerca',
      },
      {
        categoria: 'super',
        presupuesto: 1_000_00,
        gastado: 500_00,
        restante: 500_00,
        porcentaje: 50,
        estado: 'bien',
      },
    ])
  })

  it('un mes sin gastos muestra los presupuestos enteros', () => {
    expect(avanceDePresupuestos(presupuestos, [], '2026-10').map((a) => a.restante)).toEqual([
      1_000_00, 500_00,
    ])
  })
})

describe('avisoDePresupuesto', () => {
  const presupuestos = [presupuesto({ categoria: 'super', monto: 1_000_00 })]

  it('no dice nada mientras va bien o si la categoría no tiene presupuesto', () => {
    const movimientos = [mov({ monto: 700_00 })]
    expect(avisoDePresupuesto(presupuestos, movimientos, '2026-10', 'super')).toBeNull()
    expect(avisoDePresupuesto(presupuestos, movimientos, '2026-10', 'comida')).toBeNull()
  })

  it('avisa cerca y pasado', () => {
    expect(
      avisoDePresupuesto(presupuestos, [mov({ monto: 850_00 })], '2026-10', 'super')?.estado,
    ).toBe('cerca')
    expect(
      avisoDePresupuesto(presupuestos, [mov({ monto: 1_200_00 })], '2026-10', 'super'),
    ).toMatchObject({ estado: 'pasado', restante: -200_00 })
  })
})
