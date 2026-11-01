import { describe, expect, it } from 'vitest'
import { armarMovimientos } from '../../domain/movimientos.ts'
import type { Movimiento } from '../../domain/tipos.ts'
import { almacenEnMemoria } from './almacenLocal.ts'
import { crearGoogleFalso } from './googleFalso.ts'
import {
  COLUMNAS_MOVIMIENTOS,
  movimientoAFila,
  PESTANIA_LEEME,
  PESTANIAS_AGREGABLES,
  PESTANIAS_DE_CONFIG,
  type Celda,
} from './planilla.ts'
import { crearRepositorioGoogle } from './repositorioGoogle.ts'

const NICO = 'nico@ejemplo.com'
const MICA = 'mica@ejemplo.com'
const PLANILLA = { id: 'planilla-1', url: 'https://docs.google.com/x', duenio: NICO }

let reloj = 0
const ahora = () => new Date(Date.UTC(2026, 9, 12, 12) + ++reloj * 1000).toISOString()
let n = 0
const nuevoId = () => `id-${++n}`

function gasto(pesos: number, nota: string, quien = NICO): Movimiento {
  return armarMovimientos(
    {
      tipo: 'gasto',
      monto: pesos * 100,
      categoria: 'super',
      nota,
      quien,
      medio: 'efectivo',
      fecha: '2026-10-12',
      cuotas: 1,
      mesesHastaPrimera: 0,
    },
    { nuevoId, ahora: ahora() },
  )[0]!
}

