import { movimientosDelMes } from './balance.ts'
import type { Centavos, Mes, Movimiento, Presupuesto } from './tipos.ts'

/** Desde qué porcentaje del presupuesto se avisa (PROPUESTA.md Etapa 9). */
export const UMBRAL_AVISO = 80

export type EstadoPresupuesto = 'bien' | 'cerca' | 'pasado'

export interface AvancePresupuesto {
  categoria: string
  presupuesto: Centavos
  gastado: Centavos
  /** Lo que queda (negativo si se pasó). */
  restante: Centavos
  porcentaje: number
  estado: EstadoPresupuesto
}

export function estadoDe(porcentaje: number): EstadoPresupuesto {
  if (porcentaje >= 100) return 'pasado'
  return porcentaje >= UMBRAL_AVISO ? 'cerca' : 'bien'
}

export const presupuestosVigentes = (presupuestos: Presupuesto[]) =>
  presupuestos.filter((p) => !p.borrado && p.monto > 0)

/** Cómo viene cada categoría con presupuesto en el mes; las más comprometidas primero. */
export function avanceDePresupuestos(
  presupuestos: Presupuesto[],
  movimientos: Movimiento[],
  mes: Mes,
): AvancePresupuesto[] {
  const gastos = movimientosDelMes(movimientos, mes).filter((m) => m.tipo === 'gasto')
  return presupuestosVigentes(presupuestos)
    .map((p) => {
      const gastado = gastos
        .filter((m) => m.categoria === p.categoria)
        .reduce((total, m) => total + m.monto, 0)
      const porcentaje = (gastado / p.monto) * 100
      return {
        categoria: p.categoria,
        presupuesto: p.monto,
        gastado,
        restante: p.monto - gastado,
        porcentaje,
        estado: estadoDe(porcentaje),
      }
    })
    .sort((a, b) => b.porcentaje - a.porcentaje)
}

/**
 * Después de cargar un gasto: si esa categoría quedó cerca o pasada de su
 * presupuesto en ese mes, cómo viene. `null` si no hay que avisar nada.
 */
export function avisoDePresupuesto(
  presupuestos: Presupuesto[],
  movimientos: Movimiento[],
  mes: Mes,
  categoria: string,
): AvancePresupuesto | null {
  const avance = avanceDePresupuestos(presupuestos, movimientos, mes).find(
    (a) => a.categoria === categoria,
  )
  return avance && avance.estado !== 'bien' ? avance : null
}
