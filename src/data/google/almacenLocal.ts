import { del, get, set } from 'idb-keyval'

/**
 * Dónde guarda la versión real la copia local (para abrir al instante y
 * funcionar sin señal). En el navegador es IndexedDB; en los tests, memoria.
 */
export interface AlmacenLocal {
  leer(clave: string): Promise<unknown>
  guardar(clave: string, valor: unknown): Promise<void>
  borrar(clave: string): Promise<void>
}

export function almacenIndexedDB(): AlmacenLocal {
  return {
    leer: (clave) => get(clave),
    guardar: (clave, valor) => set(clave, valor),
    borrar: (clave) => del(clave),
  }
}

export function almacenEnMemoria(): AlmacenLocal & { datos: Map<string, unknown> } {
  const datos = new Map<string, unknown>()
  return {
    datos,
    leer: async (clave) => structuredClone(datos.get(clave)),
    guardar: async (clave, valor) => void datos.set(clave, structuredClone(valor)),
    borrar: async (clave) => void datos.delete(clave),
  }
}
