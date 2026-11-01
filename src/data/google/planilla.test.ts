import { describe, expect, it } from 'vitest'
import { datosDeEjemplo } from '../demo/semilla.ts'
import {
  ahorroAFila,
  categoriaAFila,
  chicoAFila,
  COLUMNAS_CHICOS,
  filaDeMovimientos,
  filasAChicos,
  pestaniasDeChico,
  RANGO_DE_LOS_CHICOS,
  tipoDeConfig,
  COLUMNAS_AHORROS,
  COLUMNAS_CATEGORIAS,
  COLUMNAS_METAS,
  COLUMNAS_MOVIMIENTOS,
  filasAAhorros,
  filasACategorias,
  filasAMetas,
  metaAFila,
  filaDeIntegrante,
  filasAIntegrantes,
  filasConSalida,
  filasDeIntegrante,
  filasAMovimientos,
  integrantesDesdePermisos,
  movimientoAFila,
  pestaniasIniciales,
  serialAFecha,
  type Celda,
  type Permiso,
} from './planilla.ts'

const { movimientos } = datosDeEjemplo('2026-10-12')
const encabezado = [...COLUMNAS_MOVIMIENTOS] as Celda[]

describe('movimientos ⇄ filas', () => {
  it('ida y vuelta sin perder nada (incluidas las cuotas)', () => {
    const filas = [encabezado, ...movimientos.map(movimientoAFila)]
    const { movimientos: leidos, descartadas } = filasAMovimientos(filas)
    expect(descartadas).toBe(0)
    expect(leidos).toEqual(movimientos)
  })

  it('en la planilla la plata va en pesos', () => {
    const fila = movimientoAFila({ ...movimientos[0]!, monto: 250_050 })
    expect(fila[COLUMNAS_MOVIMIENTOS.indexOf('monto')]).toBe(2500.5)
  })

  it('ubica cada id en su fila de la hoja (contando el encabezado, desde 1)', () => {
    const filas = [encabezado, movimientoAFila(movimientos[0]!), movimientoAFila(movimientos[1]!)]
    const { filaPorId } = filasAMovimientos(filas)
    expect(filaPorId.get(movimientos[0]!.id)).toBe(2)
    expect(filaPorId.get(movimientos[1]!.id)).toBe(3)
  })

  it('lee por nombre de columna: tolera columnas agregadas o movidas a mano', () => {
    const m = movimientos[0]!
    const reordenado = ['comentario a mano', ...[...COLUMNAS_MOVIMIENTOS].reverse()]
    const fila = ['algo', ...movimientoAFila(m).reverse()]
    expect(filasAMovimientos([reordenado, fila]).movimientos[0]).toEqual(m)
  })

  it('descarta filas rotas y saltea las vacías', () => {
    const rota = movimientoAFila(movimientos[0]!)
    rota[COLUMNAS_MOVIMIENTOS.indexOf('monto')] = 'mucho'
    const vacia = encabezado.map(() => '')
    const r = filasAMovimientos([encabezado, rota, vacia, movimientoAFila(movimientos[1]!)])
    expect(r.descartadas).toBe(1)
    expect(r.movimientos).toHaveLength(1)
  })

  it('entiende una fecha que alguien tipeó a mano en Sheets (número de serie)', () => {
    expect(serialAFecha(46307)).toBe('2026-10-12')
    const fila = movimientoAFila(movimientos[0]!)
    fila[COLUMNAS_MOVIMIENTOS.indexOf('fecha')] = 46307
    fila[COLUMNAS_MOVIMIENTOS.indexOf('borrado')] = 'TRUE'
    const [m] = filasAMovimientos([encabezado, fila]).movimientos
    expect(m).toMatchObject({ fecha: '2026-10-12', borrado: true })
  })
})

describe('etiqueta ⇄ fila', () => {
  it('la etiqueta va en su columna y vuelve; en blanco, no queda', () => {
    const [m] = movimientos
    const con = { ...m!, etiqueta: 'Vacaciones 2027' }
    expect(filasAMovimientos([encabezado, movimientoAFila(con)]).movimientos[0]).toEqual(con)
    expect(filasAMovimientos([encabezado, movimientoAFila(m!)]).movimientos[0]).not.toHaveProperty(
      'etiqueta',
    )
  })
})