function escenario(filasIniciales: Movimiento[] = []) {
  const google = crearGoogleFalso({
    pestanias: {
      Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[], ...filasIniciales.map(movimientoAFila)],
      Integrantes: [
        ['email', 'apodo', 'color'],
        [NICO, 'Nico', 1],
        [MICA, 'Mica', 2],
      ],
      // Una planilla al día: con el Léeme y las pestañas de configuración (Etapa 9).
      ...Object.fromEntries(PESTANIAS_AGREGABLES.map((p) => [p.titulo, structuredClone(p.filas)])),
    },
    permisos: [
      { id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nicolás' },
      { id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Micaela' },
    ],
  })
  const almacen = almacenEnMemoria()
  const abrir = (email = NICO) =>
    crearRepositorioGoogle({
      api: google.api,
      almacen,
      email,
      planilla: PLANILLA,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
    })
  const filasDeLaHoja = () => google.hoja.Movimientos!.length - 1
  return { google, almacen, abrir, filasDeLaHoja }
}

describe('repositorio real: sincronización', () => {
  it('trae lo que cargó otro integrante y los integrantes desde los permisos', async () => {
    const { abrir } = escenario([gasto(2500, 'Helado', MICA)])
    const repo = await abrir()
    expect(repo.leer().movimientos).toHaveLength(0)
    await repo.sincronizacion.sincronizar()
    expect(repo.leer().movimientos.map((m) => m.nota)).toEqual(['Helado'])
    expect(repo.leer().integrantes.map((i) => [i.apodo, i.rol])).toEqual([
      ['Nico', 'dueño'],
      ['Mica', 'integrante'],
    ])
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
  })

  it('un gasto cargado queda pendiente al instante y se sube en la pasada', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const repo = await abrir()
    repo.agregar([gasto(1000, 'Super')])
    expect(repo.leer().movimientos).toHaveLength(1)
    expect(repo.sincronizacion.leer()).toMatchObject({ estado: 'pendiente' })
    expect(repo.sincronizacion.leer().pendientes.size).toBe(1)
    await repo.sincronizacion.sincronizar()
    expect(filasDeLaHoja()).toBe(1)
    expect(google.hoja.Movimientos![1]![COLUMNAS_MOVIMIENTOS.indexOf('monto')]).toBe(1000)
    expect(repo.sincronizacion.leer()).toMatchObject({ estado: 'al-dia' })
    expect(repo.sincronizacion.leer().pendientes.size).toBe(0)
  })

  it('sin señal guarda igual; queda pendiente y sube cuando vuelve la conexión', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const repo = await abrir()
    google.fallas.sinConexion = true
    repo.agregar([gasto(800, 'SUBE')])
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('sin-conexion')
    expect(repo.leer().movimientos).toHaveLength(1)
    google.fallas.sinConexion = false
    await repo.sincronizacion.sincronizar()
    expect(filasDeLaHoja()).toBe(1)
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
  })

  it('si la subida llegó pero la respuesta se perdió, el reintento no duplica', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const repo = await abrir()
    repo.agregar([gasto(1500, 'Pan')])
    google.fallas.perderRespuestaDelProximoAppend = true
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('sin-conexion')
    expect(filasDeLaHoja()).toBe(1) // llegó a la planilla
    await repo.sincronizacion.sincronizar()
    expect(filasDeLaHoja()).toBe(1) // y no se duplicó
    expect(repo.sincronizacion.leer().pendientes.size).toBe(0)
  })

  it('una edición hecha mientras se sube sigue pendiente y sale en la próxima vuelta', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    const m = gasto(100, 'Original')
    repo.agregar([m])
    google.fallas.alAgregar = () => {
      google.fallas.alAgregar = null
      repo.actualizar([m.id], { nota: 'Corregida' })
    }
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().pendientes.has(m.id)).toBe(true)
    expect(repo.leer().movimientos[0]!.nota).toBe('Corregida')
    await repo.sincronizacion.sincronizar()
    expect(google.hoja.Movimientos![1]![COLUMNAS_MOVIMIENTOS.indexOf('nota')]).toBe('Corregida')
  })

  it('borrar se sube como borrado lógico (la fila queda, marcada)', async () => {
    const m = gasto(300, 'Café')
    const { abrir, google, filasDeLaHoja } = escenario([m])
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    repo.borrar([m.id])
    await repo.sincronizacion.sincronizar()
    expect(filasDeLaHoja()).toBe(1)
    expect(google.hoja.Movimientos![1]![COLUMNAS_MOVIMIENTOS.indexOf('borrado')]).toBe(true)
  })

  it('una corrección hecha a mano en la planilla llega al teléfono', async () => {
    const m = gasto(300, 'Café')
    const { abrir, google } = escenario([m])
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    google.hoja.Movimientos![1]![COLUMNAS_MOVIMIENTOS.indexOf('nota')] = 'Café con medialunas'
    await repo.sincronizacion.sincronizar()
    expect(repo.leer().movimientos[0]!.nota).toBe('Café con medialunas')
  })

  it('si dejaron de compartirle la planilla, el estado es sin acceso (y no se pierde nada local)', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir(MICA)
    repo.agregar([gasto(50, 'Chicle', MICA)])
    google.fallas.sinAcceso = true
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('sin-acceso')
    expect(repo.leer().movimientos).toHaveLength(1)
  })

  it('cargar algo no tapa un problema a la vista (sin acceso sigue siendo sin acceso)', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir(MICA)
    google.fallas.sinAcceso = true
    await repo.sincronizacion.sincronizar()
    repo.agregar([gasto(10, 'Algo', MICA)])
    expect(repo.sincronizacion.leer().estado).toBe('sin-acceso')
    expect(repo.sincronizacion.leer().pendientes.size).toBe(1)
  })

  it('la copia local sobrevive a cerrar la app, con lo pendiente incluido', async () => {
    const { abrir, google } = escenario()
    google.fallas.sinConexion = true
    const repo = await abrir()
    repo.agregar([gasto(700, 'Verdulería')])
    await repo.sincronizacion.sincronizar()
    await new Promise((r) => setTimeout(r, 0)) // deja terminar el guardado local
    const otraVez = await abrir()
    expect(otraVez.leer().movimientos.map((m) => m.nota)).toEqual(['Verdulería'])
    expect(otraVez.sincronizacion.leer().pendientes.size).toBe(1)
  })
})

