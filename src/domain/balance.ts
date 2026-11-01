import { mesDe, sumarMesesAMes } from './fechas.ts'
import type { Categoria, Centavos, Mes, Movimiento, TipoMovimiento } from './tipos.ts'

/**
 * Balance del mes (PROPUESTA.md §8): mes calendario, sin borrados, con las
 * cuotas imputadas al mes en que caen.
 */

export interface TotalCategoria {
  categoria: string
  total: Centavos
  /** email → centavos gastados en esta categoría. */
  porIntegrante: Record<string, Centavos>
}

export interface TotalIntegrante {
  gastos: Centavos
  ingresos: Centavos
}

export interface ResumenMes {
  mes: Mes
  ingresos: Centavos
  gastos: Centavos
  /** Te queda = ingresos − gastos (puede ser negativo). */
  saldo: Centavos
  /** Gastos sobre ingresos, en %. `null` si no hay ingresos cargados. */
  porcentajeGastado: number | null
  /** De mayor a menor. */
  gastosPorCategoria: TotalCategoria[]
  /** email → totales de esa persona. */
  porIntegrante: Record<string, TotalIntegrante>
  gastosMesAnterior: Centavos
  /** Variación de los gastos contra el mes anterior, en %. `null` si el anterior fue 0. */
  variacionGastos: number | null
}

const vigentes = (movimientos: Movimiento[]) => movimientos.filter((m) => !m.borrado)

function sumar(movimientos: Movimiento[], tipo: TipoMovimiento): Centavos {
  return movimientos.filter((m) => m.tipo === tipo).reduce((total, m) => total + m.monto, 0)
}

export function movimientosDelMes(movimientos: Movimiento[], mes: Mes): Movimiento[] {
  return vigentes(movimientos).filter((m) => mesDe(m.fecha) === mes)
}

export function resumenDelMes(movimientos: Movimiento[], mes: Mes): ResumenMes {
  const delMes = movimientosDelMes(movimientos, mes)
  const ingresos = sumar(delMes, 'ingreso')
  const gastos = sumar(delMes, 'gasto')
  const gastosMesAnterior = sumar(movimientosDelMes(movimientos, sumarMesesAMes(mes, -1)), 'gasto')

  const categorias = new Map<string, TotalCategoria>()
  const porIntegrante: Record<string, TotalIntegrante> = {}
  for (const m of delMes) {
    const persona = (porIntegrante[m.quien] ??= { gastos: 0, ingresos: 0 })
    if (m.tipo === 'ingreso') {
      persona.ingresos += m.monto
      continue
    }
    persona.gastos += m.monto
    const cat = categorias.get(m.categoria) ?? {
      categoria: m.categoria,
      total: 0,
      porIntegrante: {},
    }
    cat.total += m.monto
    cat.porIntegrante[m.quien] = (cat.porIntegrante[m.quien] ?? 0) + m.monto
    categorias.set(m.categoria, cat)
  }

  return {
    mes,
    ingresos,
    gastos,
    saldo: ingresos - gastos,
    porcentajeGastado: ingresos > 0 ? (gastos / ingresos) * 100 : null,
    gastosPorCategoria: [...categorias.values()].sort((a, b) => b.total - a.total),
    porIntegrante,
    gastosMesAnterior,
    variacionGastos:
      gastosMesAnterior > 0 ? ((gastos - gastosMesAnterior) / gastosMesAnterior) * 100 : null,
  }
}

/**
 * Cuotas ya cargadas que caen DESPUÉS del mes indicado, sumadas por mes.
 * Responde "¿cuánto del sueldo de noviembre ya está gastado?".
 */
export function comprometido(
  movimientos: Movimiento[],
  mes: Mes,
  maxMeses = 6,
): { mes: Mes; total: Centavos }[] {
  const porMes = new Map<Mes, Centavos>()
  for (const m of vigentes(movimientos)) {
    const mesCuota = mesDe(m.fecha)
    if (m.tipo !== 'gasto' || !m.compraId || mesCuota <= mes) continue
    porMes.set(mesCuota, (porMes.get(mesCuota) ?? 0) + m.monto)
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxMeses)
    .map(([mesCuota, total]) => ({ mes: mesCuota, total }))
}

/**
 * Categorías ordenadas por cuántas veces se usaron (las más usadas primero),
 * para que en Cargar lo habitual quede a un toque. Empate: orden del catálogo.
 */
export function ordenarPorUso(categorias: Categoria[], movimientos: Movimiento[]): Categoria[] {
  const usos = new Map<string, number>()
  for (const m of vigentes(movimientos)) {
    // Una compra en cuotas cuenta como un solo uso, no como N.
    if (m.cuota && !m.cuota.startsWith('1/')) continue
    usos.set(m.categoria, (usos.get(m.categoria) ?? 0) + 1)
  }
  return categorias
    .map((c, orden) => ({ c, orden, usos: usos.get(c.id) ?? 0 }))
    .sort((a, b) => b.usos - a.usos || a.orden - b.orden)
    .map(({ c }) => c)
}
