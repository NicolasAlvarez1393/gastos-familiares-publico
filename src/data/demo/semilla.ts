import { diasDelMes, mesDe, partes, sumarMeses, sumarMesesAMes } from '../../domain/fechas.ts'
import { armarMovimientos } from '../../domain/movimientos.ts'
import type { Fecha, MedioPago, Movimiento, Tarjeta, TipoMovimiento } from '../../domain/tipos.ts'
import type { SerieIPC } from '../../domain/inflacion.ts'
import type { EstadoDatos } from '../repositorio.ts'

/**
 * Datos de ejemplo de la demo: una familia con dos integrantes y tres meses
 * de movimientos (el actual hasta hoy), dos compras en cuotas y un helado hoy.
 * Emails de ejemplo: nunca datos reales en el repo.
 */
export const NICO = 'nico@ejemplo.com'
export const MICA = 'mica@ejemplo.com'
/** Un chico con el rol "solo carga" (Etapa 10): carga en su propia planilla. */
export const JULI = 'juli@ejemplo.com'

/** Lo que carga Juli: [día, tipo, categoría, pesos, nota]. La mesada, como ingreso suyo. */
const DE_JULI: [number, TipoMovimiento, string, number, string][] = [
  [1, 'ingreso', 'otros_ingresos', 20_000, 'Mesada'],
  [3, 'gasto', 'comida', 4_500, 'Merienda con amigas'],
  [6, 'gasto', 'transporte', 3_000, 'SUBE'],
  [12, 'gasto', 'ocio', 6_000, 'Cine'],
  [20, 'gasto', 'ropa', 9_000, 'Remera'],
]

type Plantilla = [
  dia: number,
  tipo: TipoMovimiento,
  categoria: string,
  pesos: number,
  nota: string,
  quien: string,
  medio: MedioPago,
  /** Id del fijo que registra (los fijos de la demo, más abajo). */
  fijo?: string,
]

/** La tarjeta de la demo: con cierre y vencimiento, para mostrar en qué mes se paga cada cosa. */
const VISA = 'visa'

const MES_TIPICO: Plantilla[] = [
  [1, 'ingreso', 'sueldo', 1_850_000, 'Sueldo', NICO, 'transferencia', 'sueldo-nico'],
  [1, 'ingreso', 'sueldo', 1_520_000, 'Sueldo', MICA, 'transferencia', 'sueldo-mica'],
  [2, 'gasto', 'casa', 680_000, 'Alquiler', NICO, 'transferencia', 'alquiler'],
  [3, 'gasto', 'casa', 125_000, 'Expensas', MICA, 'transferencia', 'expensas'],
  [4, 'gasto', 'super', 96_500, 'Super semanal', MICA, 'debito'],
  [5, 'gasto', 'servicios', 48_300, 'Luz', NICO, 'debito', 'luz'],
  [5, 'gasto', 'servicios', 36_900, 'Internet', NICO, 'debito', 'internet'],
  [6, 'gasto', 'transporte', 15_000, 'Carga SUBE', MICA, 'mercadopago'],
  [7, 'gasto', 'comida', 28_700, 'Delivery', NICO, 'mercadopago'],
  [8, 'gasto', 'salud', 312_000, 'Prepaga', NICO, 'debito', 'prepaga'],
  [9, 'gasto', 'super', 18_400, 'Verdulería', NICO, 'efectivo'],
  [10, 'gasto', 'comida', 8_500, 'Helado', MICA, 'efectivo'],
  [11, 'gasto', 'suscripciones', 14_990, 'Streaming', NICO, 'credito', 'streaming'],
  [11, 'gasto', 'super', 112_300, 'Super del mes', NICO, 'debito'],
  [12, 'gasto', 'transporte', 52_000, 'Nafta', NICO, 'debito'],
  [12, 'gasto', 'cuidado', 22_000, 'Peluquería', MICA, 'efectivo'],
  [14, 'gasto', 'ocio', 34_000, 'Cine y cena', MICA, 'credito'],
  [15, 'gasto', 'servicios', 29_800, 'Gas', MICA, 'debito', 'gas'],
  [16, 'gasto', 'super', 87_900, 'Super semanal', MICA, 'debito'],
  [18, 'gasto', 'comida', 41_000, 'Asado con amigos', NICO, 'credito'],
  [19, 'gasto', 'regalos', 45_000, 'Regalo de cumpleaños', MICA, 'mercadopago'],
  [20, 'gasto', 'salud', 17_600, 'Farmacia', MICA, 'efectivo'],
  [21, 'gasto', 'ropa', 59_900, 'Zapatillas', MICA, 'credito'],
  [22, 'gasto', 'super', 23_700, 'Almacén', NICO, 'efectivo'],
  [24, 'gasto', 'transporte', 15_000, 'Carga SUBE', NICO, 'mercadopago'],
  [25, 'ingreso', 'extras', 180_000, 'Trabajo extra', NICO, 'transferencia'],
  [26, 'gasto', 'comida', 12_300, 'Café y medialunas', NICO, 'efectivo'],
  [27, 'gasto', 'super', 91_200, 'Super semanal', MICA, 'debito'],
  [28, 'gasto', 'ocio', 26_000, 'Fútbol 5', NICO, 'debito'],
]

