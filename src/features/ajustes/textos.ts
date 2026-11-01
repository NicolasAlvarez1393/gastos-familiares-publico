import { textoACentavos } from '../../domain/dinero.ts'
import type { Centavos, Tarjeta } from '../../domain/tipos.ts'

/** Lo que se escribe en un campo de día: `undefined` = vacío; `null` = no es un día del 1 al 31. */
export function leerDia(texto: string): number | undefined | null {
  const t = texto.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

/** Lo que se escribe en un campo de plata ("450.000", "12999,50"); `null` si no es un monto válido. */
export function leerMonto(texto: string): Centavos | null {
  const centavos = textoACentavos(texto)
  return centavos !== null && centavos > 0 ? centavos : null
}

/** Como `leerMonto`, pero vacío o cero valen (lo juntado, lo ahorrado): `null` si no es un monto. */
export function leerMontoOCero(texto: string): Centavos | null {
  if (texto.trim() === '') return 0
  const centavos = textoACentavos(texto)
  return centavos !== null && centavos >= 0 ? centavos : null
}

/** Centavos → lo que se muestra en un campo de plata para editar ("450000" o "12999,50"). */
export function montoParaEditar(centavos: Centavos): string {
  const pesos = Math.trunc(centavos / 100)
  const resto = centavos % 100
  return resto ? `${pesos},${String(resto).padStart(2, '0')}` : String(pesos)
}

export function detalleDeTarjeta(t: Pick<Tarjeta, 'cierre' | 'vencimiento'>): string {
  if (!t.cierre && !t.vencimiento) return 'Sin fechas: sus compras se pagan el mes siguiente'
  return [t.cierre && `cierra el ${t.cierre}`, t.vencimiento && `vence el ${t.vencimiento}`]
    .filter(Boolean)
    .join(' · ')
}