describe('metas ⇄ filas', () => {
  it('ida y vuelta, con y sin mes; un mes mal escrito se ignora y una sin objetivo no entra', () => {
    const conMes = {
      id: 'm1',
      nombre: 'Vacaciones',
      objetivo: 1_500_000_00,
      juntado: 600_000_50,
      mes: '2027-01',
      actualizado: '2026-10-17T12:00:00Z',
      borrado: false,
    }
    const { mes: _, ...sinMes } = { ...conMes, id: 'm2' }
    expect(filasAMetas([[...COLUMNAS_METAS], metaAFila(conMes), metaAFila(sinMes)])).toEqual([
      conMes,
      sinMes,
    ])
    expect(
      filasAMetas([
        [...COLUMNAS_METAS],
        ['m3', 'Auto', 100, 0, 'enero', '', false],
        ['m4', 'Nada', 0, 0, '', '', false],
      ]),
    ).toEqual([
      { id: 'm3', nombre: 'Auto', objetivo: 100_00, juntado: 0, actualizado: '', borrado: false },
    ])
  })
})

describe('ahorros ⇄ filas', () => {
  it('ida y vuelta en pesos y en dólares, con centavos', () => {
    const dolares = {
      id: 'a1',
      nombre: 'Dólares en casa',
      moneda: 'USD' as const,
      monto: 1_200_50,
      actualizado: '2026-10-17T12:00:00Z',
      borrado: false,
    }
    const pesos = { ...dolares, id: 'a2', nombre: 'Plazo fijo', moneda: 'ARS' as const }
    expect(ahorroAFila(dolares)).toEqual([
      'a1',
      'Dólares en casa',
      'USD',
      1200.5,
      '2026-10-17T12:00:00Z',
      false,
    ])
    expect(
      filasAAhorros([[...COLUMNAS_AHORROS], ahorroAFila(dolares), ahorroAFila(pesos)]),
    ).toEqual([dolares, pesos])
  })

  it('la moneda escrita a mano se entiende; si no, esa fila no entra', () => {
    const fila = (id: string, moneda: string) => [id, 'Algo', moneda, 10, '', false]
    const leidos = filasAAhorros([
      [...COLUMNAS_AHORROS],
      fila('a', 'Dólares'),
      fila('b', 'US$'),
      fila('c', 'u$s'),
      fila('d', 'pesos'),
      fila('e', '$'),
      fila('f', 'euros'),
      fila('g', ''),
    ])
    expect(leidos.map((a) => [a.id, a.moneda])).toEqual([
      ['a', 'USD'],
      ['b', 'USD'],
      ['c', 'USD'],
      ['d', 'ARS'],
      ['e', 'ARS'],
    ])
  })
})

describe('chicos (rol solo carga)', () => {
  it('ida y vuelta; el email en minúsculas y una fila sin planilla no entra', () => {
    const juli = {
      planilla: 'planilla-juli',
      email: 'juli@ejemplo.com',
      apodo: 'Juli',
      color: 3,
      actualizado: '2026-10-17T12:00:00Z',
      borrado: false,
    }
    expect(
      filasAChicos([
        [...COLUMNAS_CHICOS],
        chicoAFila(juli),
        ['planilla-tomi', 'Tomi@Ejemplo.com', 'Tomi', 4, '', true],
        ['', 'nadie@ejemplo.com', 'Nadie', 1, '', false],
      ]),
    ).toEqual([
      juli,
      {
        ...juli,
        planilla: 'planilla-tomi',
        email: 'tomi@ejemplo.com',
        apodo: 'Tomi',
        color: 4,
        actualizado: '',
        borrado: true,
      },
    ])
  })

  it('la pestaña de lo que cargaron va entre comillas en los rangos (tiene espacios)', () => {
    expect(RANGO_DE_LOS_CHICOS).toBe("'De los chicos'!A:P")
    expect(filaDeMovimientos(7, 'De los chicos')).toBe("'De los chicos'!A7:P7")
    expect(filaDeMovimientos(7)).toBe('Movimientos!A7:P7')
  })

  it('la planilla del chico: Léeme, Movimientos y Config con tipo chico', () => {
    const p = pestaniasDeChico('2026-10-17T12:00:00Z')
    expect(p.map((x) => x.titulo)).toEqual(['Léeme', 'Movimientos', 'Config'])
    expect(p[1]!.filas).toEqual([encabezado])
    expect(tipoDeConfig(p[2]!.filas)).toBe('chico')
  })

  it('tipoDeConfig: familia, chico o de ninguna app', () => {
    expect(
      tipoDeConfig([
        ['clave', 'valor'],
        ['schema_version', 2],
      ]),
    ).toBe('familia')
    expect(
      tipoDeConfig([
        ['clave', 'valor'],
        ['schema_version', 2],
        ['tipo', 'chico'],
      ]),
    ).toBe('chico')
    expect(tipoDeConfig([['algo', 'otro']])).toBeNull()
    expect(tipoDeConfig([])).toBeNull()
  })
})

