import { MESES_HASTA_PRIMERA_POR_DEFECTO } from './cuotas.ts'
import { diasDelMes, mesDe, partes, sumarMesesAMes } from './fechas.ts'
import type { Centavos, Fecha, Mes, Movimiento, Tarjeta } from './tipos.ts'

/**
 * En qué mes se paga una compra con tarjeta (PROPUESTA.md Etapa 9).
 *
 * - Sin día de cierre: el mes siguiente a la compra (lo más común).
 * - Con cierre: si se compró hasta el día de cierre, entra en el resumen que
 *   cierra ese mes; si fue después, en el del mes siguiente.
 * - El resumen vence el mismo mes del cierre si el vencimiento es un día
 *   posterior (cierra el 3, vence el 13); si no, el mes siguiente (cierra el
 *   25, vence el 5). Sin día de vencimiento, se supone el mes siguiente.
 */
export function mesesHastaElPago(
  fechaCompra: Fecha,
  tarjeta: Pick<Tarjeta, 'cierre' | 'vencimiento'> | undefined,
): number {
  if (!tarjeta?.cierre) return MESES_HASTA_PRIMERA_POR_DEFECTO
  const { anio, mes, dia } = partes(fechaCompra)
  // Un cierre el 31 en un mes de 30 días cierra el 30.
  const cierreDeEsteMes = Math.min(tarjeta.cierre, diasDelMes(anio, mes))
  const cierraElMesQueViene = dia > cierreDeEsteMes ? 1 : 0
  const venceElMismoMes = tarjeta.vencimiento !== undefined && tarjeta.vencimiento > tarjeta.cierre
  return cierraElMesQueViene + (venceElMismoMes ? 0 : 1)
}

export function mesDePago(fechaCompra: Fecha, tarjeta: Tarjeta | undefined): Mes {
  return sumarMesesAMes(mesDe(fechaCompra), mesesHastaElPago(fechaCompra, tarjeta))
}

export interface APagarTarjeta {
  tarjeta: Tarjeta
  total: Centavos
}

/**
 * Lo que vence en cada tarjeta en un mes: las cuotas que caen ese mes (ya están
 * en su mes de pago) y las compras en un pago cuyo mes de pago es ese.
 */
export function aPagarPorTarjeta(
  movimientos: Movimiento[],
  tarjetas: Tarjeta[],
  mes: Mes,
): APagarTarjeta[] {
  const porId = new Map(tarjetas.map((t) => [t.id, t]))
  const totales = new Map<string, Centavos>()
  for (const m of movimientos) {
    if (m.borrado || m.tipo !== 'gasto' || !m.tarjeta) continue
    const tarjeta = porId.get(m.tarjeta)
    if (!tarjeta) continue
    const mesPago = m.compraId ? mesDe(m.fecha) : mesDePago(m.fecha, tarjeta)
    if (mesPago === mes) totales.set(tarjeta.id, (totales.get(tarjeta.id) ?? 0) + m.monto)
  }
  return [...totales.entries()]
    .map(([id, total]) => ({ tarjeta: porId.get(id)!, total }))
    .sort((a, b) => a.tarjeta.nombre.localeCompare(b.tarjeta.nombre, 'es'))
}

/** Las tarjetas que se pueden elegir (las borradas siguen sirviendo para lo viejo). */
export const tarjetasVigentes = (tarjetas: Tarjeta[]) => tarjetas.filter((t) => !t.borrado)

/**
 * La tarjeta que se propone al cargar con crédito: la última que se usó (si
 * sigue vigente) o, si no, la primera. `null` si no hay tarjetas cargadas.
 */
export function tarjetaPorDefecto(movimientos: Movimiento[], tarjetas: Tarjeta[]): Tarjeta | null {
  const vigentes = tarjetasVigentes(tarjetas)
  const ultima = movimientos
    .filter((m) => !m.borrado && m.tarjeta && vigentes.some((t) => t.id === m.tarjeta))
    .reduce<Movimiento | null>((a, m) => (!a || m.creado > a.creado ? m : a), null)
  return vigentes.find((t) => t.id === ultima?.tarjeta) ?? vigentes[0] ?? null
}
