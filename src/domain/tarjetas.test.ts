import { describe, expect, it } from 'vitest'
import { aPagarPorTarjeta, mesDePago, mesesHastaElPago, tarjetaPorDefecto } from './tarjetas.ts'
import type { Movimiento, Tarjeta } from './tipos.ts'

function tarjeta(p: Partial<Tarjeta> = {}): Tarjeta {
  return { id: 'visa', nombre: 'Visa', actualizado: '', borrado: false, ...p }
}

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: Math.random().toString(36),
    tipo: 'gasto',
    fecha: '2026-10-10',
    monto: 100_00,
    categoria: 'super',
    nota: '',
    quien: 'nico@ejemplo.com',
    medio: 'credito',
    creado: '',
    actualizado: '',
    borrado: false,
    ...p,
  }
}

describe('mesesHastaElPago', () => {
  it('sin día de cierre, el mes siguiente', () => {
    expect(mesesHastaElPago('2026-10-28', undefined)).toBe(1)
    expect(mesesHastaElPago('2026-10-28', tarjeta())).toBe(1)
    expect(mesesHastaElPago('2026-10-28', tarjeta({ vencimiento: 5 }))).toBe(1)
  })

  it('cierra el 25 y vence el 5: antes del cierre, el mes siguiente; después, dos meses', () => {
    const t = tarjeta({ cierre: 25, vencimiento: 5 })
    expect(mesesHastaElPago('2026-10-25', t)).toBe(1)
    expect(mesesHastaElPago('2026-10-26', t)).toBe(2)
  })

  it('cierra el 3 y vence el 13: vence el mismo mes del cierre', () => {
    const t = tarjeta({ cierre: 3, vencimiento: 13 })
    expect(mesesHastaElPago('2026-10-02', t)).toBe(0)
    expect(mesesHastaElPago('2026-10-04', t)).toBe(1)
  })

  it('con cierre pero sin vencimiento, supone que vence el mes siguiente al cierre', () => {
    expect(mesesHastaElPago('2026-10-20', tarjeta({ cierre: 25 }))).toBe(1)
    expect(mesesHastaElPago('2026-10-28', tarjeta({ cierre: 25 }))).toBe(2)
  })

  it('un cierre el 31 en febrero cierra el último día', () => {
    expect(mesesHastaElPago('2027-02-28', tarjeta({ cierre: 31, vencimiento: 10 }))).toBe(1)
  })
})

describe('mesDePago', () => {
  it('pasa de año', () => {
    expect(mesDePago('2026-12-27', tarjeta({ cierre: 25, vencimiento: 5 }))).toBe('2027-02')
  })
})

describe('tarjetaPorDefecto', () => {
  const visa = tarjeta()
  const master = tarjeta({ id: 'master', nombre: 'Master' })

  it('la última usada; si no, la primera; sin tarjetas, ninguna', () => {
    const movimientos = [
      mov({ tarjeta: 'visa', creado: '2026-10-01T10:00:00Z' }),
      mov({ tarjeta: 'master', creado: '2026-10-05T10:00:00Z' }),
      mov({ tarjeta: 'visa', creado: '2026-10-09T10:00:00Z', borrado: true }),
    ]
    expect(tarjetaPorDefecto(movimientos, [visa, master])?.id).toBe('master')
    expect(tarjetaPorDefecto([], [visa, master])?.id).toBe('visa')
    expect(tarjetaPorDefecto(movimientos, [])).toBeNull()
  })

  it('no propone una tarjeta borrada', () => {
    const movimientos = [mov({ tarjeta: 'master', creado: '2026-10-05T10:00:00Z' })]
    expect(tarjetaPorDefecto(movimientos, [visa, { ...master, borrado: true }])?.id).toBe('visa')
  })
})

describe('aPagarPorTarjeta', () => {
  const visa = tarjeta({ cierre: 25, vencimiento: 5 })
  const master = tarjeta({ id: 'master', nombre: 'Master' })

  it('suma las cuotas del mes y las compras en un pago que vencen ese mes', () => {
    const movimientos = [
      mov({ tarjeta: 'visa', fecha: '2026-10-10', monto: 1_000_00 }), // vence en noviembre
      mov({ tarjeta: 'visa', fecha: '2026-10-28', monto: 500_00 }), // vence en diciembre
      mov({ tarjeta: 'visa', fecha: '2026-11-10', monto: 300_00, compraId: 'c', cuota: '1/3' }),
      mov({ tarjeta: 'master', fecha: '2026-10-01', monto: 200_00 }), // sin cierre: noviembre
      mov({ tarjeta: 'visa', fecha: '2026-10-11', monto: 999_00, borrado: true }),
      mov({ tarjeta: 'visa', fecha: '2026-10-11', monto: 999_00, tipo: 'ingreso' }),
      mov({ fecha: '2026-10-11', monto: 999_00 }), // crédito sin tarjeta elegida
    ]
    expect(aPagarPorTarjeta(movimientos, [visa, master], '2026-11')).toEqual([
      { tarjeta: master, total: 200_00 },
      { tarjeta: visa, total: 1_300_00 },
    ])
    expect(aPagarPorTarjeta(movimientos, [visa, master], '2026-12')).toEqual([
      { tarjeta: visa, total: 500_00 },
    ])
  })

  it('una tarjeta borrada sigue contando lo que ya se cargó con ella', () => {
    const vieja = tarjeta({ borrado: true })
    expect(aPagarPorTarjeta([mov({ tarjeta: 'visa' })], [vieja], '2026-11')).toHaveLength(1)
  })
})
