// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVersionNueva, vigilarVersiones, type Entorno } from './actualizar.ts'

/** Un navegador de mentira: eventos a mano, el reloj a mano. */
function navegadorFalso(o: { conServiceWorker: boolean }) {
  const eventos = new EventTarget()
  const documento = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  })
  const ventana = new EventTarget()
  const update = vi.fn(async () => undefined)
  let tick: () => void = () => undefined
  const entorno: Entorno = {
    serviceWorker: {
      controller: o.conServiceWorker ? ({} as ServiceWorker) : null,
      register: vi.fn(async () => ({ update }) as unknown as ServiceWorkerRegistration),
      addEventListener: eventos.addEventListener.bind(eventos),
    },
    documento: documento as unknown as Entorno['documento'],
    ventana: ventana as unknown as Entorno['ventana'],
    recargar: vi.fn(),
    cadaTanto: (fn) => (tick = fn),
  }
  vigilarVersiones(entorno)
  const esperar = () => new Promise((r) => setTimeout(r, 0))
  return {
    entorno,
    update,
    esperar,
    nuevaVersion: () => eventos.dispatchEvent(new Event('controllerchange')),
    tocar: () => ventana.dispatchEvent(new Event('pointerdown')),
    ocultar: () => {
      documento.visibilityState = 'hidden'
      documento.dispatchEvent(new Event('visibilitychange'))
    },
    mostrar: () => {
      documento.visibilityState = 'visible'
      documento.dispatchEvent(new Event('visibilitychange'))
    },
    pasaElTiempo: () => tick(),
  }
}

describe('vigilarVersiones', () => {
  it('pregunta si hay versión nueva al volver al frente y cada tanto mientras se usa', async () => {
    const n = navegadorFalso({ conServiceWorker: true })
    await n.esperar()
    expect(n.entorno.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
    n.ocultar()
    n.mostrar()
    expect(n.update).toHaveBeenCalledTimes(1)
    n.pasaElTiempo()
    expect(n.update).toHaveBeenCalledTimes(2)
  })

  it('si todavía no se tocó nada, se pasa a la versión nueva enseguida', () => {
    const n = navegadorFalso({ conServiceWorker: true })
    n.nuevaVersion()
    expect(n.entorno.recargar).toHaveBeenCalledOnce()
  })

  it('el primer service worker (la primera vez) no es una versión nueva: no recarga', () => {
    const n = navegadorFalso({ conServiceWorker: false })
    n.nuevaVersion()
    expect(n.entorno.recargar).not.toHaveBeenCalled()
  })

  it('usándola, avisa con Actualizar y recarga sola al pasar a segundo plano', async () => {
    const n = navegadorFalso({ conServiceWorker: true })
    await n.esperar()
    const { result } = renderHook(() => useVersionNueva())
    n.tocar()
    act(() => {
      n.nuevaVersion()
    })
    expect(n.entorno.recargar).not.toHaveBeenCalled()
    expect(result.current.hay).toBe(true)
    n.ocultar()
    expect(n.entorno.recargar).toHaveBeenCalledOnce()
  })
})