describe('repositorio real: pocas lecturas a Sheets (la cuota que limita la escala)', () => {
  it('una pasada completa lee movimientos e integrantes en un solo pedido', async () => {
    const { abrir, google } = escenario([gasto(100, 'Pan')])
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    expect(google.lecturasDeSheets()).toBe(1)
    expect(repo.leer().movimientos).toHaveLength(1)
    expect(repo.leer().integrantes).toHaveLength(2)
  })

  it('si la planilla no cambió, las pasadas livianas no la leen', async () => {
    const { abrir, google } = escenario([gasto(100, 'Pan')])
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    await repo.sincronizarLiviana()
    await repo.sincronizarLiviana()
    expect(google.lecturasDeSheets()).toBe(1)
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
  })

  it('cargar y editar después no relee la planilla, ni duplica la fila', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    const m = gasto(900, 'Kiosco')
    repo.agregar([m])
    await repo.sincronizarLiviana()
    repo.actualizar([m.id], { nota: 'Kiosco y diario' })
    await repo.sincronizarLiviana()
    expect(google.lecturasDeSheets()).toBe(1)
    expect(filasDeLaHoja()).toBe(1)
    expect(google.hoja.Movimientos![1]![COLUMNAS_MOVIMIENTOS.indexOf('nota')]).toBe(
      'Kiosco y diario',
    )
    expect(repo.sincronizacion.leer().pendientes.size).toBe(0)
  })

  it('si otro teléfono cambió la planilla, la pasada liviana lo trae', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    google.cambiarAMano((hoja) =>
      hoja.Movimientos!.push(movimientoAFila(gasto(50, 'Chicle', MICA))),
    )
    await repo.sincronizarLiviana()
    expect(repo.leer().movimientos.map((m) => m.nota)).toEqual(['Chicle'])
    expect(google.lecturasDeSheets()).toBe(2)
  })

  it('si la respuesta de una subida liviana se perdió, la próxima relee y no duplica', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    repo.agregar([gasto(1500, 'Pan')])
    google.fallas.perderRespuestaDelProximoAppend = true
    await repo.sincronizarLiviana()
    expect(repo.sincronizacion.leer().estado).toBe('sin-conexion')
    await repo.sincronizarLiviana()
    expect(filasDeLaHoja()).toBe(1)
    expect(repo.sincronizacion.leer()).toMatchObject({ estado: 'al-dia' })
  })

  it('aunque Drive no avise un cambio, una respuesta perdida no duplica la fila', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    google.fallas.versionCongelada = true
    repo.agregar([gasto(1500, 'Pan')])
    google.fallas.perderRespuestaDelProximoAppend = true
    await repo.sincronizarLiviana()
    await repo.sincronizarLiviana()
    expect(filasDeLaHoja()).toBe(1)
  })

  it('aunque Drive no avise un cambio, cada tantas pasadas livianas lee igual', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    google.fallas.versionCongelada = true
    google.cambiarAMano((hoja) =>
      hoja.Movimientos!.push(movimientoAFila(gasto(50, 'Chicle', MICA))),
    )
    for (let i = 0; i < 5; i++) await repo.sincronizarLiviana()
    expect(repo.leer().movimientos).toHaveLength(0)
    await repo.sincronizarLiviana()
    expect(repo.leer().movimientos.map((m) => m.nota)).toEqual(['Chicle'])
  })
})

