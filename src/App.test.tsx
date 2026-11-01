// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { crearRepositorioDemo } from './data/demo/repositorioDemo.ts'
import { ESPACIO_FIJO } from './domain/dinero.ts'
import { hoy } from './domain/fechas.ts'

afterEach(cleanup)

/** "$" + espacio que no se corta + número, como lo arma formatearPesos. */
const pesos = (numero: string) => `$${ESPACIO_FIJO}${numero}`

function abrirApp() {
  const repositorio = crearRepositorioDemo({ almacenamiento: null, hoy: hoy() })
  render(<App repositorio={repositorio} />)
  return repositorio
}

const tocar = (nombre: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nombre }))

function teclear(...teclas: string[]) {
  const teclado = screen.getByRole('group', { name: 'Teclado numérico' })
  for (const tecla of teclas) fireEvent.click(within(teclado).getByRole('button', { name: tecla }))
}

describe('App (demo)', () => {
  it('una etiqueta puesta va en todo lo que se carga, y en la Lista se ve el total', () => {
    localStorage.clear()
    try {
      const repositorio = abrirApp()
      tocar('Poner una etiqueta')
      fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), {
        target: { value: 'Vacaciones 2027' },
      })
      tocar('Usar')
      expect(screen.getByRole('button', { name: 'Etiqueta puesta: Vacaciones 2027' })).toBeTruthy()
      teclear('1', '5', '0', '0')
      tocar(/Super$/)
      expect(screen.getByRole('status', { name: 'Avisos' }).textContent).toContain(
        '· Vacaciones 2027',
      )
      const conEtiqueta = repositorio
        .leer()
        .movimientos.filter((m) => m.etiqueta === 'Vacaciones 2027')
      expect(conEtiqueta).toHaveLength(1)

      tocar('Lista')
      tocar('Filtros por categoría y medio')
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /Vacaciones 2027/ }),
      )
      tocar(/^Ver 1 movimiento$/)
      expect(screen.getByText('«Vacaciones 2027» en todos los meses')).toBeTruthy()

      tocar('Cargar')
      tocar('Etiqueta puesta: Vacaciones 2027')
      tocar(/^Sacar la etiqueta/)
      expect(screen.getByRole('button', { name: 'Poner una etiqueta' })).toBeTruthy()
    } finally {
      localStorage.clear()
    }
  })

  it('en la Lista se busca en todos los meses y se filtra por categoría', () => {
    abrirApp()
    tocar('Lista')
    const buscar = screen.getByRole('searchbox', { name: 'Buscar' })
    fireEvent.change(buscar, { target: { value: 'HELADO' } })
    expect(screen.getByText('Buscando en todos los meses')).toBeTruthy()
    expect(screen.getAllByText('Helado').length).toBeGreaterThan(0)
    expect(screen.queryByText('Super semanal')).toBeNull()
    fireEvent.change(buscar, { target: { value: 'nada de esto' } })
    expect(screen.getByText('No hay nada con "nada de esto".')).toBeTruthy()
    fireEvent.change(buscar, { target: { value: '' } })

    tocar('Filtros por categoría y medio')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Super' }))
    tocar(/^Ver \d+ movimientos?$/)
    expect(screen.queryByText('Helado')).toBeNull()
    expect(screen.getAllByText('Super semanal').length).toBeGreaterThan(0)
    tocar('Sacar el filtro Super')
    expect(screen.getAllByText('Helado').length).toBeGreaterThan(0)
  })

  it('una vez por día avisa lo que hay que pagar, y Ver lleva a Mes', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      // 2 de noviembre: las expensas (día 3) vencen mañana y todavía no se pagaron.
      vi.setSystemTime(new Date(2026, 10, 2, 12, 0))
      localStorage.clear()
      abrirApp()
      const aviso = screen.getByRole('status', { name: 'Avisos' })
      expect(aviso.textContent).toContain('Para pagar: Expensas.')
      fireEvent.click(within(aviso).getByRole('button', { name: 'Ver' }))
      expect(screen.getByRole('button', { name: 'Mes', current: 'page' })).toBeTruthy()
      cleanup()
      abrirApp()
      expect(screen.getByRole('status', { name: 'Avisos' }).textContent).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('muestra el nombre y abre en Cargar', () => {
    abrirApp()
    expect(screen.getByRole('heading', { name: 'Gastos Familiares' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
  })

  it('el flujo del helado: monto + categoría guarda, y Deshacer lo saca', () => {
    const repositorio = abrirApp()
    const cantidad = () => repositorio.leer().movimientos.filter((m) => !m.borrado).length
    const antes = cantidad()

    teclear('2', '5', '0', '0')
    expect(screen.getByLabelText('Monto').textContent).toBe(pesos('2.500'))

    tocar(/Super$/)
    expect(cantidad()).toBe(antes + 1)
    const aviso = screen.getByRole('status', { name: 'Avisos' })
    expect(aviso.textContent).toContain(`Guardado: Super ${pesos('2.500')}`)
    expect(screen.getByLabelText('Monto').textContent).toBe(pesos('0'))

    fireEvent.click(within(aviso).getByRole('button', { name: 'Deshacer' }))
    expect(cantidad()).toBe(antes)
  })

  it('un ingreso suma a "te quedan"', () => {
    const repositorio = abrirApp()
    const teQuedan = () => screen.getByText(/Te quedan/).textContent ?? ''
    const antes = teQuedan()
    tocar('Ingreso')
    teclear('1', '000')
    tocar(/Sueldo$/)
    const ultimo = repositorio.leer().movimientos.at(-1)
    expect(ultimo).toMatchObject({ tipo: 'ingreso', categoria: 'sueldo', monto: 1_000_00 })
    expect(ultimo?.medio).toBe('transferencia')
    expect(teQuedan()).not.toBe(antes)
  })

  it('sin monto no guarda y avisa', () => {
    const repositorio = abrirApp()
    const antes = repositorio.leer().movimientos.length
    tocar(/Super$/)
    expect(screen.getByRole('alert').textContent).toBe('Primero tipeá el monto')
    expect(repositorio.leer().movimientos).toHaveLength(antes)
  })

  it('una compra con crédito en 6 cuotas genera 6 movimientos', () => {
    const repositorio = abrirApp()
    const antes = repositorio.leer().movimientos.length
    teclear('6', '000', '000')
    tocar(/^Medio:/)
    tocar(/Crédito/)
    tocar('Cuotas: sin cuotas')
    tocar('6 cuotas')
    expect(screen.getByRole('button', { name: 'Cuotas: 6' }).parentElement?.textContent).toContain(
      `× ${pesos('1.000.000')}`,
    )
    tocar(/Casa$/)
    const nuevos = repositorio.leer().movimientos.slice(antes)
    expect(nuevos).toHaveLength(6)
    expect(nuevos.every((m) => m.monto === 1_000_000_00)).toBe(true)
  })

  it('en cuotas, la primera cae el mes que viene salvo que se elija otro mes', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 16, 12, 0))
      const repositorio = abrirApp()
      const cargarEn3Cuotas = (mesElegido?: RegExp) => {
        const antes = repositorio.leer().movimientos.length
        teclear('3', '000')
        // El medio queda elegido entre una carga y otra.
        if (!screen.queryByRole('button', { name: /^Medio: Crédito/ })) {
          tocar(/^Medio:/)
          tocar(/Crédito/)
        }
        tocar('Cuotas: sin cuotas')
        tocar('3 cuotas')
        if (mesElegido) {
          tocar('Primera cuota: noviembre 2026')
          tocar(mesElegido)
        }
        tocar(/Casa$/)
        return repositorio
          .leer()
          .movimientos.slice(antes)
          .map((m) => m.fecha)
      }

      expect(cargarEn3Cuotas()).toEqual(['2026-11-16', '2026-12-16', '2027-01-16'])
      expect(screen.getByRole('status', { name: 'Avisos' }).textContent).toContain(
        'en 3 cuotas desde noviembre 2026',
      )
      expect(cargarEn3Cuotas(/^Octubre 2026, este mes$/)).toEqual([
        '2026-10-16',
        '2026-11-16',
        '2026-12-16',
      ])
      expect(cargarEn3Cuotas(/^Enero 2027, en 3 meses$/)[0]).toBe('2027-01-16')
    } finally {
      vi.useRealTimers()
    }
  })

  it('con crédito se elige la tarjeta y su cierre decide el mes de la primera cuota', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      // La Visa de la demo cierra el 25 y vence el 5.
      vi.setSystemTime(new Date(2026, 9, 27, 12, 0))
      const repositorio = abrirApp()
      const antes = repositorio.leer().movimientos.length
      teclear('3', '000')
      tocar(/^Medio:/)
      // En la hoja de medios, cada tarjeta es una opción de Crédito.
      tocar(/Visa/)
      expect(screen.getByRole('button', { name: 'Medio: Crédito, Visa' })).toBeTruthy()
      tocar('Cuotas: sin cuotas')
      tocar('3 cuotas')
      // Después del cierre: entra en el resumen de noviembre, que vence en diciembre.
      expect(screen.getByRole('button', { name: 'Primera cuota: diciembre 2026' })).toBeTruthy()
      tocar(/Casa$/)
      const nuevos = repositorio.leer().movimientos.slice(antes)
      expect(nuevos.map((m) => [m.fecha, m.tarjeta])).toEqual([
        ['2026-12-27', 'visa'],
        ['2027-01-27', 'visa'],
        ['2027-02-27', 'visa'],
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('en la compu el monto se tipea con el teclado (pero no mientras se escribe la nota)', () => {
    abrirApp()
    for (const key of ['1', '2', '5', '0', 'Backspace', '0']) fireEvent.keyDown(window, { key })
    expect(screen.getByRole('status', { name: 'Monto' }).textContent).toBe(pesos('1.250'))
    tocar('+ nota')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nota' }), { key: '9' })
    expect(screen.getByRole('status', { name: 'Monto' }).textContent).toBe(pesos('1.250'))
  })

  it('el texto rápido "helado 2500" se guarda con un toque', () => {
    const repositorio = abrirApp()
    tocar('+ nota')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota' }), {
      target: { value: 'helado 2500' },
    })
    const sugerencia = screen.getByRole('group', { name: 'Sugerencia' })
    expect(sugerencia.textContent).toContain('Comida y salidas')
    fireEvent.click(within(sugerencia).getByRole('button', { name: 'Guardar' }))
    expect(repositorio.leer().movimientos.at(-1)).toMatchObject({
      monto: 2_500_00,
      nota: 'helado',
      categoria: 'comida',
    })
  })

  it('"Otra" deja el monto del texto y la nota para elegir otra categoría', () => {
    abrirApp()
    tocar('+ nota')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota' }), {
      target: { value: 'helado 2500' },
    })
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Sugerencia' })).getByRole('button', {
        name: 'Otra',
      }),
    )
    expect(screen.getByRole('status', { name: 'Monto' }).textContent).toBe(pesos('2.500'))
    expect((screen.getByRole('textbox', { name: 'Nota' }) as HTMLInputElement).value).toBe('helado')
  })

  it('avisa al guardar cuando una categoría llega al 80 % del presupuesto, y cuando se pasa', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      // En la demo, Ropa tiene $ 80.000 por mes y las zapatillas recién se compran el 21.
      vi.setSystemTime(new Date(2026, 9, 16, 12, 0))
      abrirApp()
      const cargarRopa = (...teclas: string[]) => {
        teclear(...teclas)
        tocar('Más')
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Ropa$/ }))
        return screen.getByRole('status', { name: 'Avisos' }).textContent
      }
      expect(cargarRopa('7', '0', '000')).toContain('Ropa: 88 % del presupuesto')
      expect(cargarRopa('2', '0', '000')).toContain('Ropa: te pasaste del presupuesto')
    } finally {
      vi.useRealTimers()
    }
  })

  it('con la app abierta de un día para el otro, guarda con la fecha del día', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 12, 22, 0))
      const repositorio = abrirApp()
      // La app queda abierta en segundo plano y se retoma al día siguiente.
      vi.setSystemTime(new Date(2026, 9, 13, 9, 0))
      teclear('5', '0', '0')
      tocar(/Super$/)
      expect(repositorio.leer().movimientos.at(-1)?.fecha).toBe('2026-10-13')
    } finally {
      vi.useRealTimers()
    }
  })

  it('si quitan a quien estaba elegido, el gasto queda a nombre de uno mismo', () => {
    const repositorio = abrirApp()
    const { yo } = repositorio.leer()
    tocar(/^Quién:/)
    tocar(/Mica/)
    repositorio.quitarIntegrante('mica@ejemplo.com')
    teclear('1', '000')
    tocar(/Super$/)
    expect(repositorio.leer().movimientos.at(-1)?.quien).toBe(yo)
  })
})

