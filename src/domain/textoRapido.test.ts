import { describe, expect, it } from 'vitest'
import { mov } from './fixtures.test-utils.ts'
import { interpretarTexto, normalizar } from './textoRapido.ts'

type Contexto = Parameters<typeof interpretarTexto>[1]
const gasto: Contexto = { tipo: 'gasto', movimientos: [] }
const leer = (texto: string, contexto: Contexto = gasto) => {
  const r = interpretarTexto(texto, contexto)
  return { monto: r.monto, nota: r.nota, categoria: r.categoria?.id ?? null }
}

describe('interpretarTexto: monto y nota', () => {
  it('"helado 2500"', () => {
    expect(leer('helado 2500')).toEqual({ monto: 2_500_00, nota: 'helado', categoria: 'comida' })
  })

  it('con puntos de miles, centavos, signo y "pesos"', () => {
    expect(leer('$ 12.500,50 super')).toMatchObject({ monto: 12_500_50, nota: 'super' })
    expect(leer('nafta 45.000 pesos')).toMatchObject({ monto: 45_000_00, nota: 'nafta' })
  })

  it('"mil", "lucas" y "k"', () => {
    expect(leer('15 mil de luz')).toMatchObject({ monto: 15_000_00, nota: 'luz' })
    expect(leer('5 lucas de verdulería')).toMatchObject({ monto: 5_000_00, nota: 'verdulería' })
    expect(leer('farmacia 2k')).toMatchObject({ monto: 2_000_00, nota: 'farmacia' })
  })

  it('sin número: solo nota', () => {
    expect(leer('regalo para Juli')).toEqual({
      monto: null,
      nota: 'regalo para Juli',
      categoria: 'regalos',
    })
  })

  it('no confunde un número pegado a una palabra (Max2) con el monto', () => {
    expect(leer('cuota 3 del celu')).toMatchObject({ monto: 3_00 })
    expect(leer('mp3')).toMatchObject({ monto: null, nota: 'mp3' })
  })
})

describe('interpretarTexto: categoría', () => {
  it('sin tildes ni mayúsculas', () => {
    expect(leer('Farmacia 3000').categoria).toBe('salud')
    expect(normalizar('Súper Peluquería')).toBe('super peluqueria')
  })

  it('lo que ya cargó la familia gana al diccionario', () => {
    const movimientos = [
      mov({ nota: 'helado con los chicos', categoria: 'ocio' }),
      mov({ nota: 'Helado', categoria: 'ocio' }),
      mov({ nota: 'helado', categoria: 'comida', borrado: true }),
    ]
    expect(leer('helado 2500', { tipo: 'gasto', movimientos }).categoria).toBe('ocio')
  })

  it('solo sugiere categorías del tipo que se está cargando', () => {
    expect(leer('sueldo 900000').categoria).toBeNull()
    expect(leer('sueldo 900000', { tipo: 'ingreso', movimientos: [] }).categoria).toBe('sueldo')
  })

  it('sin pistas, ninguna', () => {
    expect(leer('2500').categoria).toBeNull()
    expect(leer('cosa rara 100').categoria).toBeNull()
  })
})
