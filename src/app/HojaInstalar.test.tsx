// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { crearRepositorioDemo } from '../data/demo/repositorioDemo.ts'

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

function abrirEn(userAgent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  render(<App repositorio={crearRepositorioDemo({ almacenamiento: null, hoy: '2026-10-17' })} />)
}

describe('Instalar la app', () => {
  it('en la compu no aparece el botón del encabezado', () => {
    abrirEn('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36')
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull()
  })

  it('en el iPhone, los pasos de Compartir → Agregar a inicio, y entrar de nuevo desde el ícono', () => {
    abrirEn(IPHONE)
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }))
    const hoja = screen.getByRole('dialog')
    expect(within(hoja).getByText(/Tocá Compartir/)).toBeTruthy()
    expect(within(hoja).getByText('Agregar a inicio')).toBeTruthy()
    expect(within(hoja).getByText(/hay que entrar una vez más/)).toBeTruthy()
  })

  it('en Android sin el aviso del navegador, los pasos del menú; y se puede ocultar el botón', () => {
    abrirEn(ANDROID)
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }))
    const hoja = screen.getByRole('dialog')
    expect(within(hoja).getByText('Instalar app')).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: /No mostrar más el botón/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull()
  })
})