describe('App retomada otro día', () => {
  it('al volver al frente en otro mes, la Lista muestra el mes nuevo', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 31, 22, 0))
      abrirApp()
      tocar('Lista')
      expect(screen.getByRole('heading', { name: 'octubre 2026' })).toBeTruthy()
      vi.setSystemTime(new Date(2026, 10, 1, 9, 0))
      fireEvent(window, new Event('focus'))
      expect(screen.getByRole('heading', { name: 'noviembre 2026' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Mes (demo)', () => {
  it('un mes futuro con solo cuotas dice "Ya comprometido", no "Te pasaste"', () => {
    abrirApp()
    tocar('Mes')
    tocar('Mes siguiente')
    const balance = screen.getByRole('region', { name: 'Balance' })
    expect(balance.textContent).toContain('Ya comprometido')
    expect(balance.textContent).not.toContain('Te pasaste')
    expect(screen.queryByText(/Gastos contra/)).toBeNull()
  })

  it('el mes actual aclara que todavía no terminó al compararlo', () => {
    abrirApp()
    tocar('Mes')
    expect(screen.getByText(/el mes todavía no terminó/)).toBeTruthy()
  })
})

describe('Familia (demo)', () => {
  function irAFamilia() {
    const repositorio = abrirApp()
    tocar('Familia')
    return repositorio
  }
  const escribir = (etiqueta: string, valor: string) =>
    fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })

  it('valida en castellano antes de invitar', () => {
    irAFamilia()
    escribir('Apodo', 'Sofi')
    escribir('Cuenta de Google (Gmail)', 'sofi-sin-arroba')
    tocar('Invitar')
    expect(screen.getByRole('alert').textContent).toBe('Ese email no parece válido.')
    escribir('Cuenta de Google (Gmail)', 'mica@ejemplo.com')
    expect(screen.queryByRole('alert')).toBeNull()
    tocar('Invitar')
    expect(screen.getByRole('alert').textContent).toBe('Ya es parte de la familia.')
  })

  it('el dueño invita y quita, con Deshacer', async () => {
    const repositorio = irAFamilia()
    const emails = () => repositorio.leer().integrantes.map((i) => i.email)
    escribir('Apodo', 'Sofi')
    escribir('Cuenta de Google (Gmail)', 'Sofi@Ejemplo.com')
    tocar('Invitar')
    // Invitar y quitar esperan la respuesta (en la versión real, de Google).
    await waitFor(() => expect(emails()).toContain('sofi@ejemplo.com'))
    expect(screen.getByRole('status', { name: 'Avisos' }).textContent).toContain(
      'En la demo no hay link para mandar',
    )
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Quitar' })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' }).at(-1)!)
    await waitFor(() => expect(emails()).not.toContain('sofi@ejemplo.com'))
    tocar('Deshacer')
    await waitFor(() => expect(emails()).toContain('sofi@ejemplo.com'))
  })

  it('cada uno cambia su apodo: no vacío ni repetido, y se ve en el encabezado', async () => {
    const repositorio = irAFamilia()
    tocar('Cambiar mi apodo')
    const hoja = screen.getByRole('dialog', { name: 'Tu apodo' })
    const campo = within(hoja).getByLabelText('Así te ven los demás en la app')
    fireEvent.change(campo, { target: { value: 'mica' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar' }))
    expect(within(hoja).getByRole('alert').textContent).toBe(
      'Ya hay alguien con ese apodo en la familia.',
    )
    fireEvent.change(campo, { target: { value: '  Nicolás ' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repositorio.leer().integrantes[0]!.apodo).toBe('Nicolás')
    expect(screen.getByRole('banner').textContent).toContain('Nicolás')
  })

  it('no deja invitar como integrante a un chico que solo carga', () => {
    irAFamilia()
    escribir('Apodo', 'Juli')
    escribir('Cuenta de Google (Gmail)', 'juli@ejemplo.com')
    tocar('Invitar')
    expect(screen.getByRole('alert').textContent).toContain('solo carga')
  })

  it('el dueño suma un chico que solo carga, y lo quita con Deshacer', async () => {
    const repositorio = irAFamilia()
    const chicos = () =>
      repositorio
        .leer()
        .chicos.filter((c) => !c.borrado)
        .map((c) => c.email)
    const seccion = () => screen.getByRole('region', { name: 'Chicos que solo cargan' })
    expect(within(seccion()).getByText('Juli')).toBeTruthy()
    fireEvent.change(within(seccion()).getByLabelText('Apodo del chico'), {
      target: { value: 'Tomi' },
    })
    fireEvent.change(within(seccion()).getByLabelText('Su cuenta de Google (Gmail)'), {
      target: { value: 'Tomi@Ejemplo.com' },
    })
    fireEvent.click(within(seccion()).getByRole('button', { name: 'Sumar un chico' }))
    await waitFor(() => expect(chicos()).toContain('tomi@ejemplo.com'))
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Tomi' }))
    await waitFor(() => expect(chicos()).not.toContain('tomi@ejemplo.com'))
    tocar('Deshacer')
    await waitFor(() => expect(chicos()).toContain('tomi@ejemplo.com'))
  })

  it('un integrante que no es dueño no puede invitar ni quitar', () => {
    const repositorio = abrirApp()
    repositorio.demo.cambiarYo('mica@ejemplo.com')
    tocar('Familia')
    expect(screen.queryByRole('button', { name: 'Invitar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull()
    // Ve a los chicos, pero no los suma ni los quita.
    expect(screen.getByText('Solo el dueño suma o quita chicos.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Quitar a Juli' })).toBeNull()
  })
})

describe('Rol solo carga (demo)', () => {
  it('en Mes, lo de los chicos va aparte del balance', () => {
    const repositorio = abrirApp()
    tocar('Mes')
    const chicos = screen.getByRole('region', { name: 'Los chicos' })
    expect(within(chicos).getByText('Juli')).toBeTruthy()
    expect(within(chicos).getByText(/no suma al balance/)).toBeTruthy()
    // Lo de Juli no entra en los gastos del mes de la familia.
    const deJuli = repositorio.leer().deLosChicos.map((m) => m.id)
    expect(repositorio.leer().movimientos.some((m) => deJuli.includes(m.id))).toBe(false)
  })

  it('como Juli: Cargar, Lista, Mes y Ajustes (solo el tema), sin Familia ni elegir quién', () => {
    const repositorio = abrirApp()
    act(() => repositorio.demo.cambiarYo('juli@ejemplo.com'))
    const secciones = screen.getByRole('navigation', { name: 'Secciones' })
    expect(
      within(secciones)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cargar', 'Lista', 'Mes', 'Ajustes'])
    expect(screen.queryByRole('button', { name: /^Quién:/ })).toBeNull()
    tocar('Ajustes')
    expect(screen.queryByText('Agregar tarjeta')).toBeNull()
    expect(screen.getByRole('group', { name: 'Tema' })).toBeTruthy()
  })
})
