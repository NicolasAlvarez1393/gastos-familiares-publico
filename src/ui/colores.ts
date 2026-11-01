import { mismaCuenta } from '../domain/cuentas.ts'
import type { Integrante } from '../domain/tipos.ts'

/*
 * Clases de color por persona. Tienen que estar escritas completas para que
 * Tailwind las encuentre al compilar (no se pueden armar con `bg-persona-${n}`).
 */
const FONDO = [
  'bg-persona-1',
  'bg-persona-2',
  'bg-persona-3',
  'bg-persona-4',
  'bg-persona-5',
  'bg-persona-6',
]

export function fondoPersona(color: number): string {
  return FONDO[(color - 1) % FONDO.length] ?? 'bg-texto-suave'
}

/** Apodo para mostrar; si la persona ya no es integrante, la parte del email antes de la @. */
// Por cuenta, no por cómo está escrito el email: en Gmail los puntos no cuentan (domain/cuentas.ts).
export function apodoDe(email: string, integrantes: Integrante[]): string {
  return integrantes.find((i) => mismaCuenta(i.email, email))?.apodo ?? email.split('@')[0] ?? email
}

export function colorDe(email: string, integrantes: Integrante[]): number {
  return integrantes.find((i) => mismaCuenta(i.email, email))?.color ?? 6
}
