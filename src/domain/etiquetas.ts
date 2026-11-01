import type { Movimiento } from './tipos.ts'

/**
 * Las etiquetas que ya usó la familia ("Vacaciones 2027"), la más reciente primero: son las que se
 * ofrecen al cargar y al filtrar. Sin repetir, sin importar mayúsculas (queda la forma más nueva).
 */
export function etiquetasUsadas(movimientos: Movimiento[]): string[] {
  const vistas = new Map<string, string>()
  const recientes = movimientos
    .filter((m) => !m.borrado && m.etiqueta?.trim())
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado))
  for (const m of recientes) {
    const clave = m.etiqueta!.trim().toLocaleLowerCase('es')
    if (!vistas.has(clave)) vistas.set(clave, m.etiqueta!.trim())
  }
  return [...vistas.values()]
}
