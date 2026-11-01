/**
 * Cookies de la sesión: siempre HttpOnly (el JavaScript de la página nunca
 * las ve), Secure y SameSite=Lax (viajan al volver de Google, que es una
 * navegación de primer nivel, pero no en pedidos de otros sitios).
 */

export function leerCookie(req: Request, nombre: string): string | null {
  const cabecera = req.headers.get('cookie') ?? ''
  for (const parte of cabecera.split(';')) {
    const [clave, ...resto] = parte.trim().split('=')
    if (clave === nombre) return decodeURIComponent(resto.join('='))
  }
  return null
}

export function armarCookie(
  nombre: string,
  valor: string,
  opciones: { maxAgeSeg: number; path: string },
): string {
  return [
    `${nombre}=${encodeURIComponent(valor)}`,
    `Path=${opciones.path}`,
    `Max-Age=${opciones.maxAgeSeg}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ')
}

export function borrarCookie(nombre: string, path: string): string {
  return armarCookie(nombre, '', { maxAgeSeg: 0, path })
}
