/**
 * Cuánto esperar antes del próximo intento AUTOMÁTICO después de errores
 * seguidos de Google (cuota excedida, 5xx) o del servidor de login.
 *
 * A escala, si Google se satura y miles de teléfonos reintentan cada 2 minutos
 * todos juntos, lo saturan más. Por eso la espera crece al doble con cada falla
 * (con tope) y lleva ±25% de azar para que los teléfonos se desparramen.
 * Lo cargado nunca se pierde: queda en el teléfono y sube cuando Google responde.
 */

export const ESPERA_MIN_MS = 2 * 60 * 1000
export const ESPERA_MAX_MS = 30 * 60 * 1000

/** `fallas`: errores seguidos (0 = sin espera). `azar`: un número entre 0 y 1. */
export function esperaTrasFallas(fallas: number, azar: number): number {
  if (fallas <= 0) return 0
  const base = Math.min(ESPERA_MIN_MS * 2 ** (fallas - 1), ESPERA_MAX_MS)
  return Math.round(base * (0.75 + Math.min(Math.max(azar, 0), 1) * 0.5))
}
