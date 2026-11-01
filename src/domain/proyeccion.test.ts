import { describe, expect, it } from 'vitest'
import { fijo, mov } from './fixtures.test-utils.ts'
import { proyectarMes } from './proyeccion.ts'

describe('proyectarMes', () => {
  // Octubre tiene 31 días: el 10, faltan 21.
  const HOY = '2026-10-10'

  it('al ritmo del día a día, menos los fijos que faltan pagar, más los que faltan cobrar', () => {
    const movimientos = [
      mov({ tipo: 'ingreso', categoria: 'sueldo', monto: 1_000_000_00, fecha: '2026-10-01' }),
      mov({ monto: 50_000_00, fecha: '2026-10-03' }), // día a día
      mov({ monto: 50_000_00, fecha: '2026-10-09' }), // día a día
      mov({ monto: 300_000_00, fecha: '2026-10-05', fijo: 'alquiler' }), // fijo ya pagado
      mov({ monto: 20_000_00, fecha: '2026-10-12', compraId: 'c', cuota: '2/3' }), // cuota del mes
      mov({ monto: 99_000_00, fecha: '2026-09-30' }), // otro mes
    ]
    const fijos = [
      fijo({ id: 'alquiler', monto: 300_000_00 }),
      fijo({ id: 'luz', monto: 40_000_00 }),
      fijo({ id: 'extra', tipo: 'ingreso', monto: 100_000_00 }),
    ]
    const p = proyectarMes(movimientos, fijos, HOY)
    expect(p.saldoHoy).toBe(1_000_000_00 - 100_000_00 - 300_000_00 - 20_000_00)
    expect(p.gastoDiario).toBe(10_000_00) // 100.000 en 10 días
    expect(p.diasQueFaltan).toBe(21)
    expect(p.gastoQueFalta).toBe(210_000_00)
    expect(p.fijosQueFaltan).toEqual({ gastos: 40_000_00, ingresos: 100_000_00 })
    expect(p.saldoFinal).toBe(580_000_00 - 210_000_00 - 40_000_00 + 100_000_00)
  })

  it('el último día del mes no proyecta más día a día', () => {
    const p = proyectarMes([mov({ fecha: '2026-10-31', monto: 31_00 })], [], '2026-10-31')
    expect(p.diasQueFaltan).toBe(0)
    expect(p.saldoFinal).toBe(-31_00)
  })

  it('un mes sin nada da cero', () => {
    expect(proyectarMes([], [], '2026-10-01').saldoFinal).toBe(0)
  })
})
