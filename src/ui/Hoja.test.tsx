// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hoja } from './Hoja.tsx'

afterEach(cleanup)

/** Padre que, como las pantallas reales, pasa un `onCerrar` nuevo en cada render. */
function ConInput(props: { onCerrar: () => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Hoja titulo="Prueba" onCerrar={() => props.onCerrar()}>
      <input aria-label="campo" value={texto} onChange={(e) => setTexto(e.target.value)} />
    </Hoja>
  )
}

describe('Hoja', () => {
  it('no le roba el foco a un campo cuando el padre se vuelve a pintar', () => {
    render(<ConInput onCerrar={() => {}} />)
    const campo = screen.getByLabelText('campo')
    campo.focus()
    fireEvent.change(campo, { target: { value: 'a' } })
    expect(document.activeElement).toBe(campo)
  })

  it('se cierra con Escape y con la X', () => {
    const onCerrar = vi.fn()
    render(<ConInput onCerrar={onCerrar} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onCerrar).toHaveBeenCalledTimes(2)
  })
})
