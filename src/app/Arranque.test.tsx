// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClienteAuth } from '../auth/sesion.ts'
import { SinConexion, SinSesion } from '../data/errores.ts'
import { almacenEnMemoria } from '../data/google/almacenLocal.ts'
import { crearGoogleFalso } from '../data/google/googleFalso.ts'
import { COLUMNAS_MOVIMIENTOS, type Celda } from '../data/google/planilla.ts'
import { claveLocal } from '../data/google/repositorioGoogle.ts'
import { Arranque } from './Arranque.tsx'
import { guardarSesionLocal, leerSesionLocal } from './sesionLocal.ts'

const NICO = 'nico@ejemplo.com'
const MICA = 'mica@ejemplo.com'
const HOST = 'gastos.ejemplo.com'

function authFalsa(resultado: 'ok' | 'sin-sesion' | 'sin-conexion', email = NICO): ClienteAuth {
  return {
    token: vi.fn(async () => {
      if (resultado === 'sin-sesion') throw new SinSesion()
      if (resultado === 'sin-conexion') throw new SinConexion()
      return 'token'
    }),
    email: () => (resultado === 'ok' ? email : null),
    invalidar: vi.fn(),
    entrar: vi.fn(),
    elegirPlanilla: vi.fn(),
    salir: vi.fn(async () => {}),
  }
}

