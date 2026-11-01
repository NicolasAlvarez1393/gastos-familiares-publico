import { describe, expect, it } from 'vitest'
import { primeraFila } from './sheets.ts'

describe('primeraFila', () => {
  it('saca la primera fila del rango que informa Google al agregar', () => {
    expect(primeraFila('Movimientos!A5:M6')).toBe(5)
    expect(primeraFila("'Mis datos'!A12:M12")).toBe(12)
    expect(primeraFila('Movimientos!$A$7:$M$9')).toBe(7)
  })

  it('sin rango (o con uno raro) no inventa una fila', () => {
    expect(primeraFila(undefined)).toBeNull()
    expect(primeraFila('Movimientos')).toBeNull()
  })
})
