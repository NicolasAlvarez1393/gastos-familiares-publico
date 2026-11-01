import { sumarMeses } from './fechas.ts'
import type { Centavos, Fecha } from './tipos.ts'

/** Más de 60 cuotas (5 años) es casi seguro un error de tipeo. */
export const MAX_CUOTAS = 60

export interface CuotaGenerada {
  fecha: Fecha
  monto: Centavos
  /** `k/n` */
  cuota: string
}

/**
 * Divide un total en cuotas iguales en centavos; la última absorbe el resto
 * para que la suma dé exacto (100.000 en 3 = 33.333,33 + 33.333,33 + 33.333,34).
 */
export function dividirEnCuotas(total: Centavos, cantidad: number): Centavos[] {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CUOTAS) {
    throw new Error(`Cantidad de cuotas inválida: ${cantidad}`)
  }
  const base = Math.floor(total / cantidad)
  const resto = total - base * cantidad
  return Array.from({ length: cantidad }, (_, i) => (i === cantidad - 1 ? base + resto : base))
}

/**
 * Meses entre la compra y la primera cuota: 0 = el mismo mes; hasta 3 por las
 * promos de "primera cuota a 90 días".
 */
export const MAX_MESES_HASTA_PRIMERA = 3

/**
 * Por defecto la primera cuota cae el mes siguiente a la compra, que es cuando
 * suele llegar en el resumen de la tarjeta. Pedido de la familia (2026-10-16):
 * con "el mismo mes" por defecto, una compra en 3 cuotas les quedó mal.
 */
export const MESES_HASTA_PRIMERA_POR_DEFECTO = 1

/**
 * Una cuota por mes, el mismo día que la compra (o el último día del mes si
 * ese día no existe). La primera cae `mesesHastaPrimera` meses después de la compra.
 */
export function generarCuotas(opciones: {
  total: Centavos
  cantidad: number
  fechaCompra: Fecha
  mesesHastaPrimera: number
}): CuotaGenerada[] {
  const { total, cantidad, fechaCompra, mesesHastaPrimera } = opciones
  if (
    !Number.isInteger(mesesHastaPrimera) ||
    mesesHastaPrimera < 0 ||
    mesesHastaPrimera > MAX_MESES_HASTA_PRIMERA
  ) {
    throw new Error(`Mes de la primera cuota inválido: ${mesesHastaPrimera}`)
  }
  return dividirEnCuotas(total, cantidad).map((monto, i) => ({
    // Siempre desde la fecha de compra (no encadenando): así un 31 que cayó en
    // 28 de febrero vuelve a ser 31 en marzo.
    fecha: sumarMeses(fechaCompra, i + mesesHastaPrimera),
    monto,
    cuota: `${i + 1}/${cantidad}`,
  }))
}
