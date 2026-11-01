import { describe, expect, it } from 'vitest'
import { armarMovimientos, idsDeCompra, montoConSigno, type DatosCarga } from './movimientos.ts'

const datos: DatosCarga = {
  tipo: 'gasto',
  monto: 250_000,
  categoria: 'comida',
  nota: '  Helado  ',
  quien: 'mica@ejemplo.com',
  medio: 'efectivo',
  fecha: '2026-10-12',
  cuotas: 1,
  mesesHastaPrimera: 0,
}

function contexto() {
  let n = 0
  return { nuevoId: () => `id-${++n}`, ahora: '2026-10-12T15:00:00.000Z' }
}

describe('armarMovimientos', () => {
  it('un gasto común es un solo movimiento, con la nota limpia', () => {
    const [m, ...resto] = armarMovimientos(datos, contexto())
    expect(resto).toHaveLength(0)
    expect(m).toMatchObject({
      id: 'id-1',
      tipo: 'gasto',
      monto: 250_000,
      nota: 'Helado',
      fecha: '2026-10-12',
      borrado: false,
      creado: '2026-10-12T15:00:00.000Z',
    })
    expect(m!.compraId).toBeUndefined()
  })

  it('una compra en cuotas genera una fila por cuota con el mismo compraId', () => {
    const movs = armarMovimientos(
      { ...datos, monto: 60_000_000, medio: 'credito', cuotas: 6 },
      contexto(),
    )
    expect(movs).toHaveLength(6)
    expect(new Set(movs.map((m) => m.compraId))).toEqual(new Set(['id-1']))
    expect(new Set(movs.map((m) => m.id)).size).toBe(6)
    expect(movs.map((m) => m.monto)).toEqual(Array(6).fill(10_000_000))
    expect(movs[5]).toMatchObject({ cuota: '6/6', fecha: '2027-03-12' })
  })

  it('la primera cuota cae el mes elegido', () => {
    const movs = armarMovimientos(
      { ...datos, monto: 300_00, medio: 'mercadopago', cuotas: 3, mesesHastaPrimera: 2 },
      contexto(),
    )
    expect(movs.map((m) => [m.cuota, m.fecha])).toEqual([
      ['1/3', '2026-12-12'],
      ['2/3', '2027-01-12'],
      ['3/3', '2027-02-12'],
    ])
  })

  it('un gasto sin cuotas queda en su fecha aunque se haya elegido otro mes', () => {
    const [m] = armarMovimientos({ ...datos, mesesHastaPrimera: 2 }, contexto())
    expect(m!.fecha).toBe('2026-10-12')
  })

  it('ignora las cuotas si el medio no las permite', () => {
    const movs = armarMovimientos({ ...datos, medio: 'debito', cuotas: 6 }, contexto())
    expect(movs).toHaveLength(1)
    expect(movs[0]!.monto).toBe(250_000)
  })

  it('un ingreso nunca va en cuotas', () => {
    const movs = armarMovimientos(
      { ...datos, tipo: 'ingreso', medio: 'credito', cuotas: 3 },
      contexto(),
    )
    expect(movs).toHaveLength(1)
  })

  it('rechaza montos en cero o con decimales', () => {
    expect(() => armarMovimientos({ ...datos, monto: 0 }, contexto())).toThrow()
    expect(() => armarMovimientos({ ...datos, monto: 10.5 }, contexto())).toThrow()
  })
})

describe('idsDeCompra', () => {
  const movs = armarMovimientos(
    { ...datos, monto: 3_000_00, medio: 'credito', cuotas: 3 },
    contexto(),
  )

  it('devuelve todas las cuotas o solo las que faltan', () => {
    expect(idsDeCompra(movs, 'id-1')).toHaveLength(3)
    expect(idsDeCompra(movs, 'id-1', '2026-11-01')).toEqual(['id-3', 'id-4'])
  })

  it('no incluye las borradas', () => {
    const conBorrada = movs.map((m, i) => (i === 0 ? { ...m, borrado: true } : m))
    expect(idsDeCompra(conBorrada, 'id-1')).toHaveLength(2)
  })
})

describe('montoConSigno', () => {
  it('los gastos restan y los ingresos suman', () => {
    expect(montoConSigno({ tipo: 'gasto', monto: 100 })).toBe(-100)
    expect(montoConSigno({ tipo: 'ingreso', monto: 100 })).toBe(100)
  })

  it('la etiqueta va en cada cuota, sin espacios de más; vacía, no va', () => {
    const base = {
      tipo: 'gasto' as const,
      monto: 300_00,
      categoria: 'ropa',
      nota: '',
      quien: 'nico@ejemplo.com',
      medio: 'credito' as const,
      fecha: '2026-10-17',
      mesesHastaPrimera: 0,
    }
    let n = 0
    const contexto = { nuevoId: () => `x${++n}`, ahora: '2026-10-17T12:00:00Z' }
    const cuotas = armarMovimientos({ ...base, cuotas: 3, etiqueta: ' Vacaciones ' }, contexto)
    expect(cuotas.map((m) => m.etiqueta)).toEqual(['Vacaciones', 'Vacaciones', 'Vacaciones'])
    const [suelto] = armarMovimientos({ ...base, cuotas: 1, etiqueta: '  ' }, contexto)
    expect(suelto).not.toHaveProperty('etiqueta')
  })
})