describe('categorías ⇄ filas', () => {
  it('ida y vuelta; con el encabezado viejo (4 columnas) se leen igual, sin esconder nada', () => {
    const propia = {
      id: 'p1',
      tipo: 'gasto' as const,
      nombre: 'Mascotas',
      icono: 'perro',
      oculta: true,
      actualizado: '2026-10-17T12:00:00Z',
      borrado: false,
    }
    expect(filasACategorias([[...COLUMNAS_CATEGORIAS], categoriaAFila(propia)])).toEqual([propia])
    const vieja = filasACategorias([
      ['id', 'tipo', 'nombre', 'icono'],
      ['super', 'gasto', 'Super', '🛒'],
      ['rota', 'otro', 'Mal', ''],
    ])
    expect(vieja).toEqual([
      {
        id: 'super',
        tipo: 'gasto',
        nombre: 'Super',
        icono: '🛒',
        oculta: false,
        actualizado: '',
        borrado: false,
      },
    ])
  })
})

describe('integrantesDesdePermisos', () => {
  const permiso = (p: Partial<Permiso>): Permiso => ({
    id: 'p',
    tipo: 'user',
    rol: 'writer',
    email: '',
    nombre: '',
    ...p,
  })

  it('el dueño primero; apodo y color de la pestaña, o del nombre de Google', () => {
    const integrantes = integrantesDesdePermisos(
      [
        permiso({ email: 'mica@ejemplo.com', nombre: 'Micaela Pérez' }),
        permiso({ email: 'Nico@Ejemplo.com', rol: 'owner' }),
        permiso({ tipo: 'anyone', rol: 'reader' }),
        permiso({ email: 'lector@ejemplo.com', rol: 'reader' }),
      ],
      filasAIntegrantes([
        ['email', 'apodo', 'color'],
        ['nico@ejemplo.com', 'Nico', 1],
      ]),
    )
    expect(integrantes).toEqual([
      { email: 'nico@ejemplo.com', apodo: 'Nico', rol: 'dueño', color: 1, yaEntro: false },
      { email: 'mica@ejemplo.com', apodo: 'Micaela', rol: 'integrante', color: 2, yaEntro: false },
    ])
  })

  it('sabe quién ya abrió la planilla desde la app (columna entro)', () => {
    const integrantes = integrantesDesdePermisos(
      [
        permiso({ email: 'nico@ejemplo.com', rol: 'owner' }),
        permiso({ email: 'mica@ejemplo.com' }),
      ],
      filasAIntegrantes([
        ['email', 'apodo', 'color', 'entro'],
        ['nico@ejemplo.com', 'Nico', 1, '2026-10-12T15:00:00Z'],
        ['mica@ejemplo.com', 'Mica', 2],
      ]),
    )
    expect(integrantes.map((i) => [i.apodo, i.yaEntro])).toEqual([
      ['Nico', true],
      ['Mica', false],
    ])
  })
})

