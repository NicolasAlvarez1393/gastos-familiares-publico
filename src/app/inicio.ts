import type { TipoMovimiento } from '../domain/tipos.ts'

/**
 * Con qué pantalla abre la app. Lo usan los atajos del ícono (manifest, en
 * vite.config.ts): "Cargar un ingreso" abre con ?cargar=ingreso y "Ver el mes"
 * con ?ver=mes. Android los muestra al mantener apretado el ícono; el iPhone no.
 */
export interface Inicio {
  pestania?: 'cargar' | 'mes'
  tipo?: TipoMovimiento
  /** Abre con la hoja de salir de la familia (para sumarse a otra con su link). */
  salir?: boolean
}

export function inicioDesdeParametros(params: URLSearchParams): Inicio {
  if (params.get('ver') === 'mes') return { pestania: 'mes' }
  const cargar = params.get('cargar')
  if (cargar === 'ingreso' || cargar === 'gasto') return { pestania: 'cargar', tipo: cargar }
  return {}
}
