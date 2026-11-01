import type { Centavos, Mes } from './tipos.ts'

/**
 * El índice de precios (IPC del INDEC) de cada mes, hasta el último publicado. Solo importa la
 * relación entre dos meses: cuánto más caro está todo en uno que en otro.
 */
export interface SerieIPC {
  indices: Record<Mes, number>
  /** El último mes publicado: el INDEC publica cada mes a mediados del siguiente. */
  hasta: Mes
}

/** El índice de un mes. Un mes después del último publicado toma el último: todavía no se sabe. */
function indice(serie: SerieIPC, mes: Mes): number | null {
  const valor = serie.indices[mes > serie.hasta ? serie.hasta : mes]
  return valor !== undefined && valor > 0 ? valor : null
}

/**
 * Por cuánto multiplicar la plata de `mes` para llevarla a pesos de `destino` (por defecto, del
 * último mes publicado). `null` si falta el índice de alguno de los dos.
 */
export function factorAPesosDe(serie: SerieIPC, mes: Mes, destino: Mes = serie.hasta) {
  const desde = indice(serie, mes)
  const hasta = indice(serie, destino)
  return desde === null || hasta === null ? null : hasta / desde
}

/** La plata de `mes` en pesos de `destino`, en centavos enteros. Sin índice, queda como está. */
export function enPesosDe(monto: Centavos, serie: SerieIPC, mes: Mes, destino?: Mes): Centavos {
  const factor = factorAPesosDe(serie, mes, destino)
  return factor === null ? monto : Math.round(monto * factor)
}

/**
 * Cuánto cambiaron los gastos de `anterior` a `mes` descontando la inflación, en %. `null` si la
 * inflación de `mes` todavía no se publicó (suponerla cero haría parecer que se gastó más), si
 * falta un índice o si en el mes anterior no hubo gastos.
 */
export function variacionReal(
  gastos: Centavos,
  gastosAnterior: Centavos,
  serie: SerieIPC,
  mes: Mes,
  anterior: Mes,
): number | null {
  if (gastosAnterior <= 0 || mes > serie.hasta) return null
  const factor = factorAPesosDe(serie, anterior, mes)
  return factor === null ? null : (gastos / (gastosAnterior * factor) - 1) * 100
}