describe('repositorio real: configuración (Etapa 9)', () => {
  const visa = { id: 'visa', nombre: 'Visa', cierre: 25, vencimiento: 5, borrado: false }

  it('una planilla vieja (sin las pestañas ni las columnas nuevas) se actualiza sola', async () => {
    const vieja = crearGoogleFalso({
      pestanias: {
        Movimientos: [
          [...COLUMNAS_MOVIMIENTOS.slice(0, 13)] as Celda[],
          movimientoAFila(gasto(100, 'Pan')).slice(0, 13),
        ],
        Integrantes: [
          ['email', 'apodo', 'color'],
          [NICO, 'Nico', 1],
        ],
      },
      permisos: [{ id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nico' }],
    })
    const repo = await crearRepositorioGoogle({
      api: vieja.api,
      almacen: almacenEnMemoria(),
      email: NICO,
      planilla: PLANILLA,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
    })
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
    expect(repo.leer().movimientos.map((m) => m.nota)).toEqual(['Pan'])
    expect(vieja.hoja.Tarjetas![0]).toEqual(PESTANIAS_DE_CONFIG[0]!.filas[0])
    expect(Object.keys(vieja.hoja)).toEqual(
      expect.arrayContaining(['Tarjetas', 'Fijos', 'Presupuestos']),
    )
    expect(vieja.hoja.Movimientos![0]!.slice(13)).toEqual(['tarjeta', 'fijo', 'etiqueta'])
    // El Léeme primero (es lo que se ve al abrirla) y todas las pestañas con el aviso.
    expect(vieja.ordenDePestanias()[0]).toBe('Léeme')
    expect(vieja.hoja['Léeme']).toEqual(PESTANIA_LEEME.filas)
    expect(vieja.pestaniasProtegidas()).toEqual(vieja.ordenDePestanias())

    // Y lo nuevo se guarda y se vuelve a leer bien.
    await repo.guardarTarjeta(visa)
    repo.agregar([{ ...gasto(500, 'Nafta'), medio: 'credito', tarjeta: 'visa' }])
    await repo.sincronizacion.sincronizar()
    const otraVez = await crearRepositorioGoogle({
      api: vieja.api,
      almacen: almacenEnMemoria(),
      email: NICO,
      planilla: PLANILLA,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
    })
    await otraVez.sincronizacion.sincronizar()
    expect(otraVez.leer().tarjetas).toEqual([{ ...visa, actualizado: expect.any(String) }])
    expect(otraVez.leer().movimientos.find((m) => m.nota === 'Nafta')?.tarjeta).toBe('visa')
  })

  it('guardar crea la fila; guardar de nuevo la cambia en su lugar; borrar es lógico', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    await repo.guardarTarjeta(visa)
    await repo.guardarTarjeta({ ...visa, nombre: 'Visa Galicia' })
    await repo.guardarTarjeta({ ...visa, nombre: 'Visa Galicia', borrado: true })
    expect(google.hoja.Tarjetas).toHaveLength(2)
    expect(google.hoja.Tarjetas![1]!.slice(0, 2)).toEqual(['visa', 'Visa Galicia'])
    expect(google.hoja.Tarjetas![1]!.at(-1)).toBe(true)
    expect(repo.leer().tarjetas).toEqual([
      { ...visa, nombre: 'Visa Galicia', borrado: true, actualizado: expect.any(String) },
    ])
  })

  it('fijos y presupuestos ida y vuelta (montos en pesos en la planilla)', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    const alquiler = {
      id: 'alquiler',
      tipo: 'gasto' as const,
      nombre: 'Alquiler',
      categoria: 'casa',
      monto: 450_000_00,
      medio: 'transferencia' as const,
      dia: 10,
      activo: true,
      borrado: false,
    }
    await repo.guardarFijo(alquiler)
    await repo.guardarPresupuesto({ categoria: 'super', monto: 400_000_00, borrado: false })
    await repo.guardarPresupuesto({ categoria: 'super', monto: 420_000_50, borrado: false })
    expect(google.hoja.Fijos![1]![4]).toBe(450_000)
    expect(google.hoja.Presupuestos).toHaveLength(2)
    expect(google.hoja.Presupuestos![1]![1]).toBe(420_000.5)

    const otro = await abrir(MICA)
    await otro.sincronizacion.sincronizar()
    expect(otro.leer().fijos).toEqual([{ ...alquiler, actualizado: expect.any(String) }])
    expect(otro.leer().presupuestos.map((p) => p.monto)).toEqual([420_000_50])
  })

  it('una fila de configuración rota en la planilla se descarta sin romper nada', async () => {
    const { abrir, google } = escenario()
    google.hoja.Tarjetas!.push(['', 'Sin id', '', '', '', false])
    google.hoja.Fijos!.push([
      'x',
      'gasto',
      'Luz',
      'servicios',
      'no es plata',
      'debito',
      '',
      5,
      true,
      '',
      false,
    ])
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    expect(repo.leer().tarjetas).toEqual([])
    expect(repo.leer().fijos).toEqual([])
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
  })

  it('sin señal no se puede cambiar la configuración, y no cambia nada local', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    google.fallas.sinConexion = true
    await expect(repo.guardarTarjeta(visa)).rejects.toThrow('Sin conexión')
    expect(repo.leer().tarjetas).toEqual([])
  })
})

