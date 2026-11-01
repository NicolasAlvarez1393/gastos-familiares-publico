import { CATEGORIAS, MEDIOS } from '../../domain/catalogo.ts'
import { claveDeCuenta, mismaCuenta } from '../../domain/cuentas.ts'
import { normalizar } from '../../domain/textoRapido.ts'
import type {
  Ahorro,
  CategoriaGuardada,
  Chico,
  Fecha,
  Fijo,
  Integrante,
  MedioPago,
  Moneda,
  Movimiento,
  Meta,
  Presupuesto,
  Tarjeta,
} from '../../domain/tipos.ts'
import {
  esAhorroValido,
  esCategoriaGuardadaValida,
  esChicoValido,
  esFijoValido,
  esMetaValida,
  esMovimientoValido,
  esPresupuestoValido,
  esTarjetaValida,
} from '../validar.ts'

/**
 * Formato de la planilla (PROPUESTA.md §6): pestañas, columnas y la
 * conversión filas ⇄ objetos. Puro: sin pedidos a Google, con tests.
 *
 * Reglas: se escribe en modo RAW (sin fórmulas ni fechas "adivinadas"), la
 * plata va en PESOS en la planilla y en centavos en la app, y las columnas se
 * leen por NOMBRE (agregar una columna a mano no rompe nada).
 */

export const PESTANIAS = {
  leeme: 'Léeme',
  movimientos: 'Movimientos',
  categorias: 'Categorias',
  integrantes: 'Integrantes',
  config: 'Config',
  tarjetas: 'Tarjetas',
  fijos: 'Fijos',
  presupuestos: 'Presupuestos',
  metas: 'Metas',
  ahorros: 'Ahorros',
  chicos: 'Chicos',
  deLosChicos: 'De los chicos',
} as const

export const COLUMNAS_MOVIMIENTOS = [
  'id',
  'tipo',
  'fecha',
  'monto',
  'categoria',
  'nota',
  'quien',
  'medio',
  'compra_id',
  'cuota',
  'creado',
  'actualizado',
  'borrado',
  // Etapa 9: en planillas viejas la app agrega estos encabezados sola.
  'tarjeta',
  'fijo',
  // Etapa 10.
  'etiqueta',
] as const

/** La letra de la última columna de una pestaña con estas columnas ("O" para movimientos). */
const ultimaColumna = (columnas: readonly string[]) => String.fromCharCode(64 + columnas.length)

/** El nombre de una pestaña para un rango: entre comillas si tiene espacios o acentos ("'Léeme'!A1"). */
const enRango = (pestania: string) =>
  /^[A-Za-z0-9_]+$/.test(pestania) ? pestania : `'${pestania}'`

/** Rango con todas las columnas de movimientos (A:O). */
export const RANGO_MOVIMIENTOS = `${PESTANIAS.movimientos}!A:${ultimaColumna(COLUMNAS_MOVIMIENTOS)}`

/**
 * Lo que cargaron los chicos (rol "solo carga"), copiado por la app del dueño a la planilla de la
 * familia: mismas columnas que Movimientos, en su propia pestaña, porque no suma al balance.
 */
export const RANGO_DE_LOS_CHICOS = `${enRango(PESTANIAS.deLosChicos)}!A:${ultimaColumna(COLUMNAS_MOVIMIENTOS)}`

/**
 * La fila `n` de movimientos con todas sus columnas ("Movimientos!A5:O5"). Google rechaza
 * escribir más valores de los que entran en el rango: con A:M, editar o borrar un movimiento
 * fallaba desde que se sumaron las columnas de la Etapa 9.
 */
export const filaDeMovimientos = (n: number, pestania: string = PESTANIAS.movimientos) =>
  `${enRango(pestania)}!A${n}:${ultimaColumna(COLUMNAS_MOVIMIENTOS)}${n}`

/** email, apodo, color y `entro` (cuándo abrió la planilla desde la app por primera vez). */
export const RANGO_INTEGRANTES = `${PESTANIAS.integrantes}!A:E`

export const VERSION_ESQUEMA = 2

export type Celda = string | number | boolean

