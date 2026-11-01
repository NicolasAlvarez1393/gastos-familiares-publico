import { describe, expect, it } from 'vitest'
import { filtrarMovimientos, hayFiltro, SIN_FILTRO } from './filtros.ts'
import { mov } from './fixtures.test-utils.ts'

const cafe = mov({ nota: 'Café con amigas', categoria: 'comida', fecha: '2026-09-03' })
const nafta = mov({ nota: 'Nafta', categoria: 'transporte', medio: 'credito', fecha: '2026-10-02' })
const super1 = mov({ nota: '', categoria: 'super', medio: 'debito', fecha: '2026-10-05' })
const sueldo = mov({ tipo: 'ingreso', nota: 'Sueldo', categoria: 'sueldo', fecha: '2026-10-01' })
const borrado = mov({ nota: 'Nafta vieja', categoria: 'transporte', borrado: true })
const todos = [cafe, nafta, super1, sueldo, borrado]

const ids = (lista: { id: string }[]) => lista.map((m) => m.id)

describe('filtrarMovimientos', () => {
  it('sin filtros: los del mes, sin lo borrado', () => {
    expect(ids(filtrarMovimientos(todos, SIN_FILTRO, '2026-10'))).toEqual(
      ids([nafta, super1, sueldo]),
    )
  })

  it('buscando: en todos los meses, por nota o categoría, sin acentos ni mayúsculas', () => {
    const buscar = (texto: string) =>
      ids(filtrarMovimientos(todos, { ...SIN_FILTRO, texto }, '2026-10'))
    expect(buscar('CAFE')).toEqual(ids([cafe]))
    expect(buscar('  nafta ')).toEqual(ids([nafta]))
    expect(buscar('super')).toEqual(ids([super1]))
    expect(buscar('zzz')).toEqual([])
  })

  it('tipo, persona, categoría y medio se suman', () => {
    const f = (cambios: Partial<typeof SIN_FILTRO>) =>
      ids(filtrarMovimientos(todos, { ...SIN_FILTRO, ...cambios }, '2026-10'))
    expect(f({ tipo: 'ingreso' })).toEqual(ids([sueldo]))
    expect(f({ categoria: 'super' })).toEqual(ids([super1]))
    expect(f({ medio: 'credito' })).toEqual(ids([nafta]))
    expect(f({ medio: 'credito', categoria: 'super' })).toEqual([])
    expect(f({ quien: 'otra@ejemplo.com' })).toEqual([])
  })

  it('con una etiqueta: en todos los meses, solo las de esa etiqueta', () => {
    const viaje1 = mov({ etiqueta: 'Vacaciones', fecha: '2026-01-05' })
    const viaje2 = mov({ etiqueta: 'Vacaciones', fecha: '2026-02-03' })
    const otro = mov({ etiqueta: 'Mudanza', fecha: '2026-02-04' })
    const lista = [viaje1, viaje2, otro, nafta]
    expect(
      ids(filtrarMovimientos(lista, { ...SIN_FILTRO, etiqueta: 'Vacaciones' }, '2026-10')),
    ).toEqual(ids([viaje1, viaje2]))
  })

  it('sabe si hay algo elegido además del mes', () => {
    expect(hayFiltro(SIN_FILTRO)).toBe(false)
    expect(hayFiltro({ ...SIN_FILTRO, texto: '   ' })).toBe(false)
    expect(hayFiltro({ ...SIN_FILTRO, medio: 'efectivo' })).toBe(true)
  })
})