describe('repositorio real: categorías propias (Etapa 10)', () => {
  it('en una planilla vieja: renombra la fila que ya estaba, completa el encabezado y suma la propia', async () => {
    const { abrir, google } = escenario()
    google.hoja.Categorias = [
      ['id', 'tipo', 'nombre', 'icono'],
      ['super', 'gasto', 'Super', '🛒'],
    ]
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    await repo.guardarCategoria({
      id: 'super',
      tipo: 'gasto',
      nombre: 'Supermercado',
      icono: '🛒',
      oculta: false,
      borrado: false,
    })
    await repo.guardarCategoria({
      id: 'p1',
      tipo: 'gasto',
      nombre: 'Mascotas',
      icono: 'perro',
      oculta: false,
      borrado: false,
    })
    expect(google.hoja.Categorias![0]).toEqual([
      'id',
      'tipo',
      'nombre',
      'icono',
      'oculta',
      'actualizado',
      'borrado',
    ])
    expect(google.hoja.Categorias!.map((f) => f[2])).toEqual(['nombre', 'Supermercado', 'Mascotas'])

    // Otro teléfono lo lee en la pasada de siempre (sin pedidos de más).
    const otro = await crearRepositorioGoogle({
      api: google.api,
      almacen: almacenEnMemoria(),
      email: MICA,
      planilla: PLANILLA,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
    })
    await otro.sincronizacion.sincronizar()
    expect(otro.leer().categorias.map((c) => c.nombre)).toEqual(['Supermercado', 'Mascotas'])
  })
})

describe('repositorio real: metas (Etapa 10)', () => {
  it('se guardan en su pestaña y otro teléfono las lee en la pasada de siempre', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    const meta = {
      id: 'm1',
      nombre: 'Vacaciones',
      objetivo: 1_500_000_00,
      juntado: 600_000_00,
      mes: '2027-01',
      borrado: false,
    }
    await repo.guardarMeta(meta)
    await repo.guardarMeta({ ...meta, juntado: 650_000_00 })
    expect(google.hoja.Metas!.length).toBe(2)
    const otro = await abrir(MICA)
    await otro.sincronizacion.sincronizar()
    expect(otro.leer().metas).toMatchObject([
      { nombre: 'Vacaciones', juntado: 650_000_00, mes: '2027-01' },
    ])
    expect(google.lecturasDeSheets()).toBeGreaterThan(0)
  })
})

describe('repositorio real: ahorros (Etapa 10)', () => {
  it('se guardan en su pestaña con su moneda y otro teléfono los lee en la pasada de siempre', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    const lecturas = google.lecturasDeSheets()
    const dolares = {
      id: 'a1',
      nombre: 'Dólares en casa',
      moneda: 'USD' as const,
      monto: 1_000_00,
      borrado: false,
    }
    await repo.guardarAhorro(dolares)
    await repo.guardarAhorro({ ...dolares, monto: 1_200_00 })
    expect(google.hoja.Ahorros).toEqual([
      ['id', 'nombre', 'moneda', 'monto', 'actualizado', 'borrado'],
      ['a1', 'Dólares en casa', 'USD', 1200, expect.any(String), false],
    ])
    // Guardar lee la pestaña (para saber en qué fila va): una lectura por vez.
    expect(google.lecturasDeSheets() - lecturas).toBe(2)
    const antesDeMica = google.lecturasDeSheets()
    const otro = await abrir(MICA)
    await otro.sincronizacion.sincronizar()
    expect(otro.leer().ahorros).toMatchObject([
      { nombre: 'Dólares en casa', moneda: 'USD', monto: 1_200_00 },
    ])
    // Los ahorros viajan en el pedido de siempre: el otro teléfono no gasta una lectura más.
    expect(google.lecturasDeSheets() - antesDeMica).toBe(1)
  })
})

