import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../../domain/tipos.ts'
import { aplicarSubida, fusionar, planDeSubida } from './fusion.ts'

function mov(
  id: string,
  actualizado = '2026-10-12T10:00:00.000Z',
  p: Partial<Movimiento> = {},
): Movimiento {
  return {
    id,
    tipo: 'gasto',
    fecha: '2026-10-12',
    monto: 100_00,
    categoria: 'super',
    nota: '',
    quien: 'nico@ejemplo.com',
    medio: 'efectivo',
    creado: '2026-10-12T10:00:00.000Z',
    actualizado,
    borrado: false,
    ...p,
  }
}

describe('fusionar', () => {
  it('trae lo que cargaron otros integrantes', () => {
    const r = fusionar(
      [mov('a')],
      [mov('a'), mov('b', undefined, { quien: 'mica@ejemplo.com' })],
      new Set(),
    )
    expect(r.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('un cambio pendiente de este teléfono manda sobre la planilla', () => {
    const local = mov('a', '2026-10-12T12:00:00.000Z', { nota: 'editado acá' })
    const remoto = mov('a', '2026-10-12T10:00:00.000Z', { nota: 'viejo' })
    expect(fusionar([local], [remoto], new Set(['a']))[0]!.nota).toBe('editado acá')
  })

  it('sin cambio pendiente manda la planilla (por ejemplo, una edición a mano)', () => {
    const local = mov('a', undefined, { nota: 'viejo' })
    const remoto = mov('a', undefined, { nota: 'corregido en Sheets' })
    expect(fusionar([local], [remoto], new Set())[0]!.nota).toBe('corregido en Sheets')
  })

  it('lo nuevo que todavía no se subió no se pierde', () => {
    expect(fusionar([mov('nuevo')], [], new Set(['nuevo'])).map((m) => m.id)).toEqual(['nuevo'])
  })

  it('si alguien borró la fila a mano y no hay cambio pendiente, se va también de acá', () => {
    expect(fusionar([mov('a'), mov('b')], [mov('a')], new Set())).toHaveLength(1)
  })
})

describe('planDeSubida', () => {
  it('lo que no está se agrega; lo que ya está se reescribe en su fila', () => {
    const plan = planDeSubida([mov('a'), mov('b')], new Map([['b', 7]]))
    expect(plan.nuevos.map((m) => m.id)).toEqual(['a'])
    expect(plan.cambios).toEqual([{ fila: 7, movimiento: mov('b') }])
  })

  it('reintento después de un corte: si el movimiento ya llegó, no se duplica', () => {
    // La subida anterior llegó a la planilla, pero la respuesta se perdió: sigue pendiente.
    const plan = planDeSubida([mov('a')], new Map([['a', 2]]))
    expect(plan.nuevos).toHaveLength(0)
    expect(plan.cambios).toHaveLength(1)
  })
})

describe('aplicarSubida', () => {
  it('reemplaza lo editado y suma lo nuevo al final, con su fila', () => {
    const editado = mov('b', '2026-10-12T11:00:00.000Z', { nota: 'editado' })
    const r = aplicarSubida(
      [mov('a'), mov('b')],
      new Map([
        ['a', 2],
        ['b', 3],
      ]),
      { nuevos: [mov('c'), mov('d')], cambios: [{ fila: 3, movimiento: editado }] },
      5, // otro teléfono agregó una fila (la 4) entre que se leyó y se subió
    )
    expect(r.remotos.map((m) => [m.id, m.nota])).toEqual([
      ['a', ''],
      ['b', 'editado'],
      ['c', ''],
      ['d', ''],
    ])
    expect([...r.filaPorId]).toEqual([
      ['a', 2],
      ['b', 3],
      ['c', 5],
      ['d', 6],
    ])
    expect(r.completo).toBe(true)
  })

  it('si Google no dijo dónde quedaron las nuevas, avisa que hay que releer', () => {
    const r = aplicarSubida([], new Map(), { nuevos: [mov('a')], cambios: [] }, null)
    expect(r.filaPorId.has('a')).toBe(false)
    expect(r.completo).toBe(false)
  })

  it('solo con ediciones no necesita saber la fila de nada nuevo', () => {
    const r = aplicarSubida(
      [mov('a')],
      new Map([['a', 2]]),
      { nuevos: [], cambios: [{ fila: 2, movimiento: mov('a') }] },
      null,
    )
    expect(r.completo).toBe(true)
  })
})
