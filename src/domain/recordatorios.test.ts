import { describe, expect, it } from 'vitest'
import { formatearPesos } from './dinero.ts'
import { fijo, mov } from './fixtures.test-utils.ts'
import { recordatorioDelDia } from './recordatorios.ts'
import type { Tarjeta } from './tipos.ts'

const visa: Tarjeta = {
  id: 'visa',
  nombre: 'Visa',
  cierre: 25,
  vencimiento: 5,
  actualizado: '',
  borrado: false,
}
const sinNada = { movimientos: [], tarjetas: [], fijos: [] }

describe('recordatorioDelDia', () => {
  it('sin vencimientos cerca ni fijos atrasados, no hay nada que avisar', () => {
    expect(recordatorioDelDia(sinNada, '2026-10-16')).toBeNull()
    expect(recordatorioDelDia({ ...sinNada, tarjetas: [visa] }, '2026-10-16')).toBeNull()
  })

  it('la tarjeta que vence mañana u hoy, con lo que hay que pagar si se sabe', () => {
    // Comprada el 20 de septiembre (antes del cierre del 25): se paga el 5 de octubre.
    const compra = mov({
      fecha: '2026-09-20',
      monto: 230_000_00,
      medio: 'credito',
      tarjeta: 'visa',
    })
    const datos = { ...sinNada, tarjetas: [visa], movimientos: [compra] }
    expect(recordatorioDelDia(datos, '2026-10-04')).toBe(
      `Mañana vence la Visa (${formatearPesos(230_000_00)}).`,
    )
    expect(recordatorioDelDia(datos, '2026-10-05')).toBe(
      `Hoy vence la Visa (${formatearPesos(230_000_00)}).`,
    )
    expect(recordatorioDelDia({ ...datos, movimientos: [] }, '2026-10-05')).toBe(
      'Hoy vence la Visa.',
    )
  })

  it('a fin de mes, "mañana" es el mes que viene; una tarjeta borrada no avisa', () => {
    const el1 = { ...visa, vencimiento: 1 }
    expect(recordatorioDelDia({ ...sinNada, tarjetas: [el1] }, '2026-10-31')).toBe(
      'Mañana vence la Visa.',
    )
    expect(
      recordatorioDelDia({ ...sinNada, tarjetas: [{ ...el1, borrado: true }] }, '2026-10-31'),
    ).toBeNull()
  })

  it('los fijos a pagar que ya vencieron o vencen hasta mañana, no los cobros ni los pagados', () => {
    const luz = fijo({ nombre: 'Luz', dia: 5 })
    const gas = fijo({ nombre: 'Gas', dia: 17 })
    const internet = fijo({ nombre: 'Internet', dia: 16 })
    const expensas = fijo({ nombre: 'Expensas', dia: 25 })
    const sueldo = fijo({ nombre: 'Sueldo', tipo: 'ingreso', dia: 1 })
    const pagado = mov({ fecha: '2026-10-05', fijo: luz.id })
    const datos = {
      ...sinNada,
      fijos: [luz, gas, internet, expensas, sueldo],
      movimientos: [pagado],
    }
    expect(recordatorioDelDia(datos, '2026-10-16')).toBe('Para pagar: Internet y Gas.')
    expect(recordatorioDelDia({ ...datos, movimientos: [] }, '2026-10-16')).toBe(
      'Para pagar: Luz, Internet y Gas.',
    )
  })

  it('la tarjeta y los fijos juntos; con más de tres fijos, "y N más"; "e" antes de i', () => {
    const fijos = ['Agua', 'Gas', 'Luz', 'Seguro', 'Patente'].map((nombre, i) =>
      fijo({ nombre, dia: i + 1 }),
    )
    const datos = { ...sinNada, tarjetas: [{ ...visa, vencimiento: 17 }], fijos }
    expect(recordatorioDelDia(datos, '2026-10-16')).toBe(
      'Mañana vence la Visa. Para pagar: Agua, Gas, Luz y 2 más.',
    )
    const dos = [fijo({ nombre: 'Gas', dia: 1 }), fijo({ nombre: 'Internet', dia: 2 })]
    expect(recordatorioDelDia({ ...sinNada, fijos: dos }, '2026-10-16')).toBe(
      'Para pagar: Gas e Internet.',
    )
  })
})