describe('repositorio real: el Drive del dueño lleno', () => {
  it('no es "sin acceso": lo cargado queda pendiente, lo de los demás se ve, y se sube al liberar espacio', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const mica = await abrir(MICA)
    await mica.sincronizacion.sincronizar()
    google.fallas.driveLleno = true
    // Nico cargó algo antes de que se llenara (desde otro teléfono).
    google.cambiarAMano((h) => h.Movimientos!.push(movimientoAFila(gasto(700, 'Nafta', NICO))))
    mica.agregar([gasto(300, 'Pan', MICA)])
    const lecturas = google.lecturasDeSheets()
    await mica.sincronizacion.sincronizar()

    const info = mica.sincronizacion.leer()
    expect(info.estado).toBe('sin-espacio')
    expect(info.pendientes.size).toBe(1)
    // Leer sigue andando: se ve lo de Nico, y lo de Mica sigue en el teléfono.
    expect(
      mica
        .leer()
        .movimientos.map((m) => m.nota)
        .sort(),
    ).toEqual(['Nafta', 'Pan'])
    // Una sola lectura, como cualquier pasada: no se relee de más por el error.
    expect(google.lecturasDeSheets() - lecturas).toBe(1)
    expect(filasDeLaHoja()).toBe(1)

    google.fallas.driveLleno = false
    await mica.sincronizacion.sincronizar()
    expect(mica.sincronizacion.leer().estado).toBe('al-dia')
    expect(filasDeLaHoja()).toBe(2)
  })

  it('como responde Google de verdad (un 403 que no dice por qué): para un integrante es el Drive lleno', async () => {
    const { abrir, google, filasDeLaHoja } = escenario()
    const mica = await abrir(MICA)
    await mica.sincronizacion.sincronizar()
    google.fallas.noDejaEscribir = true
    google.fallas.cuentaLlena = true
    mica.agregar([gasto(300, 'Pan', MICA)])
    await mica.sincronizacion.sincronizar()
    expect(mica.sincronizacion.leer().estado).toBe('sin-espacio')
    expect(mica.sincronizacion.leer().pendientes.size).toBe(1)
    expect(mica.leer().movimientos.map((m) => m.nota)).toEqual(['Pan'])

    google.fallas.noDejaEscribir = false
    google.fallas.cuentaLlena = false
    await mica.sincronizacion.sincronizar()
    expect(mica.sincronizacion.leer().estado).toBe('al-dia')
    expect(filasDeLaHoja()).toBe(1)
  })

  it('el dueño lo confirma preguntándole a Drive por su espacio (si tiene lugar, no es eso)', async () => {
    const { abrir, google } = escenario()
    const nico = await abrir()
    await nico.sincronizacion.sincronizar()
    google.fallas.noDejaEscribir = true
    google.fallas.cuentaLlena = true
    nico.agregar([gasto(300, 'Pan')])
    await nico.sincronizacion.sincronizar()
    expect(nico.sincronizacion.leer().estado).toBe('sin-espacio')
    expect(google.pedidos.some((p) => p.url.includes('/drive/v3/about'))).toBe(true)

    google.fallas.cuentaLlena = false
    await nico.sincronizacion.sincronizar()
    expect(nico.sincronizacion.leer().estado).toBe('sin-acceso')
  })

  it('guardar algo de Ajustes con el Drive lleno falla con su propio error, no con "sin acceso"', async () => {
    const { abrir, google } = escenario()
    const nico = await abrir()
    await nico.sincronizacion.sincronizar()
    google.fallas.driveLleno = true
    await expect(
      nico.guardarTarjeta({ id: 'visa', nombre: 'Visa', borrado: false }),
    ).rejects.toThrow('El Drive del dueño está lleno')
  })
})

describe('repositorio real: el nombre de la planilla lleva el del dueño', () => {
  function conNombre(nombre: string) {
    const { google, almacen } = escenario()
    google.archivos.push({ id: PLANILLA.id, name: nombre, owner: NICO })
    const abrir = (email = NICO) =>
      crearRepositorioGoogle({
        api: google.api,
        almacen,
        email,
        planilla: PLANILLA,
        urlApp: 'https://app.ejemplo.com',
        ahora,
        automatico: false,
        nombreBase: 'Gastos Familiares',
      })
    return { google, abrir }
  }

  it('la de antes ("Gastos Familiares") pasa a "Gastos Familiares - nico", una sola vez', async () => {
    const { google, abrir } = conNombre('Gastos Familiares')
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    expect(google.archivos[0]!.name).toBe('Gastos Familiares - nico')
    const pedidos = google.pedidos.length
    await repo.sincronizacion.sincronizar()
    expect(google.pedidos.slice(pedidos).some((p) => p.url.includes('fields=name'))).toBe(false)
  })

  it('si alguien la renombró a mano, se respeta; y un integrante no la toca', async () => {
    const aMano = conNombre('Gastos de casa')
    await (await aMano.abrir()).sincronizacion.sincronizar()
    expect(aMano.google.archivos[0]!.name).toBe('Gastos de casa')

    const deMica = conNombre('Gastos Familiares')
    await (await deMica.abrir(MICA)).sincronizacion.sincronizar()
    expect(deMica.google.archivos[0]!.name).toBe('Gastos Familiares')
  })
})

