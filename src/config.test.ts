import { describe, expect, it } from 'vitest'
import { planillaDelEntorno } from './config.ts'

describe('planillaDelEntorno', () => {
  it('producción usa la planilla de la familia', () => {
    // "prueba" en otra parte de la dirección (el subdominio de la cuenta) no la vuelve de prueba.
    for (const host of ['app.familia.workers.dev', 'app.prueba.workers.dev']) {
      expect(planillaDelEntorno(host)).toEqual({
        nombre: 'Gastos Familiares',
        etiqueta: 'gastosFamiliares',
      })
    }
  })

  it('el sitio de prueba y la compu usan una planilla de prueba aparte', () => {
    for (const host of ['prueba.familia.workers.dev', 'localhost', '127.0.0.1']) {
      expect(planillaDelEntorno(host)).toEqual({
        nombre: 'Gastos Familiares (prueba)',
        etiqueta: 'gastosFamiliares-prueba',
      })
    }
  })
})
