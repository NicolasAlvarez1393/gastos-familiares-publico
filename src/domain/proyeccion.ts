import { movimientosDelMes } from './balance.ts'
import { diasDelMes, mesDe, partes } from './fechas.ts'
import { fijosPendientes } from './fijos.ts'
import type { Centavos, Fecha, Fijo, Movimiento } from './tipos.ts'

export interface Proyeccion {
  /** Ingresos − gastos ya cargados en el mes (incluye cuotas con fecha más adelante en el mes). */
  saldoHoy: Centavos
  /** Promedio por día de los gastos del día a día (sin fijos ni cuotas) hasta hoy. */
  gastoDiario: Centavos
  diasQueFaltan: number
  /** Lo que se gastaría a ese ritmo en los días que faltan. */
  gastoQueFalta: Centavos
  /** Fijos todavía no pagados ni cobrados este mes (por su monto estimado). */
  fijosQueFaltan: { gastos: Centavos; ingresos: Centavos }
  /** "A este ritmo terminás el mes con…" (negativo: en rojo). */
  saldoFinal: Centavos
}

/**
 * Proyección del mes en curso (PROPUESTA.md Etapa 9): lo que hay hoy, menos el
 * día a día al ritmo que se viene gastando, menos los fijos que faltan pagar,
 * más los que faltan cobrar.
 */
export function proyectarMes(movimientos: Movimiento[], fijos: Fijo[], hoy: Fecha): Proyeccion {
  const mes = mesDe(hoy)
  const { anio, mes: m, dia } = partes(hoy)
  const delMes = movimientosDelMes(movimientos, mes)
  const saldoHoy = delMes.reduce((s, x) => s + (x.tipo === 'ingreso' ? x.monto : -x.monto), 0)

  const diaADia = delMes
    .filter((x) => x.tipo === 'gasto' && !x.compraId && !x.fijo && x.fecha <= hoy)
    .reduce((s, x) => s + x.monto, 0)
  // En pesos enteros: es una estimación, los centavos no dicen nada.
  const gastoDiario = Math.round(diaADia / dia / 100) * 100
  const diasQueFaltan = diasDelMes(anio, m) - dia
  const gastoQueFalta = gastoDiario * diasQueFaltan

  const pendientes = fijosPendientes(fijos, movimientos, mes)
  const fijosQueFaltan = {
    gastos: pendientes.filter((f) => f.tipo === 'gasto').reduce((s, f) => s + f.monto, 0),
    ingresos: pendientes.filter((f) => f.tipo === 'ingreso').reduce((s, f) => s + f.monto, 0),
  }

  return {
    saldoHoy,
    gastoDiario,
    diasQueFaltan,
    gastoQueFalta,
    fijosQueFaltan,
    saldoFinal: saldoHoy - gastoQueFalta - fijosQueFaltan.gastos + fijosQueFaltan.ingresos,
  }
}