describe('repositorio real: la planilla, a salvo de ediciones a mano', () => {
  it('si Google no deja proteger, la planilla vieja se actualiza igual', async () => {
    const vieja = crearGoogleFalso({
      pestanias: {
        Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[]],
        Integrantes: [
          ['email', 'apodo', 'color'],
          [MICA, 'Mica', 2],
        ],
      },
      permisos: [{ id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Mica' }],
    })
    vieja.fallas.sinPermisoParaProteger = true
    const repo = await crearRepositorioGoogle({
      api: vieja.api,
      almacen: almacenEnMemoria(),
      email: MICA,
      planilla: PLANILLA,
      urlApp: 'https://app.ejemplo.com',
      ahora,
      automatico: false,
    })
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
    expect(vieja.ordenDePestanias()[0]).toBe('Léeme')
    expect(vieja.pestaniasProtegidas()).toEqual([])
  })

  it('si alguien borra el Léeme a mano, vuelve solo; si no, no gasta lecturas', async () => {
    const { abrir, google } = escenario([gasto(100, 'Pan')])
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    expect(google.lecturasDeSheets()).toBe(1)

    google.cambiarAMano((hoja) => delete hoja['Léeme'])
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
    expect(google.ordenDePestanias()[0]).toBe('Léeme')
    expect(google.hoja['Léeme']).toEqual(PESTANIA_LEEME.filas)
  })
})

describe('repositorio real: quién ya entró', () => {
  it('la primera vez que abre la planilla, el integrante lo anota (una sola vez)', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir(MICA)
    await repo.sincronizacion.sincronizar()
    const entro = google.hoja.Integrantes![2]![3]
    expect(entro).toMatch(/^2026-10-12T/)
    const escrituras = () =>
      google.pedidos.filter((p) => p.url.endsWith('/values:batchUpdate')).length
    const antes = escrituras()
    await repo.sincronizacion.sincronizar()
    expect(escrituras()).toBe(antes)
    expect(google.hoja.Integrantes![2]![3]).toBe(entro)
    expect(repo.leer().integrantes.find((i) => i.email === MICA)?.yaEntro).toBe(true)
  })

  it('el dueño ve quién todavía no entró', async () => {
    const { abrir } = escenario()
    const repo = await abrir(NICO)
    await repo.sincronizacion.sincronizar()
    expect(repo.leer().integrantes.map((i) => [i.apodo, i.yaEntro])).toEqual([
      ['Nico', true],
      ['Mica', false],
    ])
  })

  it('si no puede anotarlo, la sincronización sigue igual', async () => {
    const { abrir, google } = escenario([gasto(100, 'Pan')])
    const repo = await abrir(MICA)
    const pedir = google.api.pedir.bind(google.api)
    google.api.pedir = async (url, init) => {
      if (url.endsWith('/values:batchUpdate')) throw new Error('falla rara')
      return pedir(url, init)
    }
    await repo.sincronizacion.sincronizar()
    expect(repo.sincronizacion.leer().estado).toBe('al-dia')
    expect(repo.leer().movimientos).toHaveLength(1)
  })
})

