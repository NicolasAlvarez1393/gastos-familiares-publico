// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App.tsx'
import { crearRepositorioDemo } from '../../data/demo/repositorioDemo.ts'

// El 7 de octubre: en la demo ya se pagaron los fijos hasta el 5; faltan Prepaga (8),
// Streaming (11) y Gas (15).
const HOY = '2026-10-07'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 12))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

afterEach(() => localStorage.clear())

function abrirMes() {
  const repositorio = crearRepositorioDemo({ almacenamiento: null, hoy: HOY })
  render(<App repositorio={repositorio} />)
  fireEvent.click(screen.getByRole('button', { name: 'Mes' }))
  return repositorio
}

describe('Mes (Etapa 9)', () => {
  it('muestra la proyección del mes en curso', () => {
    abrirMes()
    const proyeccion = screen.getByRole('region', { name: 'Proyección del mes' })
    expect(proyeccion.textContent).toMatch(/A este ritmo terminás el mes/)
    expect(proyeccion.textContent).toMatch(/Faltan pagar fijos por/)
  })

  it('lista los fijos que faltan y "Pagado" registra el monto real, con Deshacer', () => {
    const repo = abrirMes()
    expect(screen.getByText('6 de 9 listos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pagado: Gas' }))
    const hoja = screen.getByRole('dialog')
    const monto = within(hoja).getByLabelText(/¿Cuánto se pagó\?/)
    expect((monto as HTMLInputElement).value).toBe('29800')
    fireEvent.change(monto, { target: { value: '31.250' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Marcar como pagado' }))

    const pagado = repo.leer().movimientos.at(-1)!
    expect(pagado).toMatchObject({ fijo: 'gas', monto: 31_250_00, fecha: HOY, nota: 'Gas' })
    expect(screen.queryByRole('button', { name: 'Pagado: Gas' })).toBeNull()
    expect(screen.getByText('7 de 9 listos')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(screen.getByRole('button', { name: 'Pagado: Gas' })).toBeTruthy()
  })

  it('muestra cómo viene cada presupuesto', () => {
    abrirMes()
    const barras = screen.getAllByRole('meter')
    expect(barras.length).toBeGreaterThan(0)
    expect(barras[0]!.getAttribute('aria-label')).toMatch(/% del presupuesto$/)
  })

  it('muestra lo que vence en la tarjeta en el mes', () => {
    abrirMes()
    expect(screen.getByRole('heading', { name: 'Tarjetas: vence en octubre' })).toBeTruthy()
    expect(screen.getByText(/Visa/, { selector: 'span' })).toBeTruthy()
  })
})

describe('Mes con inflación (Etapa 10)', () => {
  const anio = () => screen.getByRole('region', { name: 'El año 2026' })
  const conInflacion = () => within(anio()).getByRole('button', { name: 'Con inflación' })

  it('apagada no la pide; prendida, el año en pesos del último mes publicado y queda prendida', async () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY })
    const traer = vi.spyOn(repo, 'traerInflacion')
    render(<App repositorio={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }))
    const sinAjustar = within(anio()).getByText(/^Gastaron /).textContent
    expect(traer).not.toHaveBeenCalled()

    fireEvent.click(conInflacion())
    expect(
      await within(anio()).findByText(
        /^En pesos de septiembre 2026, con la inflación de ejemplo de la demo\./,
      ),
    ).toBeTruthy()
    expect(conInflacion().getAttribute('aria-pressed')).toBe('true')
    // Agosto, en pesos de septiembre, vale más: el total del año sube.
    expect(within(anio()).getByText(/^Gastaron /).textContent).not.toBe(sinAjustar)
    // Octubre todavía no tiene inflación publicada: no se inventa la comparación.
    expect(screen.getByText(/la inflación de octubre todavía no se publicó/)).toBeTruthy()
    expect(localStorage.getItem('gastos-familiares:inflacion')).toBe('si')

    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    // Septiembre contra agosto: los dos con inflación publicada.
    expect(screen.getByText(/^Gastos contra agosto/).textContent).toMatch(
      /^Gastos contra agosto: [+−]\d+% · descontando la inflación, [+−]\d+%$/,
    )
  })

  it('si no se pudo traer, los montos quedan como están y se puede probar de nuevo', async () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY })
    const serie = await repo.traerInflacion()
    vi.spyOn(repo, 'traerInflacion')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(serie)
    render(<App repositorio={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }))
    fireEvent.click(conInflacion())
    const aviso = await within(anio()).findByRole('alert')
    expect(aviso.textContent).toMatch(/^No se pudo traer la inflación del INDEC/)
    fireEvent.click(within(aviso).getByRole('button', { name: 'Probar de nuevo' }))
    expect(await within(anio()).findByText(/^En pesos de septiembre 2026/)).toBeTruthy()
  })
})
