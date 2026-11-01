// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedDeContencion } from './RedDeContencion.tsx'

afterEach(cleanup)

function Rompe(): never {
  throw new Error('falla de prueba')
}

describe('RedDeContencion', () => {
  it('si una pantalla falla muestra cómo seguir en vez de dejar todo en blanco', () => {
    // React y la red de contención loguean el error: se silencia para el test.
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RedDeContencion>
        <Rompe />
      </RedDeContencion>,
    )
    expect(screen.getByRole('alert').textContent).toContain('no se perdió nada')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    consola.mockRestore()
  })
})
