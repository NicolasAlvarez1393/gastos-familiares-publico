import { createContext, useContext } from 'react'

export interface Aviso {
  texto: string
  /** Si viene, el aviso muestra "Deshacer" (regla del repo: deshacer en vez de confirmar). */
  deshacer?: () => void
  /** Un botón propio (por ejemplo "Ver" en el recordatorio del día), si no hay "Deshacer". */
  accion?: { texto: string; hacer: () => void }
  /** Cuánto queda a la vista; por defecto, lo de Deshacer (AJUSTES.deshacerSeg). */
  segundos?: number
}

export const AvisosContext = createContext<((aviso: Aviso) => void) | null>(null)

/** Muestra un aviso abajo de la pantalla, por unos segundos. */
export function useAvisar(): (aviso: Aviso) => void {
  const avisar = useContext(AvisosContext)
  if (!avisar) throw new Error('Falta <ProveedorAvisos> arriba en el árbol')
  return avisar
}
