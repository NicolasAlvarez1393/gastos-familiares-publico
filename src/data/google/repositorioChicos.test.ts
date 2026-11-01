import { describe, expect, it } from 'vitest'
import { armarMovimientos } from '../../domain/movimientos.ts'
import type { Movimiento } from '../../domain/tipos.ts'
import { SinAcceso } from '../errores.ts'
import { almacenEnMemoria } from './almacenLocal.ts'
import { crearNubeFalsa } from './nubeFalsa.ts'
import {
  chicoAFila,
  COLUMNAS_CHICOS,
  COLUMNAS_MOVIMIENTOS,
  PESTANIAS_AGREGABLES,
  type Celda,
} from './planilla.ts'
import { crearRepositorioGoogle, type PlanillaElegida } from './repositorioGoogle.ts'

// El rol "solo carga" (Etapa 10): la planilla de la familia y la de cada chico, con sus permisos.
const NICO = 'nico@ejemplo.com'
const MICA = 'mica@ejemplo.com'
const JULI = 'juli@ejemplo.com'
const FAMILIA: PlanillaElegida = { id: 'familia', url: '', duenio: NICO }

let reloj = 0
const ahora = () => new Date(Date.UTC(2026, 9, 17, 12) + ++reloj * 1000).toISOString()
let n = 0

function gasto(pesos: number, nota: string, quien: string): Movimiento {
  return armarMovimientos(
    {
      tipo: 'gasto',
      monto: pesos * 100,
      categoria: 'comida',
      nota,
      quien,
      medio: 'efectivo',
      fecha: '2026-10-17',
      cuotas: 1,
      mesesHastaPrimera: 0,
    },
    { nuevoId: () => `id-${++n}`, ahora: ahora() },
  )[0]!
}

