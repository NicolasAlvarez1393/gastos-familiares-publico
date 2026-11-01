import { describe, expect, it } from 'vitest'
import { inicioDesdeParametros } from './inicio.ts'

const desde = (search: string) => inicioDesdeParametros(new URLSearchParams(search))

describe('inicioDesdeParametros', () => {
  it('los atajos del ícono', () => {
    expect(desde('?cargar=ingreso')).toEqual({ pestania: 'cargar', tipo: 'ingreso' })
    expect(desde('?cargar=gasto')).toEqual({ pestania: 'cargar', tipo: 'gasto' })
    expect(desde('?ver=mes')).toEqual({ pestania: 'mes' })
  })

  it('sin atajo (o uno raro), lo de siempre', () => {
    expect(desde('')).toEqual({})
    expect(desde('?cargar=otra')).toEqual({})
    expect(desde('?ver=familia')).toEqual({})
  })
})
