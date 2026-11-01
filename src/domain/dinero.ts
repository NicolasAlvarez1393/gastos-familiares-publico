import type { Centavos, Moneda } from './tipos.ts'

/** Tope del teclado: 9.999.999.999 pesos alcanza y evita números absurdos. */
const MAX_DIGITOS = 10

export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'borrar'

/**
 * Aplica una tecla del teclado numérico al monto tipeado.
 * El teclado trabaja en pesos enteros (en la práctica no se cargan centavos);
 * `digitosACentavos` lo pasa al dominio.
 */
export function teclear(digitos: string, tecla: Tecla): string {
  if (tecla === 'borrar') return digitos.slice(0, -1)
  const nuevo = (digitos + tecla).replace(/^0+/, '')
  return nuevo.length > MAX_DIGITOS ? digitos : nuevo
}

export function digitosACentavos(digitos: string): Centavos {
  return digitos ? Number(digitos) * 100 : 0
}

const conCentavos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const sinCentavos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Formatea centavos como pesos argentinos: `$ 2.500` o `$ 33.333,33`.
 * Los decimales aparecen solo si hay centavos, para que la lista se lea limpia.
 * Después del "$" va un espacio que no se corta: el signo nunca queda en un
 * renglón y el número en el otro.
 */
export function formatearPesos(centavos: Centavos): string {
  const formato = centavos % 100 === 0 ? sinCentavos : conCentavos
  return formato.format(centavos / 100).replace(/\s/g, ESPACIO_FIJO)
}

export const ESPACIO_FIJO = '\u00a0'

const dolaresConCentavos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dolaresSinCentavos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Como `formatearPesos`, en d\u00f3lares: `US$ 200` o `US$ 1.200,50`. */
export function formatearDolares(centavos: Centavos): string {
  const formato = centavos % 100 === 0 ? dolaresSinCentavos : dolaresConCentavos
  return formato.format(centavos / 100).replace(/\s/g, ESPACIO_FIJO)
}

export const formatearEnMoneda = (centavos: Centavos, moneda: Moneda) =>
  moneda === 'USD' ? formatearDolares(centavos) : formatearPesos(centavos)

/** Parsea lo que se escribe en un campo de monto ("2.500", "2500,50") a centavos. */
export function textoACentavos(texto: string): Centavos | null {
  const limpio = texto.replace(/[$\s.]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  return Math.round(Number(limpio) * 100)
}
