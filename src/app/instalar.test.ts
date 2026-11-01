// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { escucharInstalacion, esSafari, plataformaDe, useInstalacion } from './instalar.ts'

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

describe('plataformaDe', () => {
  it('Android, iPhone (también el iPad que se presenta como Mac) u otra', () => {
    expect(plataformaDe({ userAgent: ANDROID })).toBe('android')
    expect(plataformaDe({ userAgent: IPHONE_SAFARI })).toBe('iphone')
    expect(plataformaDe({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('iphone')
    expect(plataformaDe({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('otra')
  })

  it('en el iPhone, distingue Safari de otros navegadores', () => {
    expect(esSafari(IPHONE_SAFARI)).toBe(true)
    expect(esSafari(IPHONE_CHROME)).toBe(false)
  })
})

describe('useInstalacion', () => {
  it('guarda el aviso del navegador, lo muestra al tocar y se da por instalada al aceptar', async () => {
    escucharInstalacion(window)
    const { result } = renderHook(() => useInstalacion())
    expect(result.current.puedePedir).toBe(false)
    expect(result.current.instalada).toBe(false)

    const aviso = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(aviso)
    })
    // La app se queda con el aviso: el navegador no muestra el suyo.
    expect(aviso.defaultPrevented).toBe(true)
    expect(result.current.puedePedir).toBe(true)

    let acepto = false
    await act(async () => {
      acepto = await result.current.pedir()
    })
    expect(aviso.prompt).toHaveBeenCalledOnce()
    expect(acepto).toBe(true)
    expect(result.current.puedePedir).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.instalada).toBe(true)
  })
})
