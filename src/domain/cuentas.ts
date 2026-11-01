/**
 * La misma cuenta de Google puede venir escrita de dos maneras: en Gmail los puntos no cuentan
 * (`ana.prueba@gmail.com` y `anaprueba@gmail.com` son la misma cuenta). Si la invitación quedó con
 * el punto y la persona entra sin él (o al revés), la app no la reconocía en Integrantes: no anotaba
 * que entró ni le guardaba el apodo (bug visto por el usuario, 2026-10-18). En direcciones de una
 * empresa o escuela los puntos SÍ cuentan. `oficial`: https://support.google.com/mail/answer/7436150
 * (2026-10-18).
 */
export function claveDeCuenta(email: string): string {
  const limpio = email.trim().toLowerCase()
  const arroba = limpio.lastIndexOf('@')
  if (arroba < 1) return limpio
  const usuario = limpio.slice(0, arroba)
  const dominio = limpio.slice(arroba + 1)
  return dominio === 'gmail.com' ? `${usuario.replace(/\./g, '')}@gmail.com` : limpio
}

/** ¿Son la misma cuenta de Google? */
export const mismaCuenta = (a: string, b: string) => claveDeCuenta(a) === claveDeCuenta(b)
