import type { Ahorro, Centavos, Moneda } from './tipos.ts'

export const ahorrosVigentes = (ahorros: Ahorro[]) => ahorros.filter((a) => !a.borrado)

/** Cuánto hay ahorrado en cada moneda, cada una por su lado: no se pasan a pesos. */
export function totalesDeAhorro(ahorros: Ahorro[]): Record<Moneda, Centavos> {
  const totales: Record<Moneda, Centavos> = { ARS: 0, USD: 0 }
  for (const a of ahorrosVigentes(ahorros)) totales[a.moneda] += a.monto
  return totales
}

/**
 * Lo que queda después de poner o sacar plata de un ahorro. `null` si se quiere sacar más de lo
 * que hay: un ahorro no queda en negativo.
 */
export function moverAhorro(hay: Centavos, monto: Centavos, como: 'sumar' | 'sacar') {
  const queda = como === 'sumar' ? hay + monto : hay - monto
  return queda < 0 ? null : queda
}