describe('repositorio real: familia', () => {
  it('cambiar el apodo propio escribe su fila de Integrantes, y otro teléfono lo ve', async () => {
    const { abrir, google } = escenario()
    const mica = await abrir(MICA)
    await mica.sincronizacion.sincronizar()
    const lecturas = google.lecturasDeSheets()
    await mica.cambiarApodo('  Micaela ')
    expect(google.hoja.Integrantes![2]!.slice(0, 2)).toEqual([MICA, 'Micaela'])
    expect(mica.leer().integrantes.find((i) => i.email === MICA)?.apodo).toBe('Micaela')
    // Una sola lectura (para saber la fila): es un cambio raro.
    expect(google.lecturasDeSheets() - lecturas).toBe(1)
    const nico = await abrir(NICO)
    await nico.sincronizacion.sincronizar()
    expect(nico.leer().integrantes.find((i) => i.email === MICA)?.apodo).toBe('Micaela')
  })

  it('invitar comparte la planilla sin el mail de Google y anota apodo y color', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    const juli = await repo.agregarIntegrante({ email: 'Juli@Ejemplo.com', apodo: 'Juli' })
    expect(juli).toEqual({ email: 'juli@ejemplo.com', apodo: 'Juli', rol: 'integrante', color: 3 })
    expect(google.permisos.map((p) => p.email)).toContain('juli@ejemplo.com')
    const invitacion = google.pedidos.find(
      (p) => p.metodo === 'POST' && p.url.includes('/permissions'),
    )!
    const params = new URL(invitacion.url).searchParams
    // Sin el mail de Google (habla de una hoja de cálculo): la invitación es el link de la app.
    expect(params.get('sendNotificationEmail')).toBe('false')
    expect(params.get('emailMessage')).toBeNull()
    expect(repo.linkDeInvitacion).toBe('https://app.ejemplo.com/?unirse=planilla-1')
    expect(google.hoja.Integrantes!.at(-1)).toEqual(['juli@ejemplo.com', 'Juli', 3, '', ''])
  })

  it('Gmail sin el punto: la cuenta invitada con punto se reconoce, anota que entró y guarda su apodo', async () => {
    const google = crearGoogleFalso({
      pestanias: {
        Movimientos: [[...COLUMNAS_MOVIMIENTOS] as Celda[]],
        // Como quedó en la planilla del usuario (2026-10-18): la invitación con el punto y, abajo,
        // la fila que agregó el apodo nuevo con el email sin el punto.
        Integrantes: [
          ['email', 'apodo', 'color', 'entro', 'salio'],
          [NICO, 'Nico', 1],
          ['ana.prueba@gmail.com', 'Test', 3],
          ['anaprueba@gmail.com', 'Anita', 3],
        ],
        ...Object.fromEntries(
          PESTANIAS_AGREGABLES.map((p) => [p.titulo, structuredClone(p.filas)]),
        ),
      },
      permisos: [
        { id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nico' },
        { id: '3', tipo: 'user', rol: 'writer', email: 'ana.prueba@gmail.com', nombre: '' },
      ],
    })
    const abrir = (email: string) =>
      crearRepositorioGoogle({
        api: google.api,
        almacen: almacenEnMemoria(),
        email,
        planilla: PLANILLA,
        urlApp: 'https://app.ejemplo.com',
        ahora,
        automatico: false,
      })
    // Entra con el email sin el punto (como lo da Google al loguearse).
    const ana = await abrir('anaprueba@gmail.com')
    await ana.sincronizacion.sincronizar()
    expect(ana.leer().yo).toBe('ana.prueba@gmail.com')
    expect(ana.leer().integrantes.find((i) => i.email === 'ana.prueba@gmail.com')?.apodo).toBe(
      'Anita',
    )
    // Anotó que entró en su última fila (la que manda).
    expect(google.hoja.Integrantes![3]![3]).toEqual(expect.stringMatching(/^2026-/))

    await ana.cambiarApodo('Ani')
    expect(google.hoja.Integrantes![3]![1]).toBe('Ani')

    const nico = await abrir(NICO)
    await nico.sincronizacion.sincronizar()
    expect(nico.leer().integrantes.find((i) => i.email === 'ana.prueba@gmail.com')).toMatchObject({
      apodo: 'Ani',
      yaEntro: true,
    })
  })

  it('quitar le saca el permiso; restaurar lo devuelve, también sin mail', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    const mica = repo.leer().integrantes.find((i) => i.email === MICA)!
    await repo.quitarIntegrante(MICA)
    expect(google.permisos.map((p) => p.email)).not.toContain(MICA)
    expect(repo.leer().integrantes.map((i) => i.email)).not.toContain(MICA)
    await repo.restaurarIntegrante(mica)
    expect(google.permisos.map((p) => p.email)).toContain(MICA)
    const ultimo = google.pedidos
      .filter((p) => p.metodo === 'POST' && p.url.includes('/permissions'))
      .at(-1)!
    expect(new URL(ultimo.url).searchParams.get('sendNotificationEmail')).toBe('false')
  })

  it('invitar sin señal falla con un error claro y no cambia nada', async () => {
    const { abrir, google } = escenario()
    const repo = await abrir()
    await repo.sincronizacion.sincronizar()
    google.fallas.sinConexion = true
    await expect(
      repo.agregarIntegrante({ email: 'juli@ejemplo.com', apodo: 'Juli' }),
    ).rejects.toThrow('Sin conexión')
    expect(repo.leer().integrantes).toHaveLength(2)
  })
})