function google(conPlanilla: boolean) {
  return crearGoogleFalso({
    pestanias: {
      Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[]],
      Integrantes: [
        ['email', 'apodo', 'color'],
        [NICO, 'Nico', 1],
      ],
    },
    permisos: [{ id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nico' }],
    archivos: conPlanilla
      ? [{ id: 'p1', name: 'Gastos Familiares', owner: NICO, etiqueta: 'gastosFamiliares' }]
      : [],
  })
}

function arrancar(o: {
  auth: ClienteAuth
  g?: ReturnType<typeof google>
  search?: string
  almacen?: ReturnType<typeof almacenEnMemoria>
}) {
  const limpiarUrl = vi.fn()
  render(
    <Arranque
      auth={o.auth}
      api={(o.g ?? google(true)).api}
      almacen={o.almacen ?? almacenEnMemoria()}
      ubicacion={{ hostname: HOST, origin: `https://${HOST}`, search: o.search ?? '' }}
      limpiarUrl={limpiarUrl}
    />,
  )
  return { limpiarUrl }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(cleanup)

describe('Arranque', () => {
  it('el botón para abrir la planilla a mano lo ve solo el dueño', async () => {
    const g = google(true)
    g.permisos.push({ id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Mica' })
    for (const [email, loVe] of [
      [NICO, true],
      [MICA, false],
    ] as const) {
      localStorage.clear()
      arrancar({ auth: authFalsa('ok', email), g })
      fireEvent.click(await screen.findByRole('button', { name: /^Tu cuenta/ }))
      await screen.findByRole('dialog')
      expect(Boolean(screen.queryByText('Abrir la planilla en Google Sheets'))).toBe(loVe)
      cleanup()
    }
  })

  it('sin sesión muestra la entrada; un error de login se explica y se limpia la URL', async () => {
    const auth = authFalsa('sin-sesion')
    const { limpiarUrl } = arrancar({ auth, search: '?error_login=permisos' })
    expect(await screen.findByRole('button', { name: 'Entrar con Google' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('permiso de Google Drive')
    expect(limpiarUrl).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar con Google' }))
    expect(auth.entrar).toHaveBeenCalled()
  })

  it('sin las claves de Google en Cloudflare, la entrada lo explica (no dice "sin conexión")', async () => {
    const auth = authFalsa('sin-sesion')
    auth.token = vi.fn(async () => {
      throw new SinSesion('configuracion')
    })
    arrancar({ auth })
    expect((await screen.findByRole('alert')).textContent).toContain('faltan las claves de Google')
    expect(screen.queryByText('Sin conexión')).toBeNull()
  })

  it('con sesión y la planilla encontrada, abre la app y recuerda la sesión', async () => {
    arrancar({ auth: authFalsa('ok') })
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    expect(screen.queryByText('DEMO')).toBeNull()
    expect(leerSesionLocal()).toMatchObject({ email: NICO, planilla: { id: 'p1', duenio: NICO } })
  })

  it('primera vez sin planilla: la crea, la etiqueta y abre la app', async () => {
    const g = google(false)
    arrancar({ auth: authFalsa('ok'), g })
    fireEvent.click(await screen.findByRole('button', { name: 'Crear la planilla' }))
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    // Con el nombre del dueño, para distinguirla de otras planillas de la app.
    expect(g.archivos[0]).toMatchObject({
      name: 'Gastos Familiares - nico',
      etiqueta: 'gastosFamiliares',
    })
    expect(g.hoja.Movimientos![0]).toEqual([...COLUMNAS_MOVIMIENTOS])
    expect(g.hoja.Integrantes![1]).toEqual([NICO, 'Nico', 1, expect.stringMatching(/^20/)])
  })

  it('crear la planilla con el Google lleno: lo dice (no "sin acceso"), con el link; al liberar, anda', async () => {
    // El caso de una usuaria (2026-10-21): Google respondió 403 sin decir que era por el espacio.
    const g = google(false)
    g.fallas.noDejaEscribir = true
    g.fallas.cuentaLlena = true
    arrancar({ auth: authFalsa('ok'), g })
    fireEvent.click(await screen.findByRole('button', { name: 'Crear la planilla' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Tu Google está lleno/)
    expect(screen.getByRole('link', { name: 'Ver mi espacio en Google' })).toBeTruthy()
    expect(screen.queryByText(/compartida con vos/)).toBeNull()

    g.fallas.noDejaEscribir = false
    g.fallas.cuentaLlena = false
    fireEvent.click(screen.getByRole('button', { name: 'Crear la planilla' }))
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
  })

  it('si Google no deja crear la planilla y no se sabe por qué, igual sugiere mirar el espacio', async () => {
    const g = google(false)
    g.fallas.noDejaEscribir = true
    arrancar({ auth: authFalsa('ok'), g })
    fireEvent.click(await screen.findByRole('button', { name: 'Crear la planilla' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /^Google no dejó crear la planilla/,
    )
    expect(screen.getByRole('link', { name: 'Ver mi espacio en Google' })).toBeTruthy()
  })

  it('invitado sin entrar: la bienvenida dice quién invitó y los dos pasos; Empezar entra con Google', async () => {
    const auth = authFalsa('sin-sesion')
    arrancar({ auth, search: '?unirse=p9abcdefgh&de=Nico' })
    expect(
      await screen.findByRole('heading', { name: 'Nico te invitó a Gastos Familiares' }),
    ).toBeTruthy()
    expect(screen.getByText('Confirmá la planilla de la familia')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(auth.entrar).toHaveBeenCalled()
    expect(sessionStorage.getItem('gastos-familiares:unirse')).toBe('p9abcdefgh')
  })

  it('"No me invitaron" lleva a la entrada de siempre y olvida el link', async () => {
    arrancar({ auth: authFalsa('sin-sesion'), search: '?unirse=p9abcdefgh' })
    fireEvent.click(await screen.findByRole('button', { name: 'No me invitaron: ir al inicio' }))
    expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy()
    expect(sessionStorage.getItem('gastos-familiares:unirse')).toBeNull()
  })

  it('invitado que ya entró con Google: va directo al selector con la planilla del link, una sola vez', async () => {
    const auth = authFalsa('ok')
    arrancar({ auth, g: google(false), search: '?unirse=p9abcdefgh' })
    await waitFor(() => expect(auth.elegirPlanilla).toHaveBeenCalledWith('p9abcdefgh'))
    expect(screen.queryByRole('button', { name: 'Crear la planilla' })).toBeNull()
  })

  it('si el selector volvió sin la planilla: la pantalla de elegir, con elegir primero y crear escondido', async () => {
    const auth = authFalsa('ok')
    sessionStorage.setItem('gastos-familiares:unirse', 'p9abcdefgh')
    arrancar({ auth, g: google(false), search: '?error_eleccion=sin_archivo' })
    fireEvent.click(await screen.findByRole('button', { name: 'Elegir la planilla compartida' }))
    expect(auth.elegirPlanilla).toHaveBeenCalledWith('p9abcdefgh')
    expect(screen.queryByRole('button', { name: 'Crear la planilla' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: '¿No te invitaron? Crear una planilla nueva' }),
    )
    expect(screen.getByRole('button', { name: 'Crear la planilla' })).toBeTruthy()
  })

  it('al volver del selector con una planilla de la app, la abre y olvida el link', async () => {
    const g = google(false)
    g.hoja.Config = [
      ['clave', 'valor'],
      ['schema_version', 1],
    ]
    sessionStorage.setItem('gastos-familiares:unirse', 'planillaElegida1')
    const { limpiarUrl } = arrancar({
      auth: authFalsa('ok'),
      g,
      search: '?planilla_elegida=planillaElegida1',
    })
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    expect(leerSesionLocal()?.planilla).toMatchObject({ id: 'planillaElegida1', duenio: null })
    expect(sessionStorage.getItem('gastos-familiares:unirse')).toBeNull()
    expect(limpiarUrl).toHaveBeenCalled()
  })

  it('un chico que vuelve del selector con su planilla entra en solo carga', async () => {
    const g = google(false)
    g.hoja.Config = [
      ['clave', 'valor'],
      ['schema_version', 2],
      ['tipo', 'chico'],
    ]
    arrancar({
      auth: authFalsa('ok', 'juli@ejemplo.com'),
      g,
      search: '?planilla_elegida=planillaJuli1',
    })
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    expect(leerSesionLocal()?.planilla).toMatchObject({ id: 'planillaJuli1', tipo: 'chico' })
  })

  it('un chico en otro teléfono: la app encuentra su planilla por la etiqueta de chico', async () => {
    const g = google(false)
    g.archivos.push({
      id: 'planillaJuli1',
      name: 'Gastos de Juli (Gastos Familiares)',
      owner: NICO,
      etiqueta: 'gastosFamiliares:chico',
    })
    arrancar({ auth: authFalsa('ok', 'juli@ejemplo.com'), g })
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    expect(leerSesionLocal()?.planilla).toMatchObject({ id: 'planillaJuli1', tipo: 'chico' })
  })

  it('con su familia y el link de otra: avisa; "Quedarme" abre la suya y olvida el link', async () => {
    arrancar({ auth: authFalsa('ok'), search: '?unirse=otraFamilia123&de=Mica' })
    expect(
      await screen.findByRole('heading', { name: 'Mica te invitó a otra familia' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Quedarme en mi familia' }))
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    expect(sessionStorage.getItem('gastos-familiares:unirse')).toBeNull()
  })

  it('"Salir de mi familia y sumarme": el dueño la borra y va directo a la del link', async () => {
    const auth = authFalsa('ok')
    const g = google(true)
    arrancar({ auth, g, search: '?unirse=otraFamilia123' })
    fireEvent.click(await screen.findByRole('button', { name: 'Salir de mi familia y sumarme' }))
    const hoja = await screen.findByRole('dialog', { name: 'Borrar la familia' })
    expect(within(hoja).getByText(/la familia deja de existir/)).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: 'Borrar la familia' }))
    await waitFor(() => expect(auth.elegirPlanilla).toHaveBeenCalledWith('otraFamilia123'))
    expect(g.enLaPapelera()).toBe(true)
    expect(JSON.parse(localStorage.getItem('gastos-familiares:dejadas')!)).toEqual(['p1'])
  })

  it('un integrante sale desde Tu cuenta: pierde el acceso y la app no la vuelve a abrir sola', async () => {
    const g = google(true)
    g.permisos.push({ id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Mica' })
    arrancar({ auth: authFalsa('ok', MICA), g })
    fireEvent.click(await screen.findByRole('button', { name: /^Tu cuenta/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Salir de la familia' }))
    const hoja = await screen.findByRole('dialog', { name: 'Salir de la familia' })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Salir de la familia' }))
    expect(await screen.findByRole('button', { name: 'Crear la planilla' })).toBeTruthy()
    expect(g.permisos.map((p) => p.email)).toEqual([NICO])
  })

  /** Mica salió (Google no la dejó sacarse el acceso: quedó anotado) y la app de Nico todavía no se lo sacó. */
  function micaSalio() {
    const g = google(true)
    g.hoja.Config = [
      ['clave', 'valor'],
      ['schema_version', 2],
    ]
    g.permisos.push({ id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Mica' })
    g.hoja.Integrantes!.push([MICA, 'Mica', 2, '2026-10-18T10:00:00Z', '2026-10-18T11:00:00Z'])
    return g
  }

  it('salió y vuelve con el link: al volver del selector figura de nuevo y puede cambiar su apodo', async () => {
    const g = micaSalio()
    localStorage.setItem('gastos-familiares:dejadas', JSON.stringify(['planillaDeNico1']))
    arrancar({ auth: authFalsa('ok', MICA), g, search: '?planilla_elegida=planillaDeNico1' })
    fireEvent.click(await screen.findByRole('button', { name: 'Familia' }))
    expect(await screen.findByRole('button', { name: 'Cambiar mi apodo' })).toBeTruthy()
    expect(screen.getByText('(vos)')).toBeTruthy()
    expect(g.hoja.Integrantes![2]![4]).toBe('')
    expect(g.permisos.map((p) => p.email)).toEqual([NICO, MICA])
    // La app la puede volver a encontrar sola (en otra sesión, sin el link).
    expect(JSON.parse(localStorage.getItem('gastos-familiares:dejadas')!)).toEqual([])
  })

  it('salió desde otro teléfono: en este, que la tenía abierta, dice que ya no tiene acceso', async () => {
    const g = micaSalio()
    guardarSesionLocal({ email: MICA, planilla: { id: 'p1', url: '', duenio: NICO } })
    arrancar({ auth: authFalsa('ok', MICA), g })
    expect(
      await screen.findByText(/^Ya no tenés acceso a la planilla de la familia/, {
        selector: '[role="alert"] p',
      }),
    ).toBeTruthy()
    expect(g.hoja.Integrantes![2]![4]).toBe('2026-10-18T11:00:00Z')
  })

  it('salió desde otro teléfono y abre el link en este: vuelve', async () => {
    const g = micaSalio()
    guardarSesionLocal({ email: MICA, planilla: { id: 'p1', url: '', duenio: NICO } })
    arrancar({ auth: authFalsa('ok', MICA), g, search: '?unirse=p1&de=Nico' })
    fireEvent.click(await screen.findByRole('button', { name: 'Familia' }))
    expect(await screen.findByRole('button', { name: 'Cambiar mi apodo' })).toBeTruthy()
    expect(g.hoja.Integrantes![2]![4]).toBe('')
  })

  it('lo volvieron a invitar y abre el link donde la tenía, pero Google no la deja verla: al selector', async () => {
    const g = micaSalio()
    g.fallas.sinAcceso = true
    const auth = authFalsa('ok', MICA)
    guardarSesionLocal({ email: MICA, planilla: { id: 'planillaDeNico1', url: '', duenio: NICO } })
    arrancar({ auth, g, search: '?unirse=planillaDeNico1&de=Nico' })
    await waitFor(() => expect(auth.elegirPlanilla).toHaveBeenCalledWith('planillaDeNico1'))
  })

  it('si eligió una planilla que no es de la app, lo explica y deja elegir de nuevo', async () => {
    arrancar({ auth: authFalsa('ok'), g: google(false), search: '?planilla_elegida=otraPlanilla1' })
    expect((await screen.findByRole('alert')).textContent).toContain('no es de Gastos Familiares')
    expect(screen.getByRole('button', { name: 'Elegir la planilla compartida' })).toBeTruthy()
  })

  it('si Google no le dio acceso a la app a la elegida, ofrece los otros caminos', async () => {
    const g = google(false)
    g.fallas.sinAcceso = true
    arrancar({ auth: authFalsa('ok'), g, search: '?planilla_elegida=planillaElegida1' })
    expect((await screen.findByRole('alert')).textContent).toContain('Usar el otro selector')
    expect(screen.getByRole('button', { name: 'Usar el otro selector' })).toBeTruthy()
  })

  it('si Google volvió sin planilla, lo explica en la pantalla de elegir', async () => {
    arrancar({ auth: authFalsa('ok'), g: google(false), search: '?error_eleccion=sin_archivo' })
    expect((await screen.findByRole('alert')).textContent).toContain('no mostró la planilla')
  })

  it('si la eligió en otro lado (una compu), "buscarla de nuevo" la encuentra y abre la app', async () => {
    const g = google(false)
    // Ya pasó por el selector y no la eligió ahí: queda la pantalla de elegir.
    sessionStorage.setItem('gastos-familiares:unirse', 'p1')
    sessionStorage.setItem('gastos-familiares:fue-a-elegir', 'si')
    arrancar({ auth: authFalsa('ok'), g })
    expect(await screen.findByText(/gastos\.ejemplo\.com/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ya la elegí: buscarla de nuevo' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Todavía no la encuentro')
    g.archivos.push({ id: 'p1', name: 'Gastos Familiares', owner: 'otra@ejemplo.com' })
    fireEvent.click(screen.getByRole('button', { name: 'Ya la elegí: buscarla de nuevo' }))
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
    expect(leerSesionLocal()?.planilla.id).toBe('p1')
  })

  it('al volver a la app después de elegirla en otro lado, la encuentra sola', async () => {
    const g = google(false)
    arrancar({ auth: authFalsa('ok'), g })
    await screen.findByRole('button', { name: 'Crear la planilla' })
    g.archivos.push({ id: 'p1', name: 'Gastos Familiares', owner: 'otra@ejemplo.com' })
    document.dispatchEvent(new Event('visibilitychange'))
    // Más margen: al abrir, la app también prepara la planilla (pestañas de la Etapa 9).
    expect(
      await screen.findByRole('button', { name: 'Cargar', current: 'page' }, { timeout: 3000 }),
    ).toBeTruthy()
  })

  it('invitar abre "Mandale el link": por WhatsApp, con quién invita y sin mail de Google', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    try {
      arrancar({ auth: authFalsa('ok') })
      fireEvent.click(await screen.findByRole('button', { name: 'Familia' }))
      fireEvent.change(await screen.findByLabelText('Apodo'), { target: { value: 'Mica' } })
      fireEvent.change(screen.getByLabelText('Cuenta de Google (Gmail)'), {
        target: { value: MICA },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Invitar' }))
      const hoja = await screen.findByRole('dialog', { name: 'Mandale el link a Mica' })
      fireEvent.click(within(hoja).getByRole('button', { name: 'Mandar el link' }))
      await waitFor(() => expect(share).toHaveBeenCalled())
      expect(share.mock.calls[0]).toEqual([
        expect.objectContaining({
          url: `https://${HOST}/?unirse=p1&de=Nico`,
          text: expect.stringContaining(`Nico te invitó a Gastos Familiares`),
        }),
      ])
    } finally {
      Reflect.deleteProperty(navigator, 'share')
    }
  })

  it('Drive del dueño lleno, como integrante: lo explica (no es "sin acceso") y no deja borrar lo pendiente', async () => {
    const g = google(true)
    g.permisos.push({ id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Mica' })
    arrancar({ auth: authFalsa('ok', MICA), g })
    const teclado = await screen.findByRole('group', { name: 'Teclado numérico' })
    g.fallas.driveLleno = true
    fireEvent.click(within(teclado).getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Super' }))
    // Se sube solo enseguida: con el Drive lleno, el aviso.
    expect(
      await screen.findByText(/^El Drive de Nico está lleno/, {}, { timeout: 4000 }),
    ).toBeTruthy()
    expect(screen.queryByText(/Ya no tenés acceso/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Tu cuenta/ }))
    const cuenta = screen.getByRole('dialog', { name: 'Tu cuenta' })
    expect(
      within(cuenta).getByRole('button', { name: 'Cerrar sesión en este teléfono' }),
    ).toHaveProperty('disabled', true)
    fireEvent.click(within(cuenta).getByRole('button', { name: 'Salir de la familia' }))
    const salir = await screen.findByRole('dialog', { name: 'Salir de la familia' })
    expect(within(salir).getByRole('button', { name: 'Salir de la familia' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('Drive lleno, como dueño: le dice que es su Drive y cómo verlo', async () => {
    const g = google(true)
    arrancar({ auth: authFalsa('ok'), g })
    const teclado = await screen.findByRole('group', { name: 'Teclado numérico' })
    g.fallas.driveLleno = true
    fireEvent.click(within(teclado).getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Super' }))
    expect(
      await screen.findByText(/^Tu Google Drive está lleno/, {}, { timeout: 4000 }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver mi espacio en Google' })).toBeTruthy()
  })

  it('en Familia, "Sincronizar ahora" vuelve a leer la planilla', async () => {
    const g = google(true)
    arrancar({ auth: authFalsa('ok'), g })
    fireEvent.click(await screen.findByRole('button', { name: 'Familia' }))
    const boton = await screen.findByRole('button', { name: 'Sincronizar ahora' })
    await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false))
    const lecturas = g.lecturasDeSheets()
    fireEvent.click(boton)
    await waitFor(() => expect(g.lecturasDeSheets()).toBeGreaterThan(lecturas))
  })

  it('en Familia, el dueño ve quién ya entró a la app y quién todavía no', async () => {
    const g = crearGoogleFalso({
      pestanias: {
        Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[]],
        Integrantes: [
          ['email', 'apodo', 'color', 'entro'],
          [NICO, 'Nico', 1, '2026-10-12T15:00:00Z'],
          ['mica@ejemplo.com', 'Mica', 2, '2026-10-13T10:00:00Z'],
          ['juli@ejemplo.com', 'Juli', 3],
        ],
      },
      permisos: [
        { id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nico' },
        { id: '2', tipo: 'user', rol: 'writer', email: 'mica@ejemplo.com', nombre: 'Mica' },
        { id: '3', tipo: 'user', rol: 'writer', email: 'juli@ejemplo.com', nombre: 'Juli' },
      ],
      archivos: [
        { id: 'p1', name: 'Gastos Familiares', owner: NICO, etiqueta: 'gastosFamiliares' },
      ],
    })
    arrancar({ auth: authFalsa('ok'), g })
    fireEvent.click(await screen.findByRole('button', { name: 'Familia' }))
    const fila = async (apodo: string) =>
      (await screen.findByText(apodo, { selector: 'span' })).closest('li')!.textContent
    await waitFor(async () => expect(await fila('Mica')).toContain('Ya entró'))
    expect(await fila('Juli')).toContain('Todavía no entró')
  })

  it('sin señal, si ya se usó en este teléfono, abre con lo guardado', async () => {
    const almacen = almacenEnMemoria()
    const planilla = { id: 'p1', url: 'https://docs.google.com/x', duenio: NICO }
    guardarSesionLocal({ email: NICO, planilla })
    await almacen.guardar(claveLocal(NICO), {
      version: 1,
      planillaId: 'p1',
      movimientos: [],
      integrantes: [{ email: NICO, apodo: 'Nico', rol: 'dueño', color: 1 }],
      pendientes: [],
      ultima: null,
    })
    arrancar({ auth: authFalsa('sin-conexion'), almacen })
    expect(await screen.findByRole('button', { name: 'Cargar', current: 'page' })).toBeTruthy()
  })

  it('sin señal y sin nada guardado, explica que la primera vez hace falta internet', async () => {
    arrancar({ auth: authFalsa('sin-conexion') })
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('el atajo "Cargar un ingreso" abre Cargar con Ingreso elegido', async () => {
    arrancar({ auth: authFalsa('ok'), search: '?cargar=ingreso' })
    expect(await screen.findByRole('button', { name: 'Ingreso', pressed: true })).toBeTruthy()
  })

  it('el atajo "Ver el mes" abre en Mes (también en la demo)', async () => {
    arrancar({ auth: authFalsa('sin-sesion'), search: '?demo&ver=mes' })
    expect(await screen.findByRole('button', { name: 'Mes', current: 'page' })).toBeTruthy()
  })

  it('?demo abre la demo; "Salir de la demo" vuelve a la entrada', async () => {
    arrancar({ auth: authFalsa('sin-sesion'), search: '?demo' })
    fireEvent.click(await screen.findByRole('button', { name: /DEMO/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salir de la demo' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy(),
    )
  })
})
