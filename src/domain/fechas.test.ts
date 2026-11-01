import { describe, expect, it } from 'vitest'
import {
  aFecha,
  etiquetaCorta,
  etiquetaDia,
  mesDe,
  nombreMes,
  sumarDias,
  sumarMeses,
  sumarMesesAMes,
} from './fechas.ts'

describe('aFecha', () => {
  it('usa el día local, no el de UTC', () => {
    // 23:30 local del 12/10: en UTC ya sería 13/10.
    expect(aFecha(new Date(2026, 9, 12, 23, 30))).toBe('2026-10-12')
  })
})

describe('sumarMeses', () => {
  it('mantiene el día', () => {
    expect(sumarMeses('2026-10-12', 1)).toBe('2026-11-12')
    expect(sumarMeses('2026-10-12', 5)).toBe('2027-03-12')
  })

  it('usa el último día si el día no existe', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(sumarMeses('2026-10-31', 1)).toBe('2026-11-30')
  })

  it('resta meses cruzando el año', () => {
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-15')
  })
})

describe('sumarDias', () => {
  it('cruza meses y años', () => {
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('meses', () => {
  it('extrae y desplaza meses', () => {
    expect(mesDe('2026-10-12')).toBe('2026-10')
    expect(sumarMesesAMes('2026-12', 1)).toBe('2027-01')
    expect(sumarMesesAMes('2026-01', -1)).toBe('2025-12')
  })

  it('nombra el mes en castellano', () => {
    expect(nombreMes('2026-10')).toBe('octubre 2026')
  })
})

describe('etiquetaCorta', () => {
  it('entra en un chip: Hoy, Ayer o día abreviado', () => {
    expect(etiquetaCorta('2026-10-12', '2026-10-12')).toBe('Hoy')
    expect(etiquetaCorta('2026-10-11', '2026-10-12')).toBe('Ayer')
    expect(etiquetaCorta('2026-09-30', '2026-10-12')).toBe('mié 30/9')
    expect(etiquetaCorta('2025-12-25', '2026-10-12')).toBe('jue 25/12/25')
  })
})

describe('etiquetaDia', () => {
  it('dice Hoy, Ayer o el día con nombre', () => {
    expect(etiquetaDia('2026-10-12', '2026-10-12')).toBe('Hoy')
    expect(etiquetaDia('2026-10-11', '2026-10-12')).toBe('Ayer')
    expect(etiquetaDia('2026-10-05', '2026-10-12')).toBe('lunes 5 de octubre')
    expect(etiquetaDia('2025-12-25', '2026-10-12')).toBe('jueves 25 de diciembre de 2025')
  })
})
