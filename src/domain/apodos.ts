/** El largo máximo de un apodo: entra en el encabezado y en un chip de Cargar. */
export const MAX_APODO = 20

/**
 * Qué tiene de malo un apodo nuevo, o `null` si está bien: no puede quedar vacío ni repetir el de
 * otra persona de la familia (sin importar mayúsculas), porque en la app las personas se
 * reconocen por el apodo.
 */
export function problemaConApodo(apodo: string, deLosDemas: string[]): 'vacio' | 'repetido' | null {
  const limpio = apodo.trim().toLowerCase()
  if (!limpio) return 'vacio'
  return deLosDemas.some((otro) => otro.trim().toLowerCase() === limpio) ? 'repetido' : null
}
