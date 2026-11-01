import { describe, expect, it } from 'vitest'
import { chicosVigentes, resumenDeChicos } from './chicos.ts'
import { mov } from './fixtures.test-utils.ts'
import type { Chico } from './tipos.ts'

const chico = (p: Partial<Chico> = {}): Chico => ({
  planilla: 'planilla-juli',
  email: 'juli@ejemplo.com',
  apodo: 'Juli',
  color: 3,
  actualizado: '',
  borrado: false,
  ...p,
})

describe('resumenDeChicos', () => {
  const juli = chico()
  const tomi = chico({ planilla: 'planilla-tomi', email: 'tomi@ejemplo.com', apodo: 'Tomi' })
  const movimientos = [
    mov({ quien: juli.email, fecha: '2026-10-02', monto: 3_000_00, categoria: 'comida' }),
    mov({
      quien: juli.email,
      fecha: '2026-10-09',
      monto: 1_500_00,
      categoria: 'ocio',
      creado: '2026-10-09T10:00:00Z',
    }),
    mov({
      quien: juli.email,
      fecha: '2026-10-09',
      monto: 500_00,
      categoria: 'comida',
      creado: '2026-10-09T18:00:00Z',
    }),
    mov({ quien: juli.email, fecha: '2026-10-01', tipo: 'ingreso', monto: 20_000_00 }),
    mov({ quien: juli.email, fecha: '2026-10-05', monto: 9_999_00, borrado: true }),
    mov({ quien: juli.email, fecha: '2026-09-28', monto: 7_000_00 }),
  ]

  it('cada chico con lo suyo del mes: gastos, ingresos (la mesada que cargó) y categorías', () => {
    const [r] = resumenDeChicos(movimientos, [juli], '2026-10')
    expect(r).toMatchObject({ chico: juli, gastos: 5_000_00, ingresos: 20_000_00 })
    expect(r!.porCategoria.map((c) => [c.categoria, c.total])).toEqual([
      ['comida', 3_500_00],
      ['ocio', 1_500_00],
    ])
  })

  it('los movimientos del mes, sin borrados, lo más nuevo primero', () => {
    const [r] = resumenDeChicos(movimientos, [juli], '2026-10')
    expect(r!.movimientos.map((m) => [m.fecha, m.monto])).toEqual([
      ['2026-10-09', 500_00],
      ['2026-10-09', 1_500_00],
      ['2026-10-02', 3_000_00],
      ['2026-10-01', 20_000_00],
    ])
  })

  it('un chico sin nada cargado aparece en cero; uno quitado no aparece', () => {
    const r = resumenDeChicos(
      movimientos,
      [juli, tomi, chico({ email: 'otro@ejemplo.com', borrado: true })],
      '2026-10',
    )
    expect(r.map((x) => [x.chico.apodo, x.gastos])).toEqual([
      ['Juli', 5_000_00],
      ['Tomi', 0],
    ])
  })
})

describe('chicosVigentes', () => {
  it('saca los quitados', () => {
    expect(chicosVigentes([chico(), chico({ borrado: true })])).toHaveLength(1)
  })
})
