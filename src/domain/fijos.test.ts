import { describe, expect, it } from 'vitest'
import { fechaDelFijo, fijosPendientes, movimientoDeFijo } from './fijos.ts'
import { fijo, mov } from './fixtures.test-utils.ts'

describe('fijosPendientes', () => {
  const alquiler = fijo({ id: 'alquiler', nombre: 'Alquiler', dia: 10 })
  const luz = fijo({ id: 'luz', nombre: 'Luz', dia: 5, monto: 30_000_00, categoria: 'servicios' })
  const sueldo = fijo({ id: 'sueldo', tipo: 'ingreso', nombre: 'Sueldo', dia: 1 })
  const pausado = fijo({ id: 'gym', nombre: 'Gimnasio', activo: false })
  const borrado = fijo({ id: 'cable', nombre: 'Cable', borrado: true })
  const fijos = [alquiler, luz, sueldo, pausado, borrado]

  it('los activos sin registrar en el mes, ordenados por día', () => {
    expect(fijosPendientes(fijos, [], '2026-10').map((f) => f.id)).toEqual([
      'sueldo',
      'luz',
      'alquiler',
    ])
  })

  it('registrar uno en el mes lo saca; el del mes anterior no cuenta, ni uno borrado', () => {
    const movimientos = [
      mov({ fijo: 'luz', fecha: '2026-10-06' }),
      mov({ fijo: 'alquiler', fecha: '2026-09-10' }),
      mov({ fijo: 'sueldo', fecha: '2026-10-01', borrado: true }),
    ]
    expect(fijosPendientes(fijos, movimientos, '2026-10').map((f) => f.id)).toEqual([
      'sueldo',
      'alquiler',
    ])
  })
})

describe('fechaDelFijo', () => {
  it('el día del fijo en ese mes, con tope a fin de mes', () => {
    expect(fechaDelFijo({ dia: 5 }, '2026-10')).toBe('2026-10-05')
    expect(fechaDelFijo({ dia: 31 }, '2026-11')).toBe('2026-11-30')
    expect(fechaDelFijo({ dia: 30 }, '2027-02')).toBe('2027-02-28')
  })
})

describe('movimientoDeFijo', () => {
  const contexto = { nuevoId: () => 'nuevo', ahora: '2026-10-06T12:00:00.000Z' }

  it('arma el movimiento con el monto real, ligado al fijo y con su tarjeta', () => {
    const netflix = fijo({
      id: 'netflix',
      nombre: 'Netflix',
      categoria: 'suscripciones',
      medio: 'credito',
      tarjeta: 'visa',
    })
    expect(
      movimientoDeFijo(
        netflix,
        { monto: 12_999_00, fecha: '2026-10-06', quien: 'mica@ejemplo.com' },
        contexto,
      ),
    ).toEqual({
      id: 'nuevo',
      tipo: 'gasto',
      fecha: '2026-10-06',
      monto: 12_999_00,
      categoria: 'suscripciones',
      nota: 'Netflix',
      quien: 'mica@ejemplo.com',
      medio: 'credito',
      tarjeta: 'visa',
      fijo: 'netflix',
      creado: contexto.ahora,
      actualizado: contexto.ahora,
      borrado: false,
    })
  })

  it('no acepta un monto en cero', () => {
    expect(() =>
      movimientoDeFijo(fijo(), { monto: 0, fecha: '2026-10-06', quien: 'x' }, contexto),
    ).toThrow()
  })
})
