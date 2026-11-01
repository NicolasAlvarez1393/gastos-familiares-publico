// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App.tsx'
import temaJs from '../../../public/tema.js?raw'
import { crearRepositorioDemo } from '../../data/demo/repositorioDemo.ts'
import { ESPACIO_FIJO } from '../../domain/dinero.ts'

afterEach(cleanup)

function abrirAjustes() {
  const repositorio = crearRepositorioDemo({ almacenamiento: null, hoy: '2026-10-16' })
  render(<App repositorio={repositorio} />)
  fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
  return repositorio
}

const hoja = () => screen.getByRole('dialog')
const escribir = (etiqueta: string, valor: string) =>
  fireEvent.change(within(hoja()).getByLabelText(etiqueta), { target: { value: valor } })
const tocar = (nombre: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nombre }))

describe('Ajustes', () => {
  it('agrega una tarjeta con cierre y vencimiento, o sin ellos', async () => {
    const repo = abrirAjustes()
    tocar('Agregar tarjeta')
    escribir('Nombre', 'Master BBVA')
    escribir('Día de cierre (opcional)', '28')
    escribir('Día de vencimiento (opcional)', '8')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.leer().tarjetas.find((t) => t.nombre === 'Master BBVA')).toMatchObject({
      cierre: 28,
      vencimiento: 8,
      borrado: false,
    })
    expect(screen.getByText('cierra el 28 · vence el 8')).toBeTruthy()

    tocar('Agregar tarjeta')
    escribir('Nombre', 'Amex')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const amex = repo.leer().tarjetas.find((t) => t.nombre === 'Amex')!
    expect(amex.cierre).toBeUndefined()
    expect(amex.vencimiento).toBeUndefined()
  })

  it('explica los errores sin cerrar la hoja', () => {
    abrirAjustes()
    tocar('Agregar tarjeta')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(within(hoja()).getByRole('alert').textContent).toContain('Poné un nombre')
    escribir('Nombre', 'Visa')
    escribir('Día de cierre (opcional)', '40')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(within(hoja()).getByRole('alert').textContent).toContain('del 1 al 31')
  })

  it('cambia un presupuesto y lo quita con Deshacer', async () => {
    const repo = abrirAjustes()
    tocar('Editar el presupuesto de Super')
    escribir('Por mes, en pesos', '500.000')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(repo.leer().presupuestos.find((p) => p.categoria === 'super')?.monto).toBe(500_000_00),
    )
    tocar('Editar el presupuesto de Super')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Borrar' }))
    await waitFor(() =>
      expect(repo.leer().presupuestos.find((p) => p.categoria === 'super')?.borrado).toBe(true),
    )
    tocar('Deshacer')
    await waitFor(() =>
      expect(repo.leer().presupuestos.find((p) => p.categoria === 'super')?.borrado).toBe(false),
    )
  })

  it('agrega un fijo pagado con la tarjeta, y se puede pausar', async () => {
    const repo = abrirAjustes()
    tocar('Agregar fijo')
    escribir('Nombre', 'Spotify')
    escribir('Monto de siempre', '6.500')
    escribir('Día del mes', '12')
    fireEvent.change(within(hoja()).getByLabelText('Categoría'), {
      target: { value: 'suscripciones' },
    })
    fireEvent.change(within(hoja()).getByLabelText('Cómo se paga'), {
      target: { value: 'credito' },
    })
    fireEvent.change(within(hoja()).getByLabelText('Tarjeta'), { target: { value: 'visa' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.leer().fijos.find((f) => f.nombre === 'Spotify')).toMatchObject({
      monto: 6_500_00,
      dia: 12,
      categoria: 'suscripciones',
      medio: 'credito',
      tarjeta: 'visa',
      activo: true,
    })

    tocar('Editar Spotify')
    fireEvent.click(within(hoja()).getByRole('checkbox'))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(repo.leer().fijos.find((f) => f.nombre === 'Spotify')?.activo).toBe(false),
    )
  })

  it('el tema se elige acá, se ve al instante y queda en este teléfono', () => {
    localStorage.clear()
    new Function(temaJs)() // lo que hace index.html antes de abrir la app
    abrirAjustes()
    const grupo = within(screen.getByRole('group', { name: 'Tema' }))
    expect(
      grupo.getByRole('button', { name: 'Como el teléfono' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(grupo.getByRole('button', { name: 'Oscuro' }))
    expect(document.documentElement.dataset.tema).toBe('oscuro')
    expect(grupo.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('gastos-familiares:tema')).toBe('oscuro')
    fireEvent.click(grupo.getByRole('button', { name: 'Como el teléfono' }))
    // jsdom no sabe el modo del teléfono: queda claro.
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(localStorage.getItem('gastos-familiares:tema')).toBeNull()
  })

  it('una tarjeta con vencimiento y un fijo se pueden agregar al calendario', async () => {
    const crearUrl = vi.fn<typeof URL.createObjectURL>(() => 'blob:prueba')
    URL.createObjectURL = crearUrl
    URL.revokeObjectURL = vi.fn()
    const descargar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      abrirAjustes()
      tocar('Editar la tarjeta Visa')
      const recordatorio = within(hoja()).getByRole('region', { name: 'Recordatorio' })
      const google = within(recordatorio).getByRole('link', { name: /Google Calendar/ })
      expect(google.getAttribute('href')).toContain('recur=RRULE')
      fireEvent.click(within(recordatorio).getByRole('button', { name: /Otro calendario/ }))
      const archivo = crearUrl.mock.calls[0]![0] as Blob
      expect(archivo.type).toBe('text/calendar')
      expect(await archivo.text()).toContain('SUMMARY:Vence la Visa')
      expect(descargar).toHaveBeenCalled()
      tocar('Cerrar')

      tocar('Editar Luz')
      expect(within(hoja()).getByRole('region', { name: 'Recordatorio' })).toBeTruthy()
      tocar('Cerrar')
      // Una tarjeta nueva todavía no: primero se guarda.
      tocar('Agregar tarjeta')
      expect(within(hoja()).queryByRole('region', { name: 'Recordatorio' })).toBeNull()
    } finally {
      descargar.mockRestore()
    }
  })

  it('categorías: agregar una propia, renombrar y esconder una de fábrica, con Deshacer', async () => {
    const repo = abrirAjustes()
    tocar('Agregar categoría')
    escribir('Nombre', 'Mascotas')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Ícono perro' }))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.leer().categorias).toMatchObject([
      { nombre: 'Mascotas', icono: 'perro', tipo: 'gasto' },
    ])
    expect(screen.getByRole('button', { name: 'Editar la categoría Mascotas' })).toBeTruthy()

    // No deja dos con el mismo nombre.
    tocar('Agregar categoría')
    escribir('Nombre', 'super')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(await within(hoja()).findByText('Ya hay una categoría "super".')).toBeTruthy()
    tocar('Cerrar')

    tocar('Editar la categoría Super')
    escribir('Nombre', 'Supermercado')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Editar la categoría Supermercado' })).toBeTruthy(),
    )

    tocar('Editar la categoría Ropa')
    tocar(/^Esconderla/)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Editar la categoría Ropa (escondida)' }),
      ).toBeTruthy(),
    )
    tocar('Deshacer')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Editar la categoría Ropa' })).toBeTruthy(),
    )

    // En Cargar: el nombre nuevo y la propia (en Más).
    tocar('Cargar')
    expect(screen.getByRole('button', { name: /Supermercado/ })).toBeTruthy()
    tocar('Más')
    expect(within(hoja()).getByRole('button', { name: /Mascotas/ })).toBeTruthy()
  })

  it('metas: sumar a lo juntado, y en Mes cuánto falta por mes', async () => {
    const repo = abrirAjustes()
    tocar('Editar la meta Vacaciones de verano')
    escribir('Sumar a lo juntado', '100000')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Sumar' }))
    expect((within(hoja()).getByLabelText('Ya juntaron') as HTMLInputElement).value).toBe('700000')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.leer().metas[0]).toMatchObject({ juntado: 700_000_00 })
    expect(
      within(screen.getByRole('button', { name: 'Editar la meta Vacaciones de verano' })).getByText(
        '46 %',
      ),
    ).toBeTruthy()

    tocar('Mes')
    const metas = screen.getByRole('region', { name: 'Metas' })
    expect(within(metas).getByText(/^Faltan .* por mes hasta /)).toBeTruthy()
  })

  it('ahorros: comprar dólares los suma sin tocar el balance; no deja sacar más de lo que hay', async () => {
    const repo = abrirAjustes()
    const movimientos = repo.leer().movimientos.length
    tocar('Editar el ahorro Dólares en casa')
    escribir('Poner o sacar', '200')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Sumar' }))
    expect((within(hoja()).getByLabelText('Cuánto hay') as HTMLInputElement).value).toBe('1400')
    escribir('Poner o sacar', '5000')
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Sacar' }))
    expect(within(hoja()).getByRole('alert').textContent).toBe(
      `No alcanza: hay US$${ESPACIO_FIJO}1.400.`,
    )
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.leer().ahorros.find((a) => a.id === 'dolares')).toMatchObject({
      moneda: 'USD',
      monto: 1_400_00,
    })
    expect(repo.leer().movimientos).toHaveLength(movimientos)

    tocar('Mes')
    const ahorros = screen.getByRole('region', { name: 'Ahorros' })
    // Cada moneda por su lado (el total y el renglón): los dólares no se pasan a pesos. Testing
    // Library compara con los espacios ya normalizados.
    expect(within(ahorros).getAllByText('US$ 1.400')).toHaveLength(2)
    expect(within(ahorros).getAllByText('$ 850.000')).toHaveLength(2)
  })

  it('ahorros: uno nuevo en pesos, vacío vale cero', async () => {
    const repo = abrirAjustes()
    tocar('Agregar ahorro')
    escribir('Nombre', 'Caja de ahorro')
    fireEvent.change(within(hoja()).getByRole('combobox'), { target: { value: 'ARS' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.leer().ahorros.find((a) => a.nombre === 'Caja de ahorro')).toMatchObject({
      moneda: 'ARS',
      monto: 0,
    })
  })
})
