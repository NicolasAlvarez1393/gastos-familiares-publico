// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import temaJs from '../../public/tema.js?raw'
import { CLAVE_TEMA, guardarTema, leerTema } from './sesionLocal.ts'
import { cambiarTema } from './tema.ts'

const tema = () => document.documentElement.dataset.tema
const barra = () =>
  [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'))

/** El teléfono en claro u oscuro; `cambiar` simula que el teléfono cambia con la app abierta. */
function telefono(oscuro: boolean) {
  const consulta = { matches: oscuro, addEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', () => consulta)
  return {
    cambiar(aOscuro: boolean) {
      consulta.matches = aOscuro
      for (const [, avisar] of consulta.addEventListener.mock.calls) avisar()
    },
  }
}

/** Lo que hace index.html al abrir: correr public/tema.js antes que la app. */
const abrirLaApp = () => new Function(temaJs)()

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.tema
  document.head.innerHTML = `
    <meta name="theme-color" content="#f6f7f9" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0e1116" media="(prefers-color-scheme: dark)" />`
})

describe('tema', () => {
  it('sin elegir nada sigue al teléfono, y lo elegido se recuerda', () => {
    expect(leerTema()).toBe('sistema')
    guardarTema('oscuro')
    expect(leerTema()).toBe('oscuro')
    guardarTema('sistema')
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull()
    localStorage.setItem(CLAVE_TEMA, 'violeta')
    expect(leerTema()).toBe('sistema')
  })

  it('al abrir, el tema elegido gana al del teléfono, con su color de barra', () => {
    telefono(false)
    guardarTema('oscuro')
    abrirLaApp()
    expect(tema()).toBe('oscuro')
    expect(barra()).toEqual(['#0e1116', '#0e1116'])
  })

  it('"Como el teléfono" sigue al teléfono, también si cambia con la app abierta', () => {
    const t = telefono(true)
    abrirLaApp()
    expect(tema()).toBe('oscuro')
    t.cambiar(false)
    expect(tema()).toBe('claro')
    expect(barra()).toEqual(['#f6f7f9', '#f6f7f9'])
  })

  it('sin poder preguntarle al teléfono (navegador viejo), queda claro', () => {
    abrirLaApp()
    expect(tema()).toBe('claro')
  })

  it('elegir otro tema en la app se ve al instante y vuelve a seguir al teléfono', () => {
    telefono(true)
    abrirLaApp()
    cambiarTema('claro')
    expect(tema()).toBe('claro')
    cambiarTema('sistema')
    expect(tema()).toBe('oscuro')
    expect(leerTema()).toBe('sistema')
  })
})
