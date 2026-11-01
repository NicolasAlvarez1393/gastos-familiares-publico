import { resumenDelMes } from './balance.ts'
import { mesDe } from './fechas.ts'
import type { Centavos, Fecha, Mes, Movimiento } from './tipos.ts'

export interface MesDelAnio {
  mes: Mes
  gastos: Centavos
  ingresos: Centavos
  /** Todavía no llegó: lo que tiene son cuotas ya comprometidas. */
  porVenir: boolean
}

export interface ResumenAnio {
  anio: number
  meses: MesDelAnio[]
  /** Hasta el mes de hoy (lo que ya pasó). */
  gastos: Centavos
  ingresos: Centavos
  /** Gastos por mes, en promedio y en pesos redondos, entre los meses ya pasados con gastos. `null` si no hubo. */
  promedioMensual: Centavos | null
  /** Hasta el mes de hoy, de mayor a menor. */
  porCategoria: { categoria: string; total: Centavos }[]
}

/**
 * El año mes a mes (Etapa 10, "gráfico del año"): los 12 meses con sus gastos e ingresos, los meses
 * por venir aparte (solo cuotas comprometidas), y los totales y categorías de lo que ya pasó.
 * `ajuste` multiplica la plata de cada mes (para verla con la inflación, en pesos de un mismo mes).
 */
export function resumenDelAnio(
  movimientos: Movimiento[],
  anio: number,
  hoy: Fecha,
  ajuste: (mes: Mes) => number = () => 1,
): ResumenAnio {
  const mesDeHoy = mesDe(hoy)
  const meses = Array.from(
    { length: 12 },
    (_, i): MesDelAnio & { categorias: Map<string, Centavos> } => {
      const mes = `${anio}-${String(i + 1).padStart(2, '0')}`
      const r = resumenDelMes(movimientos, mes)
      const factor = ajuste(mes)
      const ajustar = (monto: Centavos) => Math.round(monto * factor)
      return {
        mes,
        gastos: ajustar(r.gastos),
        ingresos: ajustar(r.ingresos),
        porVenir: mes > mesDeHoy,
        categorias: new Map(r.gastosPorCategoria.map((c) => [c.categoria, ajustar(c.total)])),
      }
    },
  )
  const pasados = meses.filter((m) => !m.porVenir)
  const gastos = pasados.reduce((s, m) => s + m.gastos, 0)
  const conGastos = pasados.filter((m) => m.gastos > 0).length
  const totales = new Map<string, Centavos>()
  for (const m of pasados) {
    for (const [categoria, total] of m.categorias) {
      totales.set(categoria, (totales.get(categoria) ?? 0) + total)
    }
  }
  return {
    anio,
    meses: meses.map((m) => ({
      mes: m.mes,
      gastos: m.gastos,
      ingresos: m.ingresos,
      porVenir: m.porVenir,
    })),
    gastos,
    ingresos: pasados.reduce((s, m) => s + m.ingresos, 0),
    // En pesos redondos, como la proyección: los centavos de un promedio no dicen nada.
    promedioMensual: conGastos > 0 ? Math.round(gastos / conGastos / 100) * 100 : null,
    porCategoria: [...totales.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total),
  }
}
