import { describe, expect, it } from 'vitest'
import { armarMovimientos } from '../../domain/movimientos.ts'
import { almacenEnMemoria } from './almacenLocal.ts'
import { crearNubeFalsa } from './nubeFalsa.ts'
import { COLUMNAS_MOVIMIENTOS, PESTANIAS_AGREGABLES, type Celda } from './planilla.ts'
import { crearRepositorioGoogle, type PlanillaElegida } from './repositorioGoogle.ts'

// Salir de la familia (integrante) y borrar la familia (dueño): para liberar una cuenta de Google.
const NICO = 'nico@ejemplo.com'
const MICA = 'mica@ejemplo.com'
const JULI = 'juli@ejemplo.com'
const FAMILIA: PlanillaElegida = { id: 'familia', url: '', duenio: NICO }

let reloj = 0
const ahora = () => new Date(Date.UTC(2026, 9, 18, 12) + ++reloj * 1000).toISOString()

async function familia() {
  const nube = crearNubeFalsa({
    familia: {
      pestanias: {
        Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[]],
        Integrantes: [
          ['email', 'apodo', 'color', 'entro', 'salio'],
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
  const abrir = async (
    email: string,
    planilla: PlanillaElegida = FAMILIA,
    extra: { elegidaRecien?: boolean } = {},
  ) => {
    const repo = await crearRepositorioGoogle({
      api: nube.apiDe(email),
      almacen: almacenEnMemoria(),
      email,
      planilla,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
      etiqueta: 'gastosFamiliares',
      ...extra,
    })
    await repo.sincronizacion.sincronizar()
    return repo
  }
  const planilla = nube.planillas.get('familia')!
  const correos = () => planilla.permisos.map((p) => p.email)
  return { nube, abrir, planilla, correos }
}

describe('repositorio real: salir de la familia', () => {
  it('un integrante sale: se saca el acceso y deja de ver la planilla', async () => {
    const { abrir, correos } = await familia()
    const mica = await abrir(MICA)
    await mica.salirDeLaFamilia!()
    expect(correos()).toEqual([NICO])
    await mica.sincronizacion.sincronizar()
    expect(mica.sincronizacion.leer().estado).toBe('sin-acceso')
  })

  it('si Google no lo deja sacarse solo: queda anotado y la app del dueño se lo saca', async () => {
    const { nube, abrir, planilla, correos } = await familia()
    nube.reglas.soloElDuenioQuitaPermisos = true
    const mica = await abrir(MICA)
    await mica.salirDeLaFamilia!()
    expect(planilla.hoja.Integrantes![2]![4]).toEqual(expect.stringMatching(/^2026-/))
    expect(correos()).toEqual([NICO, MICA])

    const nico = await abrir(NICO)
    expect(correos()).toEqual([NICO])
    expect(nico.leer().integrantes.map((i) => i.email)).toEqual([NICO])
  })

  it('sale y la vuelve a elegir (el link) antes de que el dueño le saque el acceso: está de vuelta', async () => {
    // El caso del usuario (2026-10-18): Google no la deja sacarse sola, queda anotado que salió, y
    // vuelve con el link. Antes quedaba escondida para todos y la app del dueño la echaba.
    const { nube, abrir, planilla, correos } = await familia()
    nube.reglas.soloElDuenioQuitaPermisos = true
    const mica = await abrir(MICA)
    await mica.salirDeLaFamilia!()
    mica.cerrar()

    const deVuelta = await abrir(MICA, FAMILIA, { elegidaRecien: true })
    expect(deVuelta.sincronizacion.leer().estado).toBe('al-dia')
    expect(deVuelta.leer().integrantes.map((i) => i.email)).toEqual([NICO, MICA])
    expect(planilla.hoja.Integrantes![2]![4]).toBe('')

    const nico = await abrir(NICO)
    expect(correos()).toEqual([NICO, MICA])
    expect(nico.leer().integrantes.map((i) => i.email)).toEqual([NICO, MICA])
  })

  it('salió desde otro teléfono: en este (que no la volvió a elegir) queda sin acceso y no sube nada', async () => {
    const { nube, abrir, planilla } = await familia()
    nube.reglas.soloElDuenioQuitaPermisos = true
    const telefono = await abrir(MICA)
    const compu = await abrir(MICA)
    await compu.salirDeLaFamilia!()

    telefono.agregar(
      armarMovimientos(
        {
          tipo: 'gasto',
          monto: 50000,
          categoria: 'super',
          nota: 'Pan',
          quien: MICA,
          medio: 'efectivo',
          fecha: '2026-10-18',
          cuotas: 1,
          mesesHastaPrimera: 0,
        },
        { nuevoId: () => 'pan', ahora: ahora() },
      ),
    )
    await telefono.sincronizacion.sincronizar()
    expect(telefono.sincronizacion.leer().estado).toBe('sin-acceso')
    expect(planilla.hoja.Movimientos).toHaveLength(1)
  })

  it('el dueño la vuelve a invitar: se borra la salida de todas sus filas (Gmail con o sin puntos)', async () => {
    const { abrir, planilla, correos } = await familia()
    const ANA = 'ana.prueba@gmail.com'
    // Salió anotado en la fila con el punto; abajo quedó otra sin él (de antes del arreglo).
    planilla.hoja.Integrantes!.push(
      [ANA, 'Ana', 3, '2026-10-18T10:00:00Z', '2026-10-18T11:00:00Z'],
      ['anaprueba@gmail.com', 'Ana', 3, '', ''],
    )
    const nico = await abrir(NICO)
    expect(nico.leer().integrantes.map((i) => i.email)).toEqual([NICO, MICA])

    await nico.agregarIntegrante({ email: ANA, apodo: 'Ana' })
    expect(correos()).toEqual([NICO, MICA, ANA])
    const ana = await abrir(ANA)
    expect(ana.leer().integrantes.map((i) => i.email)).toEqual([NICO, MICA, ANA])
    await nico.sincronizacion.sincronizar()
    expect(nico.leer().integrantes.map((i) => i.email)).toEqual([NICO, MICA, ANA])
    expect(correos()).toEqual([NICO, MICA, ANA])
  })

  it('el dueño borra la familia: nadie más tiene acceso y las planillas van a la papelera', async () => {
    const { nube, abrir, planilla, correos } = await familia()
    const nico = await abrir(NICO)
    const juli = await nico.sumarChico({ email: JULI, apodo: 'Juli' })
    const mica = await abrir(MICA)

    await nico.salirDeLaFamilia!()
    expect(correos()).toEqual([NICO])
    expect(planilla.enLaPapelera()).toBe(true)
    const suya = nube.planillas.get(juli.planilla)!
    expect(suya.permisos.map((p) => p.email)).toEqual([NICO])
    expect(suya.enLaPapelera()).toBe(true)

    await mica.sincronizacion.sincronizar()
    expect(mica.sincronizacion.leer().estado).toBe('sin-acceso')
  })
})
