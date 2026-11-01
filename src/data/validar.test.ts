import { describe, expect, it } from 'vitest'
import { datosDeEjemplo } from './demo/semilla.ts'
import { esMovimientoValido, rescatarEstado } from './validar.ts'

const ejemplo = datosDeEjemplo('2026-10-12')
const movimiento = ejemplo.movimientos[0]!

describe('esMovimientoValido', () => {
  it('acepta los movimientos de ejemplo', () => {
    expect(ejemplo.movimientos.every(esMovimientoValido)).toBe(true)
  })

  it('rechaza los que tienen campos rotos', () => {
    expect(esMovimientoValido({ ...movimiento, monto: '2500' })).toBe(false)
    expect(esMovimientoValido({ ...movimiento, monto: 10.5 })).toBe(false)
    expect(esMovimientoValido({ ...movimiento, fecha: '12/10/2026' })).toBe(false)
    expect(esMovimientoValido({ ...movimiento, tipo: 'otro' })).toBe(false)
    expect(esMovimientoValido({ ...movimiento, medio: 'cheque' })).toBe(false)
    expect(esMovimientoValido({ ...movimiento, id: undefined })).toBe(false)
    expect(esMovimientoValido(null)).toBe(false)
  })
})

describe('rescatarEstado', () => {
  it('descarta solo los registros rotos y conserva el resto', () => {
    const rescatado = rescatarEstado({
      ...ejemplo,
      movimientos: [...ejemplo.movimientos, { roto: true }, 42],
    })
    expect(rescatado?.movimientos).toHaveLength(ejemplo.movimientos.length)
  })

  it('si "yo" ya no es integrante, vuelve al dueño', () => {
    expect(rescatarEstado({ ...ejemplo, yo: 'nadie@ejemplo.com' })?.yo).toBe('nico@ejemplo.com')
  })

  it('sin dueño válido no hay nada que rescatar', () => {
    expect(rescatarEstado({ ...ejemplo, integrantes: [] })).toBeNull()
    expect(rescatarEstado({ movimientos: 'no' })).toBeNull()
    expect(rescatarEstado('texto')).toBeNull()
  })
})
