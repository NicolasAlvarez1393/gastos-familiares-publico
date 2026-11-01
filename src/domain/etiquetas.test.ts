import { describe, expect, it } from 'vitest'
import { etiquetasUsadas } from './etiquetas.ts'
import { mov } from './fixtures.test-utils.ts'

describe('etiquetasUsadas', () => {
  it('la más reciente primero, sin repetir (sin importar mayúsculas), sin lo borrado', () => {
    const movimientos = [
      mov({ etiqueta: 'Vacaciones 2026', fecha: '2026-01-10' }),
      mov({ etiqueta: 'Cumple Juli', fecha: '2026-09-02' }),
      mov({ etiqueta: 'vacaciones 2026', fecha: '2026-01-12' }),
      mov({ etiqueta: 'Mudanza', fecha: '2026-10-01', borrado: true }),
      mov({ etiqueta: '   ', fecha: '2026-10-02' }),
      mov({ fecha: '2026-10-03' }),
    ]
    expect(etiquetasUsadas(movimientos)).toEqual(['Cumple Juli', 'vacaciones 2026'])
  })
})