async function familiaConJuli() {
  const nube = crearNubeFalsa({
    familia: {
      pestanias: {
        Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[]],
        Integrantes: [
          ['email', 'apodo', 'color'],
          [NICO, 'Nico', 1],
          [MICA, 'Mica', 2],
        ],
        ...Object.fromEntries(
          PESTANIAS_AGREGABLES.map((p) => [p.titulo, structuredClone(p.filas)]),
        ),
      },
      permisos: [
        { id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nicolás' },
        { id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Micaela' },
      ],
    },
  })
  const abrir = (email: string, planilla: PlanillaElegida = FAMILIA) =>
    crearRepositorioGoogle({
      api: nube.apiDe(email),
      almacen: almacenEnMemoria(),
      email,
      planilla,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
      etiqueta: 'gastosFamiliares',
    })
  const nico = await abrir(NICO)
  await nico.sincronizacion.sincronizar()
  const juli = await nico.sumarChico({ email: ' Juli@Ejemplo.com ', apodo: 'Juli' })
  const suya = nube.planillas.get(juli.planilla)!
  const abrirJuli = () => abrir(JULI, { id: juli.planilla, url: '', duenio: null, tipo: 'chico' })
  return { nube, abrir, nico, juli, suya, abrirJuli, familia: nube.planillas.get('familia')! }
}

describe('repositorio real: rol solo carga (Etapa 10)', () => {
  it('el dueño suma un chico: su planilla, etiquetada, compartida sin mail, y anotado en Chicos', async () => {
    const { nube, nico, juli, suya, familia } = await familiaConJuli()
    expect(juli).toMatchObject({ email: JULI, apodo: 'Juli', borrado: false })
    expect(suya.ordenDePestanias()).toEqual(['Léeme', 'Movimientos', 'Config'])
    expect(suya.pestaniasProtegidas()).toEqual(suya.ordenDePestanias())
    expect(suya.permisos.map((p) => [p.email, p.rol])).toEqual([
      [NICO, 'owner'],
      [JULI, 'writer'],
    ])
    expect(nube.etiquetas.get(juli.planilla)).toBe('gastosFamiliares:chico')
    const invitacion = suya.pedidos.find(
      (p) => p.metodo === 'POST' && p.url.includes('/permissions'),
    )!
    expect(new URL(invitacion.url).searchParams.get('sendNotificationEmail')).toBe('false')
    expect(nico.linkDeChico(juli)).toBe(`https://app.ejemplo.com/?unirse=${juli.planilla}`)
    expect(familia.hoja.Chicos).toEqual([[...COLUMNAS_CHICOS], chicoAFila(juli)])
    expect(nico.leer().chicos).toEqual([juli])
    // Un color que no usa nadie de la familia.
    expect(juli.color).toBe(3)
  })

  it('el chico abre su planilla: solo carga, lo suyo sube ahí, y no ve la de la familia', async () => {
    const { nube, suya, abrirJuli } = await familiaConJuli()
    const chico = await abrirJuli()
    await chico.sincronizacion.sincronizar()
    expect(chico.sincronizacion.leer().estado).toBe('al-dia')
    expect(chico.leer().soloCarga).toBe(true)
    chico.agregar([gasto(4500, 'Merienda', JULI)])
    await chico.sincronizacion.sincronizar()
    expect(suya.hoja.Movimientos!.map((f) => f[5])).toEqual(['nota', 'Merienda'])
    // A su planilla no le agrega nada de la familia (tarjetas, fijos, chicos…).
    expect(suya.ordenDePestanias()).toEqual(['Léeme', 'Movimientos', 'Config'])
    expect(chico.leer().tarjetas).toEqual([])
    await expect(
      nube
        .apiDe(JULI)
        .pedir('https://sheets.googleapis.com/v4/spreadsheets/familia/values/Movimientos!A:P'),
    ).rejects.toBeInstanceOf(SinAcceso)
  })

  it('el dueño copia lo del chico a De los chicos, aparte del balance, y solo si cambió', async () => {
    const { nico, suya, abrirJuli, familia } = await familiaConJuli()
    const chico = await abrirJuli()
    const merienda = gasto(4500, 'Merienda', JULI)
    chico.agregar([merienda])
    await chico.sincronizacion.sincronizar()

    await nico.sincronizacion.sincronizar()
    expect(familia.hoja['De los chicos']!.map((f) => f[5])).toEqual(['nota', 'Merienda'])
    expect(nico.leer().deLosChicos.map((m) => m.nota)).toEqual(['Merienda'])
    expect(nico.leer().movimientos).toEqual([])

    // Sin cambios en su planilla, no la vuelve a leer (la versión de Drive no cambió).
    const lecturasDeLaSuya = suya.lecturasDeSheets()
    await nico.sincronizacion.sincronizar()
    expect(suya.lecturasDeSheets()).toBe(lecturasDeLaSuya)

    // El chico corrige el monto: se actualiza la misma fila, sin duplicar.
    chico.actualizar([merienda.id], { monto: 5_000_00 })
    await chico.sincronizacion.sincronizar()
    await nico.sincronizacion.sincronizar()
    expect(familia.hoja['De los chicos']).toHaveLength(2)
    expect(familia.hoja['De los chicos']![1]![3]).toBe(5000)
    expect(nico.leer().deLosChicos[0]!.monto).toBe(5_000_00)
  })

  it('Mica ve lo del chico con la lectura de siempre, pero no lo copia', async () => {
    const { nube, nico, abrir, abrirJuli } = await familiaConJuli()
    const chico = await abrirJuli()
    chico.agregar([gasto(3000, 'SUBE', JULI)])
    await chico.sincronizacion.sincronizar()
    await nico.sincronizacion.sincronizar()

    const mica = await abrir(MICA)
    const lecturas = nube.lecturasDeSheets()
    await mica.sincronizacion.sincronizar()
    expect(mica.leer().deLosChicos.map((m) => m.nota)).toEqual(['SUBE'])
    expect(mica.leer().chicos.map((c) => c.apodo)).toEqual(['Juli'])
    expect(nube.lecturasDeSheets() - lecturas).toBe(1)
  })

  it('quitar al chico le saca el acceso a su planilla; Deshacer se lo devuelve', async () => {
    const { nico, juli, suya, abrirJuli } = await familiaConJuli()
    const chico = await abrirJuli()
    await chico.sincronizacion.sincronizar()

    await nico.quitarChico(juli)
    expect(suya.permisos.map((p) => p.email)).toEqual([NICO])
    expect(nico.leer().chicos[0]!.borrado).toBe(true)
    await chico.sincronizacion.sincronizar()
    expect(chico.sincronizacion.leer().estado).toBe('sin-acceso')

    await nico.restaurarChico(nico.leer().chicos[0]!)
    expect(suya.permisos.map((p) => p.email)).toEqual([NICO, JULI])
    expect(nico.leer().chicos[0]!.borrado).toBe(false)
    const ultimo = suya.pedidos
      .filter((p) => p.metodo === 'POST' && p.url.includes('/permissions'))
      .at(-1)!
    expect(new URL(ultimo.url).searchParams.get('sendNotificationEmail')).toBe('false')
  })

  it('si la planilla de un chico ya no está, la pasada del dueño sigue igual', async () => {
    const { nube, nico, juli } = await familiaConJuli()
    nube.planillas.delete(juli.planilla)
    nico.agregar([gasto(1000, 'Pan', NICO)])
    await nico.sincronizacion.sincronizar()
    expect(nico.sincronizacion.leer().estado).toBe('al-dia')
  })
})
