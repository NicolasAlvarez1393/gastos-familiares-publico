import { movimientosDelMes, resumenDelMes, type TotalCategoria } from './balance.ts'
import { mismaCuenta } from './cuentas.ts'
import type { Centavos, Chico, Mes, Movimiento } from './tipos.ts'

export const chicosVigentes = (chicos: Chico[]) => chicos.filter((c) => !c.borrado)

export interface ResumenDeChico {
  chico: Chico
  gastos: Centavos
  ingresos: Centavos
  porCategoria: TotalCategoria[]
  /** Lo del mes, sin borrados, lo más nuevo primero. */
  movimientos: Movimiento[]
}

/**
 * Lo que cargó cada chico en el mes, desde su planilla (rol "solo carga", Etapa 10). Va **aparte**
 * del balance de la familia: la mesada ya es un gasto fijo, y sumar lo que el chico gasta de ella
 * sería contarlo dos veces (decisión del usuario, 2026-10-17). Cada chico, aunque no haya cargado
 * nada ese mes.
 */
export function resumenDeChicos(
  movimientos: Movimiento[],
  chicos: Chico[],
  mes: Mes,
): ResumenDeChico[] {
  return chicosVigentes(chicos).map((chico) => {
    const suyos = movimientos.filter((m) => mismaCuenta(m.quien, chico.email))
    const r = resumenDelMes(suyos, mes)
    return {
      chico,
      gastos: r.gastos,
      ingresos: r.ingresos,
      porCategoria: r.gastosPorCategoria,
      movimientos: movimientosDelMes(suyos, mes).sort(
        (a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado),
      ),
    }
  })
}