/** Meses viejos un poco más baratos, como pasa con la inflación. */
const FACTOR_POR_MESES_ATRAS = [1, 0.95, 0.9]

/**
 * Inflación de ejemplo para la demo (no es la del INDEC): 2 % por mes durante tres años, publicada
 * hasta el mes pasado. Es relativa a hoy, como los movimientos, y no sale a internet.
 */
export function inflacionDeEjemplo(hoy: Fecha): SerieIPC {
  const hasta = sumarMesesAMes(mesDe(hoy), -1)
  const indices: SerieIPC['indices'] = {}
  for (let i = 0; i < 36; i++) indices[sumarMesesAMes(hasta, -i)] = 10_000 * 1.02 ** (35 - i)
  return { indices, hasta }
}

export function datosDeEjemplo(hoy: Fecha): EstadoDatos {
  const mesActual = mesDe(hoy)
  const diaHoy = partes(hoy).dia
  let n = 0
  const nuevoId = () => `demo-${++n}`
  const movimientos: Movimiento[] = []

  FACTOR_POR_MESES_ATRAS.forEach((factor, atras) => {
    const mes = sumarMesesAMes(mesActual, -atras)
    const { anio, mes: numeroMes } = partes(`${mes}-01`)
    MES_TIPICO.forEach(([dia, tipo, categoria, pesos, nota, quien, medio, fijo], i) => {
      if (atras === 0 && dia > diaHoy) return
      // Un poco de variedad entre meses: algunos gastos no se repiten.
      if (atras > 0 && (i + atras) % 9 === 0 && tipo === 'gasto') return
      const fecha = `${mes}-${String(Math.min(dia, diasDelMes(anio, numeroMes))).padStart(2, '0')}`
      const monto = Math.round((pesos * factor) / 100) * 100 * 100
      const creado = `${fecha}T15:00:00.000Z`
      movimientos.push({
        id: nuevoId(),
        tipo,
        fecha,
        monto,
        categoria,
        nota,
        quien,
        medio,
        ...(medio === 'credito' ? { tarjeta: VISA } : {}),
        ...(fijo ? { fijo } : {}),
        creado,
        actualizado: creado,
        borrado: false,
      })
    })
  })

  // Lo de Juli, este mes y el anterior: en su planilla, copiado aparte (no suma al balance).
  const deLosChicos: Movimiento[] = []
  for (const atras of [1, 0]) {
    const mes = sumarMesesAMes(mesActual, -atras)
    for (const [dia, tipo, categoria, pesos, nota] of DE_JULI) {
      if (atras === 0 && dia > diaHoy) continue
      const fecha = `${mes}-${String(dia).padStart(2, '0')}`
      const creado = `${fecha}T18:00:00.000Z`
      deLosChicos.push({
        id: nuevoId(),
        tipo,
        fecha,
        monto: pesos * 100,
        categoria,
        nota,
        quien: JULI,
        medio: 'efectivo',
        creado,
        actualizado: creado,
        borrado: false,
      })
    }
  }

  const ahora = `${hoy}T15:00:00.000Z`
  movimientos.push(
    ...armarMovimientos(
      {
        tipo: 'gasto',
        monto: 8_500_00,
        categoria: 'comida',
        nota: 'Helado',
        quien: MICA,
        medio: 'efectivo',
        fecha: hoy,
        cuotas: 1,
        mesesHastaPrimera: 0,
      },
      { nuevoId, ahora },
    ),
    ...armarMovimientos(
      {
        tipo: 'gasto',
        monto: 1_140_000_00,
        categoria: 'casa',
        nota: 'Heladera',
        quien: NICO,
        medio: 'credito',
        fecha: sumarMeses(`${mesActual}-20`, -2),
        cuotas: 6,
        mesesHastaPrimera: 0,
        tarjeta: VISA,
      },
      { nuevoId, ahora },
    ),
    ...armarMovimientos(
      {
        tipo: 'gasto',
        monto: 720_000_00,
        categoria: 'otros',
        nota: 'Celular',
        quien: MICA,
        medio: 'mercadopago',
        fecha: sumarMeses(`${mesActual}-09`, -1),
        cuotas: 12,
        mesesHastaPrimera: 0,
      },
      { nuevoId, ahora },
    ),
  )

  return {
    movimientos,
    integrantes: [
      { email: NICO, apodo: 'Nico', rol: 'dueño', color: 1 },
      { email: MICA, apodo: 'Mica', rol: 'integrante', color: 2 },
    ],
    yo: NICO,
    tarjetas: TARJETAS.map((t) => ({ ...t, actualizado: ahora })),
    fijos: MES_TIPICO.filter((p) => p[7]).map(
      ([dia, tipo, categoria, pesos, nota, , medio, id]) => ({
        id: id!,
        tipo,
        nombre: nota === 'Sueldo' ? `Sueldo ${id === 'sueldo-nico' ? 'Nico' : 'Mica'}` : nota,
        categoria,
        monto: pesos * 100,
        medio,
        ...(medio === 'credito' ? { tarjeta: VISA } : {}),
        dia,
        activo: true,
        actualizado: ahora,
        borrado: false,
      }),
    ),
    categorias: [],
    // Una meta a medio camino, con fecha: muestra cuánto juntar por mes.
    metas: [
      {
        id: 'vacaciones',
        nombre: 'Vacaciones de verano',
        objetivo: 1_500_000_00,
        juntado: 600_000_00,
        mes: sumarMesesAMes(mesActual, 3),
        actualizado: ahora,
        borrado: false,
      },
    ],
    // Dólares y pesos ahorrados, cada uno en su moneda.
    ahorros: [
      {
        id: 'dolares',
        nombre: 'Dólares en casa',
        moneda: 'USD',
        monto: 1_200_00,
        actualizado: ahora,
        borrado: false,
      },
      {
        id: 'plazo-fijo',
        nombre: 'Plazo fijo',
        moneda: 'ARS',
        monto: 850_000_00,
        actualizado: ahora,
        borrado: false,
      },
    ],
    chicos: [
      {
        planilla: 'demo-planilla-juli',
        email: JULI,
        apodo: 'Juli',
        color: 3,
        actualizado: ahora,
        borrado: false,
      },
    ],
    deLosChicos,
    soloCarga: false,
    presupuestos: PRESUPUESTOS.map(([categoria, pesos]) => ({
      categoria,
      monto: pesos * 100,
      actualizado: ahora,
      borrado: false,
    })),
  }
}

const TARJETAS: Omit<Tarjeta, 'actualizado'>[] = [
  { id: VISA, nombre: 'Visa', cierre: 25, vencimiento: 5, borrado: false },
]

/** Presupuestos de ejemplo (pesos por mes). */
const PRESUPUESTOS: [categoria: string, pesos: number][] = [
  ['super', 450_000],
  ['comida', 120_000],
  ['ocio', 70_000],
  ['ropa', 80_000],
]