export function movimientoAFila(m: Movimiento): Celda[] {
  return [
    m.id,
    m.tipo,
    m.fecha,
    m.monto / 100,
    m.categoria,
    m.nota,
    m.quien,
    m.medio,
    m.compraId ?? '',
    m.cuota ?? '',
    m.creado,
    m.actualizado,
    m.borrado,
    m.tarjeta ?? '',
    m.fijo ?? '',
    m.etiqueta ?? '',
  ]
}

/** Las fechas que alguien escribe a mano en Sheets llegan como número de serie. */
export function serialAFecha(serial: number): Fecha {
  // Día 0 de Sheets = 30/12/1899. Se calcula en UTC para no correr el día.
  const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)
  return fecha.toISOString().slice(0, 10)
}

const texto = (c: Celda | undefined) => (c === undefined ? '' : String(c).trim())

const esVerdadero = (c: Celda | undefined) => c === true || texto(c).toUpperCase() === 'TRUE'

/** Un día del mes escrito en la planilla (vacío = no se cargó). */
function aDia(c: Celda | undefined): number | undefined {
  const t = texto(c)
  return t === '' ? undefined : Number(t)
}

function aCentavos(c: Celda | undefined): number {
  if (typeof c === 'number') return Math.round(c * 100)
  const n = Number(texto(c).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

/**
 * Filas leídas de la pestaña Movimientos (la primera son los encabezados) a
 * movimientos válidos. Devuelve también en qué fila de la hoja está cada id
 * (para actualizarla) y cuántas filas se descartaron por estar rotas.
 */
export function filasAMovimientos(filas: Celda[][]): {
  movimientos: Movimiento[]
  filaPorId: Map<string, number>
  descartadas: number
} {
  const [encabezado = [], ...datos] = filas
  const columna = new Map(encabezado.map((nombre, i) => [texto(nombre).toLowerCase(), i]))
  const celda = (fila: Celda[], nombre: string) => fila[columna.get(nombre) ?? -1]

  const movimientos: Movimiento[] = []
  const filaPorId = new Map<string, number>()
  let descartadas = 0

  datos.forEach((fila, i) => {
    if (fila.every((c) => texto(c) === '')) return // fila vacía: no cuenta
    const fecha = celda(fila, 'fecha')
    const compraId = texto(celda(fila, 'compra_id'))
    const cuota = texto(celda(fila, 'cuota'))
    const tarjeta = texto(celda(fila, 'tarjeta'))
    const fijo = texto(celda(fila, 'fijo'))
    const etiqueta = texto(celda(fila, 'etiqueta')).trim()
    const borrado = celda(fila, 'borrado')
    const candidato = {
      id: texto(celda(fila, 'id')),
      tipo: texto(celda(fila, 'tipo')),
      fecha: typeof fecha === 'number' ? serialAFecha(fecha) : texto(fecha),
      monto: aCentavos(celda(fila, 'monto')),
      categoria: texto(celda(fila, 'categoria')),
      nota: texto(celda(fila, 'nota')),
      quien: texto(celda(fila, 'quien')).toLowerCase(),
      medio: texto(celda(fila, 'medio')),
      ...(compraId ? { compraId } : {}),
      ...(cuota ? { cuota } : {}),
      ...(tarjeta ? { tarjeta } : {}),
      ...(fijo ? { fijo } : {}),
      ...(etiqueta ? { etiqueta } : {}),
      creado: texto(celda(fila, 'creado')),
      actualizado: texto(celda(fila, 'actualizado')),
      borrado: esVerdadero(borrado),
    }
    if (!esMovimientoValido(candidato)) {
      descartadas++
      return
    }
    movimientos.push(candidato)
    filaPorId.set(candidato.id, i + 2) // +1 por el encabezado, +1 porque Sheets cuenta desde 1
  })

  return { movimientos, filaPorId, descartadas }
}

export interface DatosIntegrante {
  /** El email como está escrito en la pestaña (la clave del mapa es `claveDeCuenta`). */
  email: string
  apodo: string
  color: number
  /** Instante en que abrió la planilla desde la app por primera vez ('' = todavía no). */
  entro: string
  /**
   * Instante en que salió de la familia desde la app ('' = no salió). Lo anota esa persona si
   * Google no la deja sacarse el acceso sola; la app del dueño se lo saca en su próxima pasada.
   */
  salio: string
}

/**
 * Apodo, color, "ya entró" y "salió" guardados en la pestaña Integrantes (solo para mostrar), por
 * cuenta (`claveDeCuenta`: en Gmail los puntos no cuentan). Si una cuenta quedó en dos filas (por
 * ejemplo, invitada con un punto que al entrar no tenía), se juntan: de cada columna vale lo último
 * escrito.
 */
export function filasAIntegrantes(filas: Celda[][]): Map<string, DatosIntegrante> {
  const [, ...datos] = filas
  const resultado = new Map<string, DatosIntegrante>()
  for (const [email, apodo, color, entro, salio] of datos) {
    const escrito = texto(email).toLowerCase()
    if (!escrito) continue
    const clave = claveDeCuenta(escrito)
    const antes = resultado.get(clave)
    resultado.set(clave, {
      email: antes?.email ?? escrito,
      apodo: texto(apodo) || antes?.apodo || '',
      color: Number(color) || antes?.color || 0,
      entro: texto(entro) || antes?.entro || '',
      salio: texto(salio) || antes?.salio || '',
    })
  }
  return resultado
}

/**
 * Las filas de la hoja (1 = encabezados) de esa cuenta en la pestaña Integrantes, de arriba abajo:
 * puede estar en más de una (Gmail con y sin puntos).
 */
export function filasDeIntegrante(filas: Celda[][], email: string): number[] {
  const resultado: number[] = []
  filas.forEach((fila, i) => {
    if (i > 0 && mismaCuenta(texto(fila[0]), email)) resultado.push(i + 1)
  })
  return resultado
}

/**
 * Fila de la hoja de esa cuenta en la pestaña Integrantes, o `null`. Si está en dos, la última: es
 * la que manda al juntarlas (`filasAIntegrantes`).
 */
export function filaDeIntegrante(filas: Celda[][], email: string): number | null {
  return filasDeIntegrante(filas, email).at(-1) ?? null
}

/**
 * Las filas de esa cuenta que dicen que salió de la familia. La salida se junta de cualquiera de
 * ellas (`filasAIntegrantes`): para volver hay que borrarla de todas.
 */
export function filasConSalida(filas: Celda[][], email: string): number[] {
  return filasDeIntegrante(filas, email).filter((n) => texto(filas[n - 1]![4]))
}

export interface Permiso {
  id: string
  tipo: string
  rol: string
  email: string
  nombre: string
}

/**
 * Los integrantes SON las personas con las que está compartida la planilla
 * (PROPUESTA.md §5): dueño = owner; integrante = writer. La pestaña
 * Integrantes solo aporta el apodo y el color.
 */
export function integrantesDesdePermisos(
  permisos: Permiso[],
  extra: Map<string, DatosIntegrante>,
): Integrante[] {
  const personas = permisos
    .filter((p) => p.tipo === 'user' && (p.rol === 'owner' || p.rol === 'writer') && p.email)
    .map((p) => ({ ...p, email: p.email.toLowerCase() }))
    // Quien salió de la familia ya no está, aunque Google todavía no le haya sacado el acceso.
    .filter((p) => p.rol === 'owner' || !extra.get(claveDeCuenta(p.email))?.salio)
    .sort((a, b) => (a.rol === 'owner' ? -1 : b.rol === 'owner' ? 1 : 0))

  const usados = new Set<number>()
  for (const p of personas) {
    const c = extra.get(claveDeCuenta(p.email))?.color
    if (c) usados.add(c)
  }
  const colorLibre = () => {
    for (let c = 1; c <= 6; c++) {
      if (!usados.has(c)) {
        usados.add(c)
        return c
      }
    }
    return 6 // más de 6 personas: se repite el último color
  }

  return personas.map((p) => {
    const guardado = extra.get(claveDeCuenta(p.email))
    return {
      email: p.email,
      apodo: guardado?.apodo || p.nombre.split(' ')[0] || p.email.split('@')[0]!,
      rol: p.rol === 'owner' ? 'dueño' : 'integrante',
      color: guardado?.color || colorLibre(),
      yaEntro: Boolean(guardado?.entro),
    }
  })
}

// ---------------------------------------------------------------------------
// Configuración de la familia (Etapa 9): Tarjetas, Fijos y Presupuestos
// ---------------------------------------------------------------------------

export const COLUMNAS_TARJETAS = [
  'id',
  'nombre',
  'cierre',
  'vencimiento',
  'actualizado',
  'borrado',
] as const

export const COLUMNAS_FIJOS = [
  'id',
  'tipo',
  'nombre',
  'categoria',
  'monto',
  'medio',
  'tarjeta',
  'dia',
  'activo',
  'actualizado',
  'borrado',
] as const

/** Una fila por categoría: la categoría es la clave. */
export const COLUMNAS_PRESUPUESTOS = ['categoria', 'monto', 'actualizado', 'borrado'] as const

/**
 * Una fila por categoría (la clave es el id). Las primeras cuatro son las de siempre: en una
 * planilla vieja, el resto del encabezado se completa al guardar la primera vez.
 */
export const COLUMNAS_CATEGORIAS = [
  'id',
  'tipo',
  'nombre',
  'icono',
  'oculta',
  'actualizado',
  'borrado',
] as const

/** "Tarjetas!A:F": todas las columnas de una pestaña. */
export const rangoDe = (pestania: string, columnas: readonly string[]) =>
  `${enRango(pestania)}!A:${ultimaColumna(columnas)}`

export const RANGO_TARJETAS = rangoDe(PESTANIAS.tarjetas, COLUMNAS_TARJETAS)
export const RANGO_FIJOS = rangoDe(PESTANIAS.fijos, COLUMNAS_FIJOS)
export const RANGO_PRESUPUESTOS = rangoDe(PESTANIAS.presupuestos, COLUMNAS_PRESUPUESTOS)
export const RANGO_CATEGORIAS = rangoDe(PESTANIAS.categorias, COLUMNAS_CATEGORIAS)

/** Una fila por meta (Etapa 10). `mes` va como texto "2027-01". */
export const COLUMNAS_METAS = [
  'id',
  'nombre',
  'objetivo',
  'juntado',
  'mes',
  'actualizado',
  'borrado',
] as const
export const RANGO_METAS = rangoDe(PESTANIAS.metas, COLUMNAS_METAS)

export function metaAFila(m: Meta): Celda[] {
  return [m.id, m.nombre, m.objetivo / 100, m.juntado / 100, m.mes ?? '', m.actualizado, m.borrado]
}

export function filasAMetas(filas: Celda[][]): Meta[] {
  return filasA(
    filas,
    (celda) => {
      const mes = texto(celda('mes'))
      return {
        id: texto(celda('id')),
        nombre: texto(celda('nombre')),
        objetivo: aCentavos(celda('objetivo')),
        juntado: aCentavos(celda('juntado')),
        ...(/^\d{4}-\d{2}$/.test(mes) ? { mes } : {}),
        actualizado: texto(celda('actualizado')),
        borrado: esVerdadero(celda('borrado')),
      }
    },
    esMetaValida,
  )
}

/** Una fila por ahorro (Etapa 10): "Dólares en casa", USD, 1200. El monto va en su moneda. */
export const COLUMNAS_AHORROS = [
  'id',
  'nombre',
  'moneda',
  'monto',
  'actualizado',
  'borrado',
] as const
export const RANGO_AHORROS = rangoDe(PESTANIAS.ahorros, COLUMNAS_AHORROS)

export function ahorroAFila(a: Ahorro): Celda[] {
  return [a.id, a.nombre, a.moneda, a.monto / 100, a.actualizado, a.borrado]
}

/**
 * La moneda como la escribiría alguien a mano ("USD", "dólares", "US$", "pesos"); `null` si no
 * se entiende (esa fila no entra: mejor no mostrar un ahorro que mostrarlo en la moneda que no es).
 */
function leerMoneda(celda: Celda | undefined): Moneda | null {
  const m = normalizar(texto(celda)).replace(/[\s.]/g, '')
  if (['usd', 'us$', 'u$s', 'dolar', 'dolares'].includes(m)) return 'USD'
  if (['ars', '$', 'peso', 'pesos'].includes(m)) return 'ARS'
  return null
}

export function filasAAhorros(filas: Celda[][]): Ahorro[] {
  return filasA(
    filas,
    (celda) => ({
      id: texto(celda('id')),
      nombre: texto(celda('nombre')),
      moneda: leerMoneda(celda('moneda')),
      monto: aCentavos(celda('monto')),
      actualizado: texto(celda('actualizado')),
      borrado: esVerdadero(celda('borrado')),
    }),
    esAhorroValido,
  )
}

/** Una fila por chico con el rol "solo carga" (Etapa 10): su planilla, email, apodo y color. */
export const COLUMNAS_CHICOS = [
  'planilla',
  'email',
  'apodo',
  'color',
  'actualizado',
  'borrado',
] as const
export const RANGO_CHICOS = rangoDe(PESTANIAS.chicos, COLUMNAS_CHICOS)

export function chicoAFila(c: Chico): Celda[] {
  return [c.planilla, c.email, c.apodo, c.color, c.actualizado, c.borrado]
}

export function filasAChicos(filas: Celda[][]): Chico[] {
  return filasA(
    filas,
    (celda) => ({
      planilla: texto(celda('planilla')),
      email: texto(celda('email')).toLowerCase(),
      apodo: texto(celda('apodo')),
      color: Number(celda('color')) || 1,
      actualizado: texto(celda('actualizado')),
      borrado: esVerdadero(celda('borrado')),
    }),
    esChicoValido,
  )
}

/** Lee las filas por nombre de columna y se queda con las que pasan la validación. */
function filasA<T>(
  filas: Celda[][],
  armar: (celda: (nombre: string) => Celda | undefined) => unknown,
  esValido: (x: unknown) => x is T,
): T[] {
  const [encabezado = [], ...datos] = filas
  const columna = new Map(encabezado.map((nombre, i) => [texto(nombre).toLowerCase(), i]))
  return datos
    .filter((fila) => fila.some((c) => texto(c) !== ''))
    .map((fila) => armar((nombre) => fila[columna.get(nombre) ?? -1]))
    .filter(esValido)
}

export function tarjetaAFila(t: Tarjeta): Celda[] {
  return [t.id, t.nombre, t.cierre ?? '', t.vencimiento ?? '', t.actualizado, t.borrado]
}

export function filasATarjetas(filas: Celda[][]): Tarjeta[] {
  return filasA(
    filas,
    (celda) => {
      const cierre = aDia(celda('cierre'))
      const vencimiento = aDia(celda('vencimiento'))
      return {
        id: texto(celda('id')),
        nombre: texto(celda('nombre')),
        ...(cierre !== undefined ? { cierre } : {}),
        ...(vencimiento !== undefined ? { vencimiento } : {}),
        actualizado: texto(celda('actualizado')),
        borrado: esVerdadero(celda('borrado')),
      }
    },
    esTarjetaValida,
  )
}

export function fijoAFila(f: Fijo): Celda[] {
  return [
    f.id,
    f.tipo,
    f.nombre,
    f.categoria,
    f.monto / 100,
    f.medio,
    f.tarjeta ?? '',
    f.dia,
    f.activo,
    f.actualizado,
    f.borrado,
  ]
}

export function filasAFijos(filas: Celda[][]): Fijo[] {
  return filasA(
    filas,
    (celda) => {
      const tarjeta = texto(celda('tarjeta'))
      return {
        id: texto(celda('id')),
        tipo: texto(celda('tipo')),
        nombre: texto(celda('nombre')),
        categoria: texto(celda('categoria')),
        monto: aCentavos(celda('monto')),
        medio: texto(celda('medio')) as MedioPago,
        ...(tarjeta ? { tarjeta } : {}),
        dia: aDia(celda('dia')),
        activo: esVerdadero(celda('activo')),
        actualizado: texto(celda('actualizado')),
        borrado: esVerdadero(celda('borrado')),
      }
    },
    esFijoValido,
  )
}

export function presupuestoAFila(p: Presupuesto): Celda[] {
  return [p.categoria, p.monto / 100, p.actualizado, p.borrado]
}

export function filasAPresupuestos(filas: Celda[][]): Presupuesto[] {
  return filasA(
    filas,
    (celda) => ({
      categoria: texto(celda('categoria')),
      monto: aCentavos(celda('monto')),
      actualizado: texto(celda('actualizado')),
      borrado: esVerdadero(celda('borrado')),
    }),
    esPresupuestoValido,
  )
}

export function categoriaAFila(c: CategoriaGuardada): Celda[] {
  return [c.id, c.tipo, c.nombre, c.icono, c.oculta, c.actualizado, c.borrado]
}

export function filasACategorias(filas: Celda[][]): CategoriaGuardada[] {
  return filasA(
    filas,
    (celda) => ({
      id: texto(celda('id')),
      tipo: texto(celda('tipo')),
      nombre: texto(celda('nombre')),
      icono: texto(celda('icono')),
      oculta: esVerdadero(celda('oculta')),
      actualizado: texto(celda('actualizado')),
      borrado: esVerdadero(celda('borrado')),
    }),
    esCategoriaGuardadaValida,
  )
}

/** Las pestañas de configuración, con su encabezado (para crearlas en planillas viejas). */
export const PESTANIAS_DE_CONFIG = [
  { titulo: PESTANIAS.tarjetas, filas: [[...COLUMNAS_TARJETAS]] as Celda[][] },
  { titulo: PESTANIAS.fijos, filas: [[...COLUMNAS_FIJOS]] as Celda[][] },
  { titulo: PESTANIAS.metas, filas: [[...COLUMNAS_METAS]] as Celda[][] },
  { titulo: PESTANIAS.ahorros, filas: [[...COLUMNAS_AHORROS]] as Celda[][] },
  { titulo: PESTANIAS.presupuestos, filas: [[...COLUMNAS_PRESUPUESTOS]] as Celda[][] },
]

/**
 * La primera pestaña, para quien abra la planilla a mano. La app no la lee: solo pide su primera
 * celda junto con lo demás, y si falta (planilla vieja, o alguien la borró) la vuelve a agregar.
 */
export const PESTANIA_LEEME = {
  titulo: PESTANIAS.leeme,
  filas: [
    ['Esta planilla es la base de datos de la app Gastos Familiares.'],
    [
      'Cargá, editá y borrá los gastos desde la app, no acá: si se cambia algo a mano, la app puede no entenderlo.',
    ],
    ['Las pestañas están protegidas: si alguien intenta editarlas, Google avisa antes.'],
    [
      '¿Se tocó algo sin querer? Archivo → Historial de versiones → Ver historial de versiones: elegí una versión de antes y restaurala.',
    ],
  ] as Celda[][],
}

/** Su primera celda, entre comillas por el acento (así se escribe una pestaña en un rango). */
export const RANGO_LEEME = `'${PESTANIAS.leeme}'!A1`

/** Lo que una planilla vieja puede no tener y la app agrega sola: el Léeme (primero) y la configuración. */
/** Las de los chicos con el rol "solo carga": quiénes son y lo que cargaron (Etapa 10). */
export const PESTANIAS_DE_LOS_CHICOS = [
  { titulo: PESTANIAS.chicos, filas: [[...COLUMNAS_CHICOS]] as Celda[][] },
  { titulo: PESTANIAS.deLosChicos, filas: [[...COLUMNAS_MOVIMIENTOS]] as Celda[][] },
]

export const PESTANIAS_AGREGABLES = [
  PESTANIA_LEEME,
  { titulo: PESTANIAS.categorias, filas: [[...COLUMNAS_CATEGORIAS]] as Celda[][] },
  ...PESTANIAS_DE_CONFIG,
  ...PESTANIAS_DE_LOS_CHICOS,
]

/**
 * La planilla chiquita de un chico (rol "solo carga"): el Léeme, sus movimientos y Config con
 * `tipo = chico`, que es como la app sabe que quien la abre solo carga. Nada más: el chico no ve
 * nada de la familia.
 */
export const PESTANIA_LEEME_DE_CHICO = {
  titulo: PESTANIAS.leeme,
  filas: [
    [
      'Esta planilla es de la app Gastos Familiares: acá quedan los gastos que carga un chico de la familia.',
    ],
    [
      'Cargá, editá y borrá desde la app, no acá: si se cambia algo a mano, la app puede no entenderlo.',
    ],
    ['La familia ve lo que se carga acá, aparte de sus propios gastos.'],
    [
      '¿Se tocó algo sin querer? Archivo → Historial de versiones → Ver historial de versiones: elegí una versión de antes y restaurala.',
    ],
  ] as Celda[][],
}

export function pestaniasDeChico(ahora: string) {
  return [
    PESTANIA_LEEME_DE_CHICO,
    { titulo: PESTANIAS.movimientos, filas: [[...COLUMNAS_MOVIMIENTOS]] as Celda[][] },
    {
      titulo: PESTANIAS.config,
      filas: [
        ['clave', 'valor'],
        ['schema_version', VERSION_ESQUEMA],
        ['tipo', 'chico'],
        ['creada', ahora],
      ] as Celda[][],
    },
  ]
}

/** Lo que una planilla de chico vieja (o a la que le borraron algo) recibe sola. */
export const PESTANIAS_AGREGABLES_DE_CHICO = [PESTANIA_LEEME_DE_CHICO]

/**
 * Qué planilla es, por su pestaña Config: la de una familia, la de un chico, o ninguna de la app
 * (sin `schema_version`).
 */
export function tipoDeConfig(filas: Celda[][]): 'familia' | 'chico' | null {
  if (!filas.some((f) => texto(f[0]) === 'schema_version')) return null
  return filas.some((f) => texto(f[0]) === 'tipo' && texto(f[1]) === 'chico') ? 'chico' : 'familia'
}

/** Las columnas que se sumaron después (Etapas 9 y 10): en planillas viejas la app las agrega. */
export const COLUMNAS_NUEVAS_DE_MOVIMIENTOS = ['tarjeta', 'fijo', 'etiqueta'] as const

/** ¿A los encabezados de Movimientos les falta alguna de las columnas nuevas? */
export function faltanColumnasNuevas(encabezado: Celda[] | undefined): boolean {
  const nombres = new Set((encabezado ?? []).map((c) => texto(c).toLowerCase()))
  return COLUMNAS_NUEVAS_DE_MOVIMIENTOS.some((c) => !nombres.has(c))
}

/**
 * El nombre de la planilla de una familia, con el de su dueño ("Gastos Familiares - ana.prueba"):
 * así se distingue de otras planillas de la app que la persona tenga o le compartan (pedido del
 * usuario, 2026-10-18). Va la parte del Gmail antes de la @.
 */
export const nombreDePlanillaDe = (base: string, duenio: string) =>
  `${base} - ${duenio.trim().toLowerCase().split('@')[0]}`

/** Contenido inicial de cada pestaña al crear la planilla (el Léeme primero: es lo que se ve al abrirla). */
export function pestaniasIniciales(duenio: { email: string; apodo: string }, ahora: string) {
  return [
    PESTANIA_LEEME,
    { titulo: PESTANIAS.movimientos, filas: [[...COLUMNAS_MOVIMIENTOS]] as Celda[][] },
    {
      titulo: PESTANIAS.categorias,
      filas: [
        [...COLUMNAS_CATEGORIAS],
        ...CATEGORIAS.map((c) => [c.id, c.tipo, c.nombre, c.icono, false, '', false]),
      ] as Celda[][],
    },
    {
      titulo: PESTANIAS.integrantes,
      filas: [
        ['email', 'apodo', 'color', 'entro', 'salio'],
        [duenio.email, duenio.apodo, 1, ahora],
      ] as Celda[][],
    },
    {
      titulo: PESTANIAS.config,
      filas: [
        ['clave', 'valor'],
        ['schema_version', VERSION_ESQUEMA],
        ['creada', ahora],
        ['medios', MEDIOS.map((m) => m.id).join(',')],
      ] as Celda[][],
    },
    ...PESTANIAS_DE_CONFIG,
    ...PESTANIAS_DE_LOS_CHICOS,
  ]
}