describe('filaDeIntegrante', () => {
  const filas = [
    ['email', 'apodo', 'color'],
    ['nico@ejemplo.com', 'Nico', 1],
    ['Mica@Ejemplo.com', 'Mica', 2],
  ]

  it('da la fila de la hoja (1 = encabezados), sin importar mayúsculas', () => {
    expect(filaDeIntegrante(filas, 'nico@ejemplo.com')).toBe(2)
    expect(filaDeIntegrante(filas, 'mica@ejemplo.com')).toBe(3)
  })

  it('null si no está (o si alguien se llama "email")', () => {
    expect(filaDeIntegrante(filas, 'otra@ejemplo.com')).toBeNull()
    expect(filaDeIntegrante(filas, 'email')).toBeNull()
  })
})

describe('integrantes: la misma cuenta de Gmail con o sin puntos', () => {
  const filas = [
    ['email', 'apodo', 'color', 'entro', 'salio'],
    ['ana.prueba@gmail.com', 'Test', 3, '', ''],
    ['anaprueba@gmail.com', 'Anita', '', '2026-10-18T10:00:00Z', ''],
  ] as Celda[][]

  it('dos filas de la misma cuenta se juntan: de cada columna, lo último escrito', () => {
    expect(filasAIntegrantes(filas).get('anaprueba@gmail.com')).toEqual({
      email: 'ana.prueba@gmail.com',
      apodo: 'Anita',
      color: 3,
      entro: '2026-10-18T10:00:00Z',
      salio: '',
    })
  })

  it('la fila de la cuenta es la última, escriba el email como lo escriba', () => {
    expect(filaDeIntegrante(filas, 'ana.prueba@gmail.com')).toBe(3)
    expect(filaDeIntegrante(filas, 'AnaPrueba@Gmail.com')).toBe(3)
    expect(filaDeIntegrante(filas, 'otra@gmail.com')).toBeNull()
  })

  it('todas las filas de la cuenta, y las que dicen que salió (para volver hay que borrarlas todas)', () => {
    const conSalida = [
      ...filas,
      ['otra@gmail.com', 'Otra', 4, '', '2026-10-18T11:00:00Z'],
      ['ana.prueba@gmail.com', 'Ana', 3, '', '2026-10-18T12:00:00Z'],
    ] as Celda[][]
    expect(filasDeIntegrante(conSalida, 'anaprueba@gmail.com')).toEqual([2, 3, 5])
    expect(filasConSalida(conSalida, 'anaprueba@gmail.com')).toEqual([5])
    expect(filasConSalida(filas, 'anaprueba@gmail.com')).toEqual([])
    expect(filasAIntegrantes(conSalida).get('anaprueba@gmail.com')?.salio).toBe(
      '2026-10-18T12:00:00Z',
    )
  })

  it('el permiso de Drive con el punto encuentra el apodo y el color de la pestaña', () => {
    const [ana] = integrantesDesdePermisos(
      [{ id: '3', tipo: 'user', rol: 'writer', email: 'ana.prueba@gmail.com', nombre: '' }],
      filasAIntegrantes(filas),
    )
    expect(ana).toMatchObject({ email: 'ana.prueba@gmail.com', apodo: 'Anita', color: 3 })
  })
})

describe('pestaniasIniciales', () => {
  it('crea las pestañas con encabezados y al dueño como primer integrante', () => {
    const p = pestaniasIniciales(
      { email: 'nico@ejemplo.com', apodo: 'Nico' },
      '2026-10-12T15:00:00Z',
    )
    expect(p.map((x) => x.titulo)).toEqual([
      'Léeme',
      'Movimientos',
      'Categorias',
      'Integrantes',
      'Config',
      'Tarjetas',
      'Fijos',
      'Metas',
      'Ahorros',
      'Presupuestos',
      'Chicos',
      'De los chicos',
    ])
    expect(p[0]!.filas[0]![0]).toContain('base de datos de la app')
    expect(p[1]!.filas).toEqual([encabezado])
    expect(p[3]!.filas[0]).toEqual(['email', 'apodo', 'color', 'entro', 'salio'])
    expect(p[3]!.filas[1]).toEqual(['nico@ejemplo.com', 'Nico', 1, '2026-10-12T15:00:00Z'])
  })
})
