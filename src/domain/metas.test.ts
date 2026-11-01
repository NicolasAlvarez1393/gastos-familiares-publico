import { describe, expect, it } from 'vitest'
import { avanceDeMeta, metasVigentes } from './metas.ts'
import type { Meta } from './tipos.ts'

const meta = (p: Partial<Meta> = {}): Meta => ({
  id: 'm1',
  nombre: 'Vacaciones',
  objetivo: 1_500_000_00,
  juntado: 600_000_00,
  actualizado: '',
  borrado: false,
  ...p,
})

describe('avanceDeMeta', () => {
  it('sin fecha: cuánto lleva y cuánto falta', () => {
    expect(avanceDeMeta(meta(), '2026-10-17')).toEqual({
      porcentaje: 40,
      falta: 900_000_00,
      cumplida: false,
      mesesQueQuedan: null,
      porMes: null,
      vencida: false,
    })
  })

  it('con fecha: lo que falta repartido en los meses que quedan (este y el de la meta)', () => {
    // De octubre a enero: octubre, noviembre, diciembre y enero = 4 meses.
    const a = avanceDeMeta(meta({ mes: '2027-01' }), '2026-10-17')
    expect(a.mesesQueQuedan).toBe(4)
    expect(a.porMes).toBe(225_000_00)
    // En pesos redondos, hacia arriba: con eso se llega seguro.
    expect(
      avanceDeMeta(meta({ juntado: 0, objetivo: 1000_00, mes: '2026-12' }), '2026-10-01').porMes,
    ).toBe(334_00)
  })

  it('cumplida, pasada de largo o vencida', () => {
    expect(
      avanceDeMeta(meta({ juntado: 1_600_000_00, mes: '2026-12' }), '2026-10-17'),
    ).toMatchObject({
      porcentaje: 100,
      falta: 0,
      cumplida: true,
      porMes: null,
    })
    expect(avanceDeMeta(meta({ mes: '2026-09' }), '2026-10-17')).toMatchObject({
      vencida: true,
      porMes: null,
    })
    expect(avanceDeMeta(meta({ mes: '2026-10' }), '2026-10-31').porMes).toBe(900_000_00)
  })

  it('las borradas no cuentan', () => {
    expect(metasVigentes([meta(), meta({ id: 'm2', borrado: true })]).map((m) => m.id)).toEqual([
      'm1',
    ])
  })
})
